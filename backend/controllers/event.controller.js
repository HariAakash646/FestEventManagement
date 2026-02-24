import mongoose from "mongoose";
import crypto from "crypto";

import Event from "../models/event.model.js";
import User from "../models/user.model.js";
import Item from "../models/item.model.js";
import { sendRegistrationTicketEmail } from "../utils/email.js";
import { sendEventPublishedWebhook } from "../utils/discordWebhook.js";
import { generateQrDataUrlFromPayload } from "../utils/qr.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const normalizeEventDateFields = (payload = {}) => {
    const normalized = { ...payload };
    delete normalized.visitsTimeStamps;
    delete normalized.ItemList;

    const setDefaultTimeIfMissing = (field, defaultTime) => {
        const value = normalized[field];
        if (typeof value !== "string") return;

        const trimmed = value.trim();
        if (!trimmed) return;

        if (DATE_ONLY_REGEX.test(trimmed)) {
            normalized[field] = `${trimmed}T${defaultTime}:00`;
        }
    };

    setDefaultTimeIfMissing("registrationDeadline", "23:59");
    setDefaultTimeIfMissing("eventEndDate", "23:59");
    setDefaultTimeIfMissing("eventStartDate", "00:00");

    return normalized;
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const PUBLISHED_EVENT_EDITABLE_FIELDS = new Set([
    "eventDescription",
    "registrationDeadline",
    "registrationLimit",
    "registrationOpen",
    "status",
]);
const ALLOWED_STATUS_TRANSITIONS = {
    Draft: new Set(["Draft", "Published", "Cancelled"]),
    Published: new Set(["Published", "Ongoing", "Cancelled"]),
    Ongoing: new Set(["Ongoing", "Completed", "Cancelled"]),
    Completed: new Set(["Completed"]),
    Cancelled: new Set(["Cancelled"]),
    Closed: new Set(["Closed"]),
};

const pruneOldVisits = (eventDoc) => {
    const now = Date.now();
    const visits = Array.isArray(eventDoc.visitsTimeStamps) ? eventDoc.visitsTimeStamps : [];
    const pruned = visits.filter((ts) => {
        const time = new Date(ts).getTime();
        return !Number.isNaN(time) && now - time <= TWENTY_FOUR_HOURS_MS;
    });
    const changed = pruned.length !== visits.length;
    if (changed) {
        eventDoc.visitsTimeStamps = pruned;
    }
    return changed;
};

const getRequesterOrganizerId = async (req) => {
    if (!req.user?.id || req.user?.role !== "Organizer") return null;

    if (Number.isInteger(req.user.organizerId)) {
        return req.user.organizerId;
    }

    const requester = await User.findById(req.user.id).select("organizerId role");
    if (!requester || requester.role !== "Organizer" || !Number.isInteger(requester.organizerId)) {
        return null;
    }

    return requester.organizerId;
};

const buildFormSnapshot = (event, formResponses = {}) => {
    const buildSingleSnapshot = (fields, responses = {}, labelPrefix = "") =>
        Array.isArray(fields)
            ? fields.map((field, index) => ({
                fieldLabel: `${labelPrefix}${field.fieldLabel}`,
                fieldDescription: field.fieldDescription || "",
                dataType: field.dataType,
                required: !!field.required,
                options: Array.isArray(field.options) ? field.options : [],
                value: responses[String(index)],
            }))
            : [];

    if (event?.isTeamEvent) {
        const leaderFields = Array.isArray(event.customForm?.leaderFields) ? event.customForm.leaderFields : [];
        const memberFields = Array.isArray(event.customForm?.memberFields) ? event.customForm.memberFields : [];
        const leaderResponses = formResponses?.leader && typeof formResponses.leader === "object" ? formResponses.leader : {};
        const memberResponsesList = Array.isArray(formResponses?.members) ? formResponses.members : [];

        const leaderSnapshot = buildSingleSnapshot(leaderFields, leaderResponses, "[Leader] ");
        const memberSnapshot = memberResponsesList.flatMap((memberResponses, memberIndex) =>
            buildSingleSnapshot(memberFields, memberResponses, `[Member ${memberIndex + 1}] `)
        );

        return [...leaderSnapshot, ...memberSnapshot];
    }

    return Array.isArray(event.customForm?.fields)
        ? event.customForm.fields.map((field, index) => ({
            fieldLabel: field.fieldLabel,
            fieldDescription: field.fieldDescription || "",
            dataType: field.dataType,
            required: !!field.required,
            options: Array.isArray(field.options) ? field.options : [],
            value: formResponses[String(index)],
        }))
        : [];
};

const buildFormSnapshotFromFields = (fields = [], responses = {}, labelPrefix = "") =>
    Array.isArray(fields)
        ? fields.map((field, index) => ({
            fieldLabel: `${labelPrefix}${field.fieldLabel}`,
            fieldDescription: field.fieldDescription || "",
            dataType: field.dataType,
            required: !!field.required,
            options: Array.isArray(field.options) ? field.options : [],
            value: responses[String(index)],
        }))
        : [];

const hasValidRegistrationForm = (eventLike) => {
    if (!eventLike || eventLike.eventType !== "Normal Event") return true;

    if (eventLike.isTeamEvent) {
        return (
            Array.isArray(eventLike.customForm?.leaderFields) &&
            eventLike.customForm.leaderFields.length > 0 &&
            Array.isArray(eventLike.customForm?.memberFields) &&
            eventLike.customForm.memberFields.length > 0
        );
    }

    return Array.isArray(eventLike.customForm?.fields) && eventLike.customForm.fields.length > 0;
};

const validateParticipantEventRegistration = ({ event, participant, includePaidGuard = false }) => {
    if (!event) return "Event Not Found";
    if (!participant || participant.role !== "Participant") return "Participant access required";
    if (event.status !== "Published" && event.status !== "Ongoing") return "Registration is not open for this event";
    if (event.eventType !== "Normal Event") return "Registration is only available for normal events";
    if (includePaidGuard && typeof event.registrationFee === "number" && event.registrationFee > 0) {
        return "This event requires payment proof approval before registration.";
    }
    if (event.registrationOpen === false) return "Registration is currently closed by organizer";
    if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
        return "Registration deadline has passed";
    }
    if (
        typeof event.registrationLimit === "number" &&
        Array.isArray(event.registeredFormList) &&
        event.registeredFormList.length >= event.registrationLimit
    ) {
        return "Registration limit reached";
    }
    if (event.eligibility === "Must be a IIIT Student" && participant.isIIIT !== true) {
        return "This event is only for IIIT students";
    }

    const participantIdStr = String(participant._id);
    const alreadyRegisteredInEvent = Array.isArray(event.registeredFormList) &&
        event.registeredFormList.some((entry) => String(entry.participantId) === participantIdStr);
    const alreadyRegisteredInUser = Array.isArray(participant.registeredEvents) &&
        participant.registeredEvents.some((eventId) => String(eventId) === String(event._id));
    if (alreadyRegisteredInEvent || alreadyRegisteredInUser) return "You are already registered for this event";

    return "";
};

const isParticipantAlreadyRegisteredForEvent = (event, participantId) => {
    if (!event || !participantId) return false;
    return Array.isArray(event.registeredFormList)
        ? event.registeredFormList.some((entry) => String(entry.participantId) === String(participantId))
        : false;
};

const getFeedbackParticipantHash = (participantId, eventId) =>
    crypto
        .createHash("sha256")
        .update(`${String(participantId)}:${String(eventId)}:event-feedback`)
        .digest("hex");

const generateTicketId = (prefix) =>
    `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

const hasParticipantAttendedEvent = (event) => {
    if (!event) return false;
    if (event.status === "Completed" || event.status === "Closed") return true;
    const endDate = new Date(event.eventEndDate);
    if (Number.isNaN(endDate.getTime())) return false;
    return new Date() >= endDate;
};

export const getEvents = async (req, res) => {
    try {
        const { organizerId, status, eventType, lite, scope } = req.query || {};
        const query = {};
        const parsedOrganizerId = Number(organizerId);
        const shouldUseLite = String(lite || "").toLowerCase() === "true";
        const liteScope = String(scope || "").toLowerCase();

        if (Number.isInteger(parsedOrganizerId)) {
            query.organizerId = parsedOrganizerId;
        }
        if (typeof status === "string" && status.trim()) {
            query.status = status.trim();
        }
        if (typeof eventType === "string" && eventType.trim()) {
            query.eventType = eventType.trim();
        }

        let eventQuery = Event.find(query);
        if (shouldUseLite) {
            if (liteScope === "browse") {
                eventQuery = eventQuery.select(
                    "eventName eventDescription eventType status eligibility registrationDeadline eventStartDate eventEndDate organizerId eventTags visitsTimeStamps createdAt updatedAt"
                );
            } else {
            eventQuery = eventQuery.select(
                "eventName eventDescription eventType status registrationOpen eligibility registrationDeadline eventStartDate eventEndDate registrationLimit registrationFee isTeamEvent minTeamSize maxTeamSize organizerId eventTags itemIds visitsTimeStamps registeredFormList pendingRegistrationRequests createdAt updatedAt"
            );
            }
        }

        const events = await eventQuery;

        if (shouldUseLite) {
            if (liteScope === "browse") {
                const now = Date.now();
                const browseLiteData = events.map((event) => {
                    const obj = event.toObject();
                    obj.visitsCount24h = (Array.isArray(obj.visitsTimeStamps) ? obj.visitsTimeStamps : [])
                        .filter((ts) => {
                            const time = new Date(ts).getTime();
                            return !Number.isNaN(time) && now - time <= TWENTY_FOUR_HOURS_MS;
                        }).length;
                    delete obj.visitsTimeStamps;
                    return obj;
                });
                return res.status(200).json({ success: true, data: browseLiteData });
            }

            const liteData = events.map((event) => {
                const obj = event.toObject();
                obj.registeredCount = Array.isArray(obj.registeredFormList) ? obj.registeredFormList.length : 0;
                obj.pendingRequestsCount = Array.isArray(obj.pendingRegistrationRequests) ? obj.pendingRegistrationRequests.length : 0;
                delete obj.registeredFormList;
                delete obj.pendingRegistrationRequests;
                return obj;
            });
            return res.status(200).json({ success: true, data: liteData });
        }

        await Promise.all(
            events.map(async (event) => {
                if (pruneOldVisits(event)) {
                    await event.save();
                }
            })
        );
        res.status(200).json({ success: true, data: events });
    } catch (error) {
        console.log("error in fetching products: ", error.message);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const getEventById = async (req, res) => {
    const { id } = req.params;
    const scope = String(req.query?.scope || "").trim().toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        if (scope === "participant-team-detail" && req.user?.id && req.user?.role === "Participant") {
            const participantId = String(req.user.id);
            const teamDetailEvent = await Event.findById(id).select(
                "eventName eventDescription eventType status registrationDeadline eventStartDate eventEndDate organizerId isTeamEvent minTeamSize maxTeamSize " +
                "pendingRegistrationRequests.participantId pendingRegistrationRequests.participantName pendingRegistrationRequests.participantEmail pendingRegistrationRequests.formSnapshot pendingRegistrationRequests.requestedAt pendingRegistrationRequests.status pendingRegistrationRequests.isTeamRegistration pendingRegistrationRequests.targetTeamSize pendingRegistrationRequests.teamJoinCode pendingRegistrationRequests.teamJoinLink " +
                "pendingRegistrationRequests.teamMembers.participantId pendingRegistrationRequests.teamMembers.participantName pendingRegistrationRequests.teamMembers.participantEmail pendingRegistrationRequests.teamMembers.formSnapshot pendingRegistrationRequests.teamMembers.joinedAt " +
                "registeredFormList.participantId registeredFormList.formSnapshot"
            ).lean();

            if (!teamDetailEvent) {
                return res.status(404).json({ success: false, message: "Event Not Found" });
            }

            const teamRequests = Array.isArray(teamDetailEvent.pendingRegistrationRequests)
                ? teamDetailEvent.pendingRegistrationRequests
                : [];
            const matchingTeamRequest = teamRequests.find((request) => {
                if (String(request?.participantId) === participantId) return true;
                const members = Array.isArray(request?.teamMembers) ? request.teamMembers : [];
                return members.some((member) => String(member?.participantId) === participantId);
            }) || null;

            const registrations = Array.isArray(teamDetailEvent.registeredFormList)
                ? teamDetailEvent.registeredFormList
                : [];
            const matchingRegistration = registrations.find(
                (entry) => String(entry?.participantId) === participantId
            ) || null;

            const event = {
                ...teamDetailEvent,
                pendingRegistrationRequests: matchingTeamRequest ? [matchingTeamRequest] : [],
                registeredFormList: matchingRegistration ? [matchingRegistration] : [],
            };

            const organizer = await User.findOne({
                role: "Organizer",
                organizerId: teamDetailEvent.organizerId,
            }).select("role organizerName organizerId category description organizerContactEmail organizerUpiId active");

            return res.status(200).json({
                success: true,
                data: {
                    event,
                    organizer: organizer || null,
                },
            });
        }

        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event Not Found" });
        }

        const organizer = await User.findOne({
            role: "Organizer",
            organizerId: event.organizerId,
        }).select("role organizerName organizerId category description organizerContactEmail organizerUpiId active");

        return res.status(200).json({
            success: true,
            data: {
                event,
                organizer: organizer || null,
            },
        });
    } catch (error) {
        console.error("Error in getEventById:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const getParticipantDashboardData = async (req, res) => {
    try {
        if (!req.user?.id || req.user?.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const participant = await User.findById(req.user.id).select("role");
        if (!participant || participant.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const participantObjectId = new mongoose.Types.ObjectId(req.user.id);

        const relatedItems = await Item.find({
            $or: [
                { purchasedBy: participantObjectId },
                { "purchaseRecords.participantId": participantObjectId },
                { "pendingPurchaseRequests.participantId": participantObjectId },
            ],
        }).select("eventId");
        const relatedItemEventIds = relatedItems
            .map((item) => item.eventId)
            .filter(Boolean);

        const events = await Event.find({
            $or: [
                { "registeredFormList.participantId": participantObjectId },
                { "pendingRegistrationRequests.participantId": participantObjectId },
                { "pendingRegistrationRequests.teamMembers.participantId": participantObjectId },
                ...(relatedItemEventIds.length > 0 ? [{ _id: { $in: relatedItemEventIds } }] : []),
            ],
        }).select(
            "eventName eventDescription eventType status registrationDeadline eventStartDate eventEndDate organizerId itemIds isTeamEvent registrationFee " +
            "registeredFormList.participantId registeredFormList.registeredAt registeredFormList.qrPayload registeredFormList.qrCodeDataUrl " +
            "pendingRegistrationRequests.participantId pendingRegistrationRequests.requestedAt pendingRegistrationRequests.reviewedAt pendingRegistrationRequests.status pendingRegistrationRequests.paymentAmount pendingRegistrationRequests.isTeamRegistration pendingRegistrationRequests.targetTeamSize pendingRegistrationRequests.teamMembers.participantId " +
            "createdAt updatedAt"
        );

        const participantIdStr = String(participantObjectId);
        const scopedEvents = events.map((event) => {
            const eventObj = event.toObject();
            const registrations = Array.isArray(eventObj.registeredFormList) ? eventObj.registeredFormList : [];
            const pendingRequests = Array.isArray(eventObj.pendingRegistrationRequests)
                ? eventObj.pendingRegistrationRequests
                : [];

            const participantRegistrations = registrations.filter(
                (entry) => String(entry?.participantId) === participantIdStr
            );
            const participantPendingRequests = pendingRequests.filter((request) => {
                if (String(request?.participantId) === participantIdStr) return true;
                const members = Array.isArray(request?.teamMembers) ? request.teamMembers : [];
                return members.some((member) => String(member?.participantId) === participantIdStr);
            });

            return {
                ...eventObj,
                registeredFormList: participantRegistrations,
                pendingRegistrationRequests: participantPendingRequests,
            };
        });

        const organizerIds = [...new Set(
            scopedEvents
                .map((event) => event.organizerId)
                .filter((organizerId) => Number.isInteger(organizerId))
        )];

        const organizers = organizerIds.length > 0
            ? await User.find({
                role: "Organizer",
                organizerId: { $in: organizerIds },
            }).select(
                "role organizerName organizerId category description organizerContactEmail organizerUpiId active"
            )
            : [];

        return res.status(200).json({
            success: true,
            data: {
                events: scopedEvents,
                organizers,
            },
        });
    } catch (error) {
        console.error("Error in getParticipantDashboardData:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const createEvent = async (req, res) => {
    const event = normalizeEventDateFields(req.body);

    try {
        const requesterOrganizerId = await getRequesterOrganizerId(req);
        if (!Number.isInteger(requesterOrganizerId)) {
            return res.status(403).json({ success: false, message: "Organizer access required" });
        }

        if (!Number.isInteger(event.organizerId) || event.organizerId !== requesterOrganizerId) {
            return res.status(403).json({ success: false, message: "Organizer ID does not match authenticated organizer" });
        }

        if (
            event.eventType === "Normal Event" &&
            event.status === "Published" &&
            !hasValidRegistrationForm(event)
        ) {
            return res.status(400).json({
                success: false,
                message: "Normal event cannot be published without a valid registration form",
            });
        }

        const newEvent = new Event(event);
        await newEvent.save();

        if (newEvent.status === "Published") {
            try {
                const organizer = await User.findOne({
                    role: "Organizer",
                    organizerId: newEvent.organizerId,
                }).select("organizerName discordWebhookUrl");

                await sendEventPublishedWebhook({
                    webhookUrl: organizer?.discordWebhookUrl || "",
                    organizerName: organizer?.organizerName || "Organizer",
                    eventName: newEvent.eventName,
                    eventDescription: newEvent.eventDescription,
                    eventType: newEvent.eventType,
                    eventStartDate: newEvent.eventStartDate,
                    eventEndDate: newEvent.eventEndDate,
                    registrationDeadline: newEvent.registrationDeadline,
                });
            } catch (webhookError) {
                console.error("Failed to send Discord event publish webhook:", webhookError.message);
            }
        }

        res.status(201).json({ success: true, data: newEvent });
    } catch (error) {
        console.log("error in creating event: ", error.message);
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const updateEvent = async (req, res) => {
    const { id } = req.params;

    const event = normalizeEventDateFields(req.body);

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        const requesterOrganizerId = await getRequesterOrganizerId(req);
        if (!Number.isInteger(requesterOrganizerId)) {
            return res.status(403).json({ success: false, message: "Organizer access required" });
        }

        const existingEvent = await Event.findById(id);
        if (!existingEvent) {
            return res.status(404).json({ success: false, message: "Event Not Found" });
        }

        if (existingEvent.organizerId !== requesterOrganizerId) {
            return res.status(403).json({ success: false, message: "Not authorized to update this event" });
        }

        if (
            event.organizerId !== undefined &&
            (!Number.isInteger(event.organizerId) || event.organizerId !== requesterOrganizerId)
        ) {
            return res.status(403).json({ success: false, message: "Organizer ID does not match authenticated organizer" });
        }

        if (
            event.customForm !== undefined &&
            Array.isArray(existingEvent.registeredFormList) &&
            existingEvent.registeredFormList.length > 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Registration form is locked after the first registration is received.",
            });
        }

        if (event.status !== undefined) {
            const currentStatus = existingEvent.status || "Draft";
            const nextStatus = event.status;
            const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || new Set([currentStatus]);
            if (!allowedNext.has(nextStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status transition from ${currentStatus} to ${nextStatus}.`,
                });
            }
        }

        if (existingEvent.status === "Published") {
            const incomingFields = Object.keys(event || {});
            const disallowedField = incomingFields.find((field) => !PUBLISHED_EVENT_EDITABLE_FIELDS.has(field));
            if (disallowedField) {
                return res.status(400).json({
                    success: false,
                    message: "For published events, only description, registration deadline, registration limit, registration open, and status updates are allowed.",
                });
            }

            if (event.registrationDeadline !== undefined) {
                if (event.registrationDeadline === null) {
                    return res.status(400).json({
                        success: false,
                        message: "Published event registration deadline cannot be removed.",
                    });
                }

                const nextDeadline = new Date(event.registrationDeadline);
                if (Number.isNaN(nextDeadline.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid registration deadline value.",
                    });
                }

                if (existingEvent.registrationDeadline) {
                    const currentDeadline = new Date(existingEvent.registrationDeadline);
                    if (nextDeadline.getTime() < currentDeadline.getTime()) {
                        return res.status(400).json({
                            success: false,
                            message: "For published events, registration deadline can only be extended.",
                        });
                    }
                }
            }

            if (event.registrationLimit !== undefined) {
                if (event.registrationLimit === null && typeof existingEvent.registrationLimit === "number") {
                    return res.status(400).json({
                        success: false,
                        message: "For published events, registration limit cannot be removed.",
                    });
                }

                if (
                    typeof existingEvent.registrationLimit === "number" &&
                    typeof event.registrationLimit === "number" &&
                    event.registrationLimit < existingEvent.registrationLimit
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "For published events, registration limit can only be increased.",
                    });
                }
            }

            if (event.registrationOpen !== undefined && typeof event.registrationOpen !== "boolean") {
                return res.status(400).json({
                    success: false,
                    message: "registrationOpen must be a boolean.",
                });
            }

            if (event.status !== undefined && !["Published", "Ongoing", "Cancelled"].includes(event.status)) {
                return res.status(400).json({
                    success: false,
                    message: "Published events can only move to Ongoing or Cancelled.",
                });
            }
        }

        const nextEventType = event.eventType ?? existingEvent.eventType;
        const nextStatus = event.status ?? existingEvent.status;
        const nextCustomForm = event.customForm ?? existingEvent.customForm;

        if (
            nextEventType === "Normal Event" &&
            nextStatus === "Published" &&
            !hasValidRegistrationForm({
                eventType: nextEventType,
                isTeamEvent: event.isTeamEvent ?? existingEvent.isTeamEvent,
                customForm: nextCustomForm,
            })
        ) {
            return res.status(400).json({
                success: false,
                message: "Normal event cannot be published without a valid registration form",
            });
        }

        const wasPublishedBefore = existingEvent.status === "Published";
        const updatedEvent = await Event.findByIdAndUpdate(id, event, { new: true });

        if (!wasPublishedBefore && updatedEvent?.status === "Published") {
            try {
                const organizer = await User.findOne({
                    role: "Organizer",
                    organizerId: updatedEvent.organizerId,
                }).select("organizerName discordWebhookUrl");

                await sendEventPublishedWebhook({
                    webhookUrl: organizer?.discordWebhookUrl || "",
                    organizerName: organizer?.organizerName || "Organizer",
                    eventName: updatedEvent.eventName,
                    eventDescription: updatedEvent.eventDescription,
                    eventType: updatedEvent.eventType,
                    eventStartDate: updatedEvent.eventStartDate,
                    eventEndDate: updatedEvent.eventEndDate,
                    registrationDeadline: updatedEvent.registrationDeadline,
                });
            } catch (webhookError) {
                console.error("Failed to send Discord event publish webhook:", webhookError.message);
            }
        }

        res.status(200).json({ success: true, data: updatedEvent });
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const deleteEvent = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        const requesterOrganizerId = await getRequesterOrganizerId(req);
        if (!Number.isInteger(requesterOrganizerId)) {
            return res.status(403).json({ success: false, message: "Organizer access required" });
        }

        const existingEvent = await Event.findById(id);
        if (!existingEvent) {
            return res.status(404).json({ success: false, message: "Event Not Found" });
        }

        if (existingEvent.organizerId !== requesterOrganizerId) {
            return res.status(403).json({ success: false, message: "Not authorized to delete this event" });
        }

        await Event.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Event deleted" });
    } catch (error) {
        console.error("Error in Delete Event: ", error.message);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const registerForEvent = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        if (!req.user?.id || req.user?.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const [event, participant] = await Promise.all([
            Event.findById(id),
            User.findById(req.user.id),
        ]);

        const validationMessage = validateParticipantEventRegistration({
            event,
            participant,
            includePaidGuard: true,
        });
        if (validationMessage) {
            const statusCode =
                validationMessage === "Event Not Found" ? 404 :
                    validationMessage === "Participant access required" ? 403 : 400;
            return res.status(statusCode).json({ success: false, message: validationMessage });
        }

        if (event.isTeamEvent) {
            return res.status(400).json({
                success: false,
                message: "This is a team event. Please use Register as Team Leader.",
            });
        }

        const registrationDateTime = new Date();
        const formResponses = req.body?.formResponses || {};
        const formSnapshot = buildFormSnapshot(event, formResponses);

        event.registeredFormList.push({
            participantId: participant._id,
            formSnapshot,
            registeredAt: registrationDateTime,
        });
        participant.registeredEvents.push(event._id);

        await Promise.all([event.save(), participant.save()]);

        const organizer = await User.findOne({
            role: "Organizer",
            organizerId: event.organizerId,
        }).select("organizerName");

        const participantName =
            `${participant.firstName || ""} ${participant.lastName || ""}`.trim() || participant.email;

        const qrPayload = {
            type: "EventRegistration",
            ticketId: generateTicketId("EVT"),
            userId: String(participant._id),
            eventId: String(event._id),
            participantName,
            eventName: event.eventName,
            organizerName: organizer?.organizerName || "Unknown Organizer",
            registrationDateTime: registrationDateTime.toISOString(),
            eventStartDateTime: event.eventStartDate ? new Date(event.eventStartDate).toISOString() : null,
            eventEndDateTime: event.eventEndDate ? new Date(event.eventEndDate).toISOString() : null,
        };
        const qrCodeDataUrl = await generateQrDataUrlFromPayload(qrPayload);
        const registrationIndex = event.registeredFormList.length - 1;
        if (registrationIndex >= 0) {
            event.registeredFormList[registrationIndex].qrPayload = qrPayload;
            event.registeredFormList[registrationIndex].qrCodeDataUrl = qrCodeDataUrl;
        }

        await event.save();

        let ticketEmailSent = true;
        try {
            await sendRegistrationTicketEmail({
                recipientEmail: participant.email,
                userId: participant._id,
                eventId: event._id,
                participantName,
                eventName: event.eventName,
                organizerName: organizer?.organizerName || "Unknown Organizer",
                registrationDateTime,
                eventStartDateTime: event.eventStartDate || null,
                eventEndDateTime: event.eventEndDate || null,
                qrPayload,
                qrCodeDataUrl,
            });
        } catch (emailError) {
            ticketEmailSent = false;
            console.error("Failed to send registration ticket email:", emailError.message);
        }

        return res.status(200).json({
            success: true,
            message: ticketEmailSent
                ? "Successfully registered for event. Ticket sent to email."
                : "Successfully registered for event, but ticket email could not be sent.",
            data: {
                event,
                user: participant,
            },
        });
    } catch (error) {
        console.error("Error in registerForEvent:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const getMyEventFeedback = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        if (!req.user?.id || req.user?.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const [event, participant] = await Promise.all([
            Event.findById(id),
            User.findById(req.user.id),
        ]);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event Not Found" });
        }
        if (!participant || participant.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }
        if (event.eventType !== "Normal Event") {
            return res.status(400).json({ success: false, message: "Feedback is only available for normal events." });
        }

        const isRegistered = isParticipantAlreadyRegisteredForEvent(event, participant._id);
        const hasAttended = hasParticipantAttendedEvent(event);
        const participantHash = getFeedbackParticipantHash(participant._id, event._id);
        const existingFeedback = Array.isArray(event.feedbackList)
            ? event.feedbackList.find((entry) => entry.participantHash === participantHash)
            : null;

        return res.status(200).json({
            success: true,
            data: {
                isRegistered,
                hasAttended,
                canSubmit: isRegistered && hasAttended,
                feedback: existingFeedback
                    ? {
                        rating: existingFeedback.rating,
                        comment: existingFeedback.comment,
                        submittedAt: existingFeedback.submittedAt,
                    }
                    : null,
            },
        });
    } catch (error) {
        console.error("Error in getMyEventFeedback:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const submitEventFeedback = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        if (!req.user?.id || req.user?.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const [event, participant] = await Promise.all([
            Event.findById(id),
            User.findById(req.user.id),
        ]);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event Not Found" });
        }
        if (!participant || participant.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }
        if (event.eventType !== "Normal Event") {
            return res.status(400).json({ success: false, message: "Feedback is only available for normal events." });
        }

        const rating = Number(req.body?.rating);
        const comment = String(req.body?.comment || "").trim();
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: "Rating must be an integer between 1 and 5." });
        }
        if (!comment) {
            return res.status(400).json({ success: false, message: "Comment is required." });
        }

        if (!isParticipantAlreadyRegisteredForEvent(event, participant._id)) {
            return res.status(403).json({ success: false, message: "Only registered participants can submit feedback." });
        }
        if (!hasParticipantAttendedEvent(event)) {
            return res.status(400).json({ success: false, message: "Feedback can be submitted only after the event is completed." });
        }

        const participantHash = getFeedbackParticipantHash(participant._id, event._id);
        const existingFeedbackIndex = Array.isArray(event.feedbackList)
            ? event.feedbackList.findIndex((entry) => entry.participantHash === participantHash)
            : -1;
        const submittedAt = new Date();

        if (existingFeedbackIndex >= 0) {
            event.feedbackList[existingFeedbackIndex].rating = rating;
            event.feedbackList[existingFeedbackIndex].comment = comment;
            event.feedbackList[existingFeedbackIndex].submittedAt = submittedAt;
        } else {
            event.feedbackList.push({
                participantHash,
                rating,
                comment,
                submittedAt,
            });
        }

        await event.save();
        return res.status(200).json({
            success: true,
            message: existingFeedbackIndex >= 0 ? "Feedback updated successfully." : "Feedback submitted successfully.",
            data: {
                rating,
                comment,
                submittedAt,
            },
        });
    } catch (error) {
        console.error("Error in submitEventFeedback:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const createRegistrationPaymentRequest = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        if (!req.user?.id || req.user?.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const [event, participant] = await Promise.all([
            Event.findById(id),
            User.findById(req.user.id),
        ]);

        const validationMessage = validateParticipantEventRegistration({
            event,
            participant,
            includePaidGuard: false,
        });
        if (validationMessage) {
            const statusCode =
                validationMessage === "Event Not Found" ? 404 :
                    validationMessage === "Participant access required" ? 403 : 400;
            return res.status(statusCode).json({ success: false, message: validationMessage });
        }

        if (event.isTeamEvent) {
            return res.status(400).json({
                success: false,
                message: "Team event payments are not supported in this flow.",
            });
        }

        if (!(typeof event.registrationFee === "number" && event.registrationFee > 0)) {
            return res.status(400).json({ success: false, message: "This event does not require payment proof upload." });
        }

        const participantIdStr = String(participant._id);
        const alreadyPending = Array.isArray(event.pendingRegistrationRequests) &&
            event.pendingRegistrationRequests.some(
                (request) => String(request.participantId) === participantIdStr && request.status === "Pending"
            );
        if (alreadyPending) {
            return res.status(400).json({ success: false, message: "You already have a pending registration request for this event." });
        }

        const paymentProof = req.body?.paymentProof || null;
        if (!paymentProof || typeof paymentProof !== "object" || !paymentProof.contentBase64) {
            return res.status(400).json({ success: false, message: "Payment proof is required." });
        }

        const formResponses = req.body?.formResponses || {};
        const formSnapshot = buildFormSnapshot(event, formResponses);
        const participantName = `${participant.firstName || ""} ${participant.lastName || ""}`.trim() || participant.email;

        event.pendingRegistrationRequests.push({
            participantId: participant._id,
            participantName,
            participantEmail: participant.email || "",
            formSnapshot,
            paymentAmount: event.registrationFee,
            paymentProof: {
                name: paymentProof.name || "",
                type: paymentProof.type || "",
                size: Number(paymentProof.size) || 0,
                contentBase64: paymentProof.contentBase64 || "",
            },
            requestedAt: new Date(),
            status: "Pending",
        });

        await event.save();
        return res.status(200).json({
            success: true,
            message: "Payment proof uploaded. Waiting for organizer approval.",
            data: event,
        });
    } catch (error) {
        console.error("Error in createRegistrationPaymentRequest:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const isPaidTeamEvent = (event) =>
    Boolean(event?.isTeamEvent) && typeof event?.registrationFee === "number" && event.registrationFee > 0;

const finalizeTeamRegistration = async ({ event, teamRequest }) => {
    const participantIds = [
        String(teamRequest.participantId),
        ...(Array.isArray(teamRequest.teamMembers) ? teamRequest.teamMembers.map((entry) => String(entry.participantId)) : []),
    ];

    const participants = await User.find({ _id: { $in: participantIds } });
    const participantById = new Map(participants.map((participant) => [String(participant._id), participant]));

    for (const participantId of participantIds) {
        const participant = participantById.get(participantId);
        if (!participant || participant.role !== "Participant") {
            return { success: false, message: "One or more team members are invalid." };
        }
        if (event.eligibility === "Must be a IIIT Student" && participant.isIIIT !== true) {
            return { success: false, message: "One or more team members are not eligible for this event." };
        }
        if (isParticipantAlreadyRegisteredForEvent(event, participant._id)) {
            return { success: false, message: "One or more team members are already registered for this event." };
        }
    }

    const existingRegisteredCount = Array.isArray(event.registeredFormList) ? event.registeredFormList.length : 0;
    if (typeof event.registrationLimit === "number" && existingRegisteredCount + participantIds.length > event.registrationLimit) {
        return { success: false, message: "Registration limit reached for this event." };
    }

    const organizer = await User.findOne({
        role: "Organizer",
        organizerId: event.organizerId,
    }).select("organizerName");

    const registrationDateTime = new Date();
    const registrationEntries = [];

    const leaderParticipant = participantById.get(String(teamRequest.participantId));
    registrationEntries.push({
        participant: leaderParticipant,
        formSnapshot: Array.isArray(teamRequest.formSnapshot) ? teamRequest.formSnapshot : [],
    });
    (Array.isArray(teamRequest.teamMembers) ? teamRequest.teamMembers : []).forEach((memberEntry) => {
        const participant = participantById.get(String(memberEntry.participantId));
        if (participant) {
            registrationEntries.push({
                participant,
                formSnapshot: Array.isArray(memberEntry.formSnapshot) ? memberEntry.formSnapshot : [],
            });
        }
    });

    for (const entry of registrationEntries) {
        const participant = entry.participant;
        const participantName = `${participant.firstName || ""} ${participant.lastName || ""}`.trim() || participant.email;
        const qrPayload = {
            type: "EventRegistration",
            ticketId: generateTicketId("EVT"),
            userId: String(participant._id),
            eventId: String(event._id),
            participantName,
            eventName: event.eventName,
            organizerName: organizer?.organizerName || "Unknown Organizer",
            registrationDateTime: registrationDateTime.toISOString(),
            eventStartDateTime: event.eventStartDate ? new Date(event.eventStartDate).toISOString() : null,
            eventEndDateTime: event.eventEndDate ? new Date(event.eventEndDate).toISOString() : null,
            teamJoinCode: teamRequest.teamJoinCode || "",
        };
        const qrCodeDataUrl = await generateQrDataUrlFromPayload(qrPayload);
        event.registeredFormList.push({
            participantId: participant._id,
            formSnapshot: entry.formSnapshot,
            registeredAt: registrationDateTime,
            qrPayload,
            qrCodeDataUrl,
        });
        if (!Array.isArray(participant.registeredEvents)) {
            participant.registeredEvents = [];
        }
        const alreadyInUser = participant.registeredEvents.some((eventId) => String(eventId) === String(event._id));
        if (!alreadyInUser) {
            participant.registeredEvents.push(event._id);
        }
    }

    teamRequest.status = "Approved";
    teamRequest.reviewedAt = new Date();

    await Promise.all([event.save(), ...participants.map((participant) => participant.save())]);

    await Promise.all(
        registrationEntries.map(async ({ participant }) => {
            const registeredEntry = event.registeredFormList.find(
                (item) => String(item.participantId) === String(participant._id)
            );
            const participantName = `${participant.firstName || ""} ${participant.lastName || ""}`.trim() || participant.email;
            try {
                await sendRegistrationTicketEmail({
                    recipientEmail: participant.email,
                    userId: participant._id,
                    eventId: event._id,
                    participantName,
                    eventName: event.eventName,
                    organizerName: organizer?.organizerName || "Unknown Organizer",
                    registrationDateTime,
                    eventStartDateTime: event.eventStartDate || null,
                    eventEndDateTime: event.eventEndDate || null,
                    qrCodeDataUrl: registeredEntry?.qrCodeDataUrl || "",
                });
            } catch (emailError) {
                console.error("Failed to send team registration ticket email:", emailError.message);
            }
        })
    );

    return {
        success: true,
        data: {
            status: "Approved",
            currentTeamSize: registrationEntries.length,
            targetTeamSize: Number.isInteger(teamRequest.targetTeamSize) ? teamRequest.targetTeamSize : registrationEntries.length,
        },
    };
};

export const createTeamRegistrationRequest = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        if (!req.user?.id || req.user?.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const [event, leader] = await Promise.all([
            Event.findById(id),
            User.findById(req.user.id),
        ]);

        const validationMessage = validateParticipantEventRegistration({
            event,
            participant: leader,
            includePaidGuard: false,
        });
        if (validationMessage) {
            const statusCode =
                validationMessage === "Event Not Found" ? 404 :
                    validationMessage === "Participant access required" ? 403 : 400;
            return res.status(statusCode).json({ success: false, message: validationMessage });
        }

        if (!event.isTeamEvent) {
            return res.status(400).json({ success: false, message: "This endpoint is only for team events." });
        }

        const minTeamSize = Number.isInteger(event.minTeamSize) ? event.minTeamSize : 1;
        const maxTeamSize = Number.isInteger(event.maxTeamSize) ? event.maxTeamSize : minTeamSize;
        const targetTeamSizeRaw = Number(req.body?.targetTeamSize);
        const targetTeamSize = Number.isInteger(targetTeamSizeRaw) ? targetTeamSizeRaw : minTeamSize;
        if (targetTeamSize < minTeamSize || targetTeamSize > maxTeamSize) {
            return res.status(400).json({
                success: false,
                message: `Team size must be between ${minTeamSize} and ${maxTeamSize}.`,
            });
        }

        const pendingRequests = Array.isArray(event.pendingRegistrationRequests) ? event.pendingRegistrationRequests : [];
        const existingPending = pendingRequests.find(
            (request) =>
                request.status === "Pending" &&
                (
                    String(request.participantId) === String(leader._id) ||
                    (Array.isArray(request.teamMembers) && request.teamMembers.some((member) => String(member.participantId) === String(leader._id)))
                )
        );
        if (existingPending) {
            return res.status(400).json({
                success: false,
                message: "You already have a pending team registration for this event.",
            });
        }

        const leaderFields = Array.isArray(event.customForm?.leaderFields) ? event.customForm.leaderFields : [];
        if (leaderFields.length === 0) {
            return res.status(400).json({ success: false, message: "Team leader form is not configured for this event." });
        }

        const leaderFormResponses = req.body?.formResponses && typeof req.body.formResponses === "object"
            ? req.body.formResponses
            : {};
        const leaderSnapshot = buildFormSnapshotFromFields(leaderFields, leaderFormResponses, "[Leader] ");

        const teamJoinCode = crypto.randomBytes(12).toString("hex");
        const frontendBaseUrl = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
        const teamJoinLink = `${frontendBaseUrl}/participant/events/${event._id}/join/${teamJoinCode}`;
        const leaderName = `${leader.firstName || ""} ${leader.lastName || ""}`.trim() || leader.email;

        event.pendingRegistrationRequests.push({
            participantId: leader._id,
            participantName: leaderName,
            participantEmail: leader.email || "",
            formSnapshot: leaderSnapshot,
            paymentAmount: typeof event.registrationFee === "number" ? event.registrationFee : 0,
            requestedAt: new Date(),
            status: "Pending",
            isTeamRegistration: true,
            targetTeamSize,
            teamJoinCode,
            teamJoinLink,
            teamMembers: [],
            leaderPaymentAmount: typeof event.registrationFee === "number" ? event.registrationFee : 0,
            leaderPaymentStatus: isPaidTeamEvent(event) ? "PendingSubmission" : "Approved",
            leaderPaymentReviewedAt: isPaidTeamEvent(event) ? null : new Date(),
            leaderPaymentProof: null,
        });

        await event.save();
        const requiresPayment = isPaidTeamEvent(event);
        return res.status(200).json({
            success: true,
            message: requiresPayment
                ? "Team created. Share the join link and upload your payment proof."
                : "Team leader registration submitted. Share the team join link with team members.",
            data: {
                teamJoinCode,
                teamJoinLink,
                targetTeamSize,
                currentTeamSize: 1,
                status: "Pending",
                requiresPayment,
                paymentAmount: typeof event.registrationFee === "number" ? event.registrationFee : 0,
            },
        });
    } catch (error) {
        console.error("Error in createTeamRegistrationRequest:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const joinTeamRegistrationRequest = async (req, res) => {
    const { id, teamCode } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        if (!req.user?.id || req.user?.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const [event, member] = await Promise.all([
            Event.findById(id),
            User.findById(req.user.id),
        ]);

        if (!event) {
            return res.status(404).json({ success: false, message: "Event Not Found" });
        }
        if (!member || member.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }
        if (!event.isTeamEvent) {
            return res.status(400).json({ success: false, message: "This endpoint is only for team events." });
        }
        if (event.status !== "Published" && event.status !== "Ongoing") {
            return res.status(400).json({ success: false, message: "Registration is not open for this event" });
        }
        if (event.registrationOpen === false) {
            return res.status(400).json({ success: false, message: "Registration is currently closed by organizer" });
        }
        if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
            return res.status(400).json({ success: false, message: "Registration deadline has passed" });
        }
        if (event.eligibility === "Must be a IIIT Student" && member.isIIIT !== true) {
            return res.status(400).json({ success: false, message: "This event is only for IIIT students" });
        }
        if (isParticipantAlreadyRegisteredForEvent(event, member._id)) {
            return res.status(400).json({ success: false, message: "You are already registered for this event" });
        }

        const teamRequest = Array.isArray(event.pendingRegistrationRequests)
            ? event.pendingRegistrationRequests.find(
                (request) =>
                    request.status === "Pending" &&
                    request.isTeamRegistration === true &&
                    request.teamJoinCode === teamCode
            )
            : null;
        if (!teamRequest) {
            return res.status(404).json({ success: false, message: "Team join link is invalid or expired." });
        }

        if (String(teamRequest.participantId) === String(member._id)) {
            return res.status(400).json({ success: false, message: "Leader cannot join own team link as member." });
        }

        const alreadyMember = Array.isArray(teamRequest.teamMembers)
            ? teamRequest.teamMembers.some((entry) => String(entry.participantId) === String(member._id))
            : false;
        if (alreadyMember) {
            return res.status(400).json({ success: false, message: "You have already joined this team." });
        }

        const inAnotherPendingTeam = Array.isArray(event.pendingRegistrationRequests)
            ? event.pendingRegistrationRequests.some(
                (request) =>
                    request.status === "Pending" &&
                    request.isTeamRegistration === true &&
                    request.teamJoinCode !== teamCode &&
                    (
                        String(request.participantId) === String(member._id) ||
                        (Array.isArray(request.teamMembers) && request.teamMembers.some((entry) => String(entry.participantId) === String(member._id)))
                    )
            )
            : false;
        if (inAnotherPendingTeam) {
            return res.status(400).json({ success: false, message: "You are already part of another pending team for this event." });
        }

        const targetTeamSize = Number.isInteger(teamRequest.targetTeamSize) ? teamRequest.targetTeamSize : 1;
        const currentTeamSize = 1 + (Array.isArray(teamRequest.teamMembers) ? teamRequest.teamMembers.length : 0);
        if (currentTeamSize >= targetTeamSize) {
            return res.status(400).json({ success: false, message: "This team is already full." });
        }

        const memberFields = Array.isArray(event.customForm?.memberFields) ? event.customForm.memberFields : [];
        if (memberFields.length === 0) {
            return res.status(400).json({ success: false, message: "Team member form is not configured for this event." });
        }

        const memberFormResponses = req.body?.formResponses && typeof req.body.formResponses === "object"
            ? req.body.formResponses
            : {};
        const memberSnapshot = buildFormSnapshotFromFields(
            memberFields,
            memberFormResponses,
            `[Member ${currentTeamSize}] `
        );
        const memberName = `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email;

        teamRequest.teamMembers.push({
            participantId: member._id,
            participantName: memberName,
            participantEmail: member.email || "",
            formSnapshot: memberSnapshot,
            paymentAmount: typeof event.registrationFee === "number" ? event.registrationFee : 0,
            paymentProof: null,
            paymentStatus: isPaidTeamEvent(event) ? "PendingSubmission" : "Approved",
            paymentReviewedAt: isPaidTeamEvent(event) ? null : new Date(),
            joinedAt: new Date(),
        });

        const updatedTeamSize = 1 + teamRequest.teamMembers.length;
        if (updatedTeamSize < targetTeamSize) {
            await event.save();
            return res.status(200).json({
                success: true,
                message: "Joined team successfully. Waiting for more members.",
                data: {
                    status: "Pending",
                    currentTeamSize: updatedTeamSize,
                    targetTeamSize,
                    requiresPayment: isPaidTeamEvent(event),
                    paymentAmount: typeof event.registrationFee === "number" ? event.registrationFee : 0,
                },
            });
        }

        if (isPaidTeamEvent(event)) {
            await event.save();
            return res.status(200).json({
                success: true,
                message: "Joined team successfully. Upload payment proof for organizer verification.",
                data: {
                    status: "Pending",
                    currentTeamSize: updatedTeamSize,
                    targetTeamSize,
                    requiresPayment: true,
                    paymentAmount: event.registrationFee,
                },
            });
        }

        const finalizeResult = await finalizeTeamRegistration({ event, teamRequest });
        if (!finalizeResult.success) {
            return res.status(400).json({ success: false, message: finalizeResult.message });
        }

        return res.status(200).json({
            success: true,
            message: "Team registration approved automatically. Team has been registered successfully.",
            data: finalizeResult.data,
        });
    } catch (error) {
        console.error("Error in joinTeamRegistrationRequest:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const submitTeamRegistrationPaymentProof = async (req, res) => {
    const { id, teamCode } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        if (!req.user?.id || req.user?.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const event = await Event.findById(id);
        if (!event || !event.isTeamEvent) {
            return res.status(404).json({ success: false, message: "Team event not found" });
        }
        if (!isPaidTeamEvent(event)) {
            return res.status(400).json({ success: false, message: "Team payment proof is only required for paid team events." });
        }

        const teamRequest = Array.isArray(event.pendingRegistrationRequests)
            ? event.pendingRegistrationRequests.find(
                (request) =>
                    request.status === "Pending" &&
                    request.isTeamRegistration === true &&
                    request.teamJoinCode === teamCode
            )
            : null;
        if (!teamRequest) {
            return res.status(404).json({ success: false, message: "Team request not found." });
        }

        const paymentProof = req.body?.paymentProof || null;
        if (!paymentProof || typeof paymentProof !== "object" || !paymentProof.contentBase64) {
            return res.status(400).json({ success: false, message: "Payment proof is required." });
        }

        const requesterId = String(req.user.id);
        const isLeader = String(teamRequest.participantId) === requesterId;
        const memberIndex = Array.isArray(teamRequest.teamMembers)
            ? teamRequest.teamMembers.findIndex((member) => String(member.participantId) === requesterId)
            : -1;

        if (!isLeader && memberIndex < 0) {
            return res.status(403).json({ success: false, message: "You are not part of this team." });
        }

        const normalizedProof = {
            name: paymentProof.name || "",
            type: paymentProof.type || "",
            size: Number(paymentProof.size) || 0,
            contentBase64: paymentProof.contentBase64 || "",
        };

        if (isLeader) {
            teamRequest.leaderPaymentProof = normalizedProof;
            teamRequest.leaderPaymentStatus = "Pending";
            teamRequest.leaderPaymentReviewedAt = null;
            teamRequest.leaderPaymentAmount = event.registrationFee;
        } else {
            teamRequest.teamMembers[memberIndex].paymentProof = normalizedProof;
            teamRequest.teamMembers[memberIndex].paymentStatus = "Pending";
            teamRequest.teamMembers[memberIndex].paymentReviewedAt = null;
            teamRequest.teamMembers[memberIndex].paymentAmount = event.registrationFee;
        }

        await event.save();
        return res.status(200).json({
            success: true,
            message: "Payment proof submitted. Waiting for organizer verification.",
            data: {
                teamCode: teamRequest.teamJoinCode || "",
                status: "Pending",
            },
        });
    } catch (error) {
        console.error("Error in submitTeamRegistrationPaymentProof:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const reviewTeamMemberPaymentProof = async (req, res) => {
    const { id, requestId, participantId } = req.params;
    const action = String(req.body?.action || "").toLowerCase();

    if (
        !mongoose.Types.ObjectId.isValid(id) ||
        !mongoose.Types.ObjectId.isValid(requestId) ||
        !mongoose.Types.ObjectId.isValid(participantId)
    ) {
        return res.status(404).json({ success: false, message: "Event, request, or participant not found" });
    }
    if (action !== "approve" && action !== "reject") {
        return res.status(400).json({ success: false, message: "Action must be approve or reject" });
    }

    try {
        const requesterOrganizerId = await getRequesterOrganizerId(req);
        if (!Number.isInteger(requesterOrganizerId)) {
            return res.status(403).json({ success: false, message: "Organizer access required" });
        }

        const event = await Event.findById(id);
        if (!event || !event.isTeamEvent) {
            return res.status(404).json({ success: false, message: "Team event not found" });
        }
        if (!isPaidTeamEvent(event)) {
            return res.status(400).json({ success: false, message: "This event does not require team payment approvals." });
        }
        if (event.organizerId !== requesterOrganizerId) {
            return res.status(403).json({ success: false, message: "Not authorized to review this event" });
        }

        const teamRequest = Array.isArray(event.pendingRegistrationRequests)
            ? event.pendingRegistrationRequests.find(
                (request) =>
                    String(request._id) === String(requestId) &&
                    request.isTeamRegistration === true &&
                    request.status === "Pending"
            )
            : null;
        if (!teamRequest) {
            return res.status(404).json({ success: false, message: "Pending team registration request not found." });
        }

        const targetParticipantId = String(participantId);
        const now = new Date();
        if (String(teamRequest.participantId) === targetParticipantId) {
            if (!teamRequest.leaderPaymentProof?.contentBase64) {
                return res.status(400).json({ success: false, message: "Leader payment proof is not submitted yet." });
            }
            teamRequest.leaderPaymentStatus = action === "approve" ? "Approved" : "Rejected";
            teamRequest.leaderPaymentReviewedAt = now;
        } else {
            const memberIndex = Array.isArray(teamRequest.teamMembers)
                ? teamRequest.teamMembers.findIndex((member) => String(member.participantId) === targetParticipantId)
                : -1;
            if (memberIndex < 0) {
                return res.status(404).json({ success: false, message: "Team member not found in this request." });
            }
            if (!teamRequest.teamMembers[memberIndex].paymentProof?.contentBase64) {
                return res.status(400).json({ success: false, message: "Member payment proof is not submitted yet." });
            }
            teamRequest.teamMembers[memberIndex].paymentStatus = action === "approve" ? "Approved" : "Rejected";
            teamRequest.teamMembers[memberIndex].paymentReviewedAt = now;
        }

        const targetTeamSize = Number.isInteger(teamRequest.targetTeamSize) ? teamRequest.targetTeamSize : 1;
        const currentTeamSize = 1 + (Array.isArray(teamRequest.teamMembers) ? teamRequest.teamMembers.length : 0);
        const allPaymentsApproved =
            teamRequest.leaderPaymentStatus === "Approved" &&
            (Array.isArray(teamRequest.teamMembers) ? teamRequest.teamMembers.every((member) => member.paymentStatus === "Approved") : true);

        if (currentTeamSize >= targetTeamSize && allPaymentsApproved) {
            const finalizeResult = await finalizeTeamRegistration({ event, teamRequest });
            if (!finalizeResult.success) {
                return res.status(400).json({ success: false, message: finalizeResult.message });
            }
            return res.status(200).json({
                success: true,
                message: "Payment approved. All team payments verified and registration completed.",
                data: event,
            });
        }

        await event.save();
        return res.status(200).json({
            success: true,
            message: action === "approve"
                ? "Payment proof approved."
                : "Payment proof rejected. Participant can re-upload proof.",
            data: event,
        });
    } catch (error) {
        console.error("Error in reviewTeamMemberPaymentProof:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const getTeamChatMessages = async (req, res) => {
    const { id, teamCode } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        if (!req.user?.id || req.user?.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const event = await Event.findById(id);
        if (!event || !event.isTeamEvent) {
            return res.status(404).json({ success: false, message: "Team event not found" });
        }

        const teamRequest = Array.isArray(event.pendingRegistrationRequests)
            ? event.pendingRegistrationRequests.find(
                (request) =>
                    request.isTeamRegistration === true &&
                    request.teamJoinCode === teamCode
            )
            : null;
        if (!teamRequest) {
            return res.status(404).json({ success: false, message: "Team not found" });
        }

        const isMember =
            String(teamRequest.participantId) === String(req.user.id) ||
            (Array.isArray(teamRequest.teamMembers) &&
                teamRequest.teamMembers.some((member) => String(member.participantId) === String(req.user.id)));
        if (!isMember) {
            return res.status(403).json({ success: false, message: "Not a member of this team" });
        }

        const typingTtlMs = 8000;
        const now = Date.now();
        const typingUsers = Array.isArray(teamRequest.teamTypingUsers) ? teamRequest.teamTypingUsers : [];
        const activeTypingUsers = typingUsers.filter((entry) => {
            const updated = new Date(entry.updatedAt || 0).getTime();
            return !Number.isNaN(updated) && now - updated <= typingTtlMs;
        });
        if (activeTypingUsers.length !== typingUsers.length) {
            teamRequest.teamTypingUsers = activeTypingUsers;
            await event.save();
        }

        const messages = Array.isArray(teamRequest.teamChatMessages)
            ? [...teamRequest.teamChatMessages].sort(
                (a, b) => new Date(a.sentAt || 0).getTime() - new Date(b.sentAt || 0).getTime()
            )
            : [];

        return res.status(200).json({
            success: true,
            data: {
                eventId: String(event._id),
                eventName: event.eventName || "Team Event",
                teamCode: teamRequest.teamJoinCode || "",
                messages,
                typingUsers: activeTypingUsers.map((entry) => ({
                    participantId: String(entry.participantId),
                    participantName: entry.participantName || "Participant",
                })),
            },
        });
    } catch (error) {
        console.error("Error in getTeamChatMessages:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const sendTeamChatMessage = async (req, res) => {
    const { id, teamCode } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        if (!req.user?.id || req.user?.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const message = String(req.body?.message || "").trim();
        const file = req.file || null;

        if (!message && !file) {
            return res.status(400).json({ success: false, message: "Message or file is required" });
        }
        if (message.length > 1000) {
            return res.status(400).json({ success: false, message: "Message is too long" });
        }

        const [event, sender] = await Promise.all([
            Event.findById(id),
            User.findById(req.user.id),
        ]);
        if (!event || !event.isTeamEvent) {
            return res.status(404).json({ success: false, message: "Team event not found" });
        }
        if (!sender || sender.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const teamRequest = Array.isArray(event.pendingRegistrationRequests)
            ? event.pendingRegistrationRequests.find(
                (request) =>
                    request.isTeamRegistration === true &&
                    request.teamJoinCode === teamCode
            )
            : null;
        if (!teamRequest) {
            return res.status(404).json({ success: false, message: "Team not found" });
        }

        const isMember =
            String(teamRequest.participantId) === String(req.user.id) ||
            (Array.isArray(teamRequest.teamMembers) &&
                teamRequest.teamMembers.some((member) => String(member.participantId) === String(req.user.id)));
        if (!isMember) {
            return res.status(403).json({ success: false, message: "Not a member of this team" });
        }

        const senderName = `${sender.firstName || ""} ${sender.lastName || ""}`.trim() || sender.email;

        const chatEntry = {
            senderId: sender._id,
            senderName,
            message: message || "",
            sentAt: new Date(),
        };

        if (file) {
            chatEntry.fileUrl = `/uploads/chat/${file.filename}`;
            chatEntry.fileName = file.originalname || file.filename;
            chatEntry.fileType = file.mimetype || "";
        }

        teamRequest.teamChatMessages.push(chatEntry);
        if (Array.isArray(teamRequest.teamTypingUsers)) {
            teamRequest.teamTypingUsers = teamRequest.teamTypingUsers.filter(
                (entry) => String(entry.participantId) !== String(sender._id)
            );
        }

        await event.save();

        const messages = Array.isArray(teamRequest.teamChatMessages)
            ? [...teamRequest.teamChatMessages].sort(
                (a, b) => new Date(a.sentAt || 0).getTime() - new Date(b.sentAt || 0).getTime()
            )
            : [];

        return res.status(200).json({
            success: true,
            message: "Message sent",
            data: {
                eventId: String(event._id),
                eventName: event.eventName || "Team Event",
                teamCode: teamRequest.teamJoinCode || "",
                messages,
                typingUsers: Array.isArray(teamRequest.teamTypingUsers)
                    ? teamRequest.teamTypingUsers.map((entry) => ({
                        participantId: String(entry.participantId),
                        participantName: entry.participantName || "Participant",
                    }))
                    : [],
            },
        });
    } catch (error) {
        console.error("Error in sendTeamChatMessage:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const updateTeamTypingStatus = async (req, res) => {
    const { id, teamCode } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        if (!req.user?.id || req.user?.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const { isTyping } = req.body || {};
        if (typeof isTyping !== "boolean") {
            return res.status(400).json({ success: false, message: "isTyping must be a boolean" });
        }

        const [event, sender] = await Promise.all([
            Event.findById(id),
            User.findById(req.user.id),
        ]);
        if (!event || !event.isTeamEvent) {
            return res.status(404).json({ success: false, message: "Team event not found" });
        }
        if (!sender || sender.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const teamRequest = Array.isArray(event.pendingRegistrationRequests)
            ? event.pendingRegistrationRequests.find(
                (request) =>
                    request.isTeamRegistration === true &&
                    request.teamJoinCode === teamCode
            )
            : null;
        if (!teamRequest) {
            return res.status(404).json({ success: false, message: "Team not found" });
        }

        const isMember =
            String(teamRequest.participantId) === String(req.user.id) ||
            (Array.isArray(teamRequest.teamMembers) &&
                teamRequest.teamMembers.some((member) => String(member.participantId) === String(req.user.id)));
        if (!isMember) {
            return res.status(403).json({ success: false, message: "Not a member of this team" });
        }

        const senderName = `${sender.firstName || ""} ${sender.lastName || ""}`.trim() || sender.email;
        const existingTypingUsers = Array.isArray(teamRequest.teamTypingUsers) ? [...teamRequest.teamTypingUsers] : [];
        const withoutSelf = existingTypingUsers.filter((entry) => String(entry.participantId) !== String(sender._id));

        if (isTyping) {
            withoutSelf.push({
                participantId: sender._id,
                participantName: senderName,
                updatedAt: new Date(),
            });
        }

        const typingTtlMs = 8000;
        const now = Date.now();
        const activeTypingUsers = withoutSelf.filter((entry) => {
            const updated = new Date(entry.updatedAt || 0).getTime();
            return !Number.isNaN(updated) && now - updated <= typingTtlMs;
        });

        teamRequest.teamTypingUsers = activeTypingUsers;
        await event.save();

        return res.status(200).json({
            success: true,
            data: {
                typingUsers: activeTypingUsers.map((entry) => ({
                    participantId: String(entry.participantId),
                    participantName: entry.participantName || "Participant",
                })),
            },
        });
    } catch (error) {
        console.error("Error in updateTeamTypingStatus:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const reviewRegistrationPaymentRequest = async (req, res) => {
    const { id, requestId } = req.params;
    const action = String(req.body?.action || "").toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(404).json({ success: false, message: "Event or request not found" });
    }
    if (action !== "approve" && action !== "reject") {
        return res.status(400).json({ success: false, message: "Action must be approve or reject" });
    }

    try {
        const requesterOrganizerId = await getRequesterOrganizerId(req);
        if (!Number.isInteger(requesterOrganizerId)) {
            return res.status(403).json({ success: false, message: "Organizer access required" });
        }

        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event Not Found" });
        }
        if (event.organizerId !== requesterOrganizerId) {
            return res.status(403).json({ success: false, message: "Not authorized to review requests for this event" });
        }

        const requestEntry = Array.isArray(event.pendingRegistrationRequests)
            ? event.pendingRegistrationRequests.find((request) => String(request._id) === String(requestId))
            : null;
        if (!requestEntry) {
            return res.status(404).json({ success: false, message: "Registration request not found" });
        }
        if (requestEntry.status !== "Pending") {
            return res.status(400).json({ success: false, message: "This request has already been reviewed" });
        }
        if (requestEntry.isTeamRegistration === true) {
            return res.status(400).json({
                success: false,
                message: "Team registration requests are auto-approved when team size is met.",
            });
        }

        if (action === "reject") {
            requestEntry.status = "Rejected";
            requestEntry.reviewedAt = new Date();
            await event.save();
            return res.status(200).json({ success: true, message: "Registration request rejected.", data: event });
        }

        const participant = await User.findById(requestEntry.participantId);
        const validationMessage = validateParticipantEventRegistration({
            event,
            participant,
            includePaidGuard: false,
        });
        if (validationMessage) {
            return res.status(400).json({ success: false, message: validationMessage });
        }

        const registrationDateTime = new Date();
        event.registeredFormList.push({
            participantId: participant._id,
            formSnapshot: Array.isArray(requestEntry.formSnapshot) ? requestEntry.formSnapshot : [],
            registeredAt: registrationDateTime,
        });
        participant.registeredEvents.push(event._id);

        const organizer = await User.findOne({
            role: "Organizer",
            organizerId: event.organizerId,
        }).select("organizerName");

        const participantName = requestEntry.participantName ||
            (`${participant.firstName || ""} ${participant.lastName || ""}`.trim() || participant.email);
        const qrPayload = {
            type: "EventRegistration",
            ticketId: generateTicketId("EVT"),
            userId: String(participant._id),
            eventId: String(event._id),
            participantName,
            eventName: event.eventName,
            organizerName: organizer?.organizerName || "Unknown Organizer",
            registrationDateTime: registrationDateTime.toISOString(),
            eventStartDateTime: event.eventStartDate ? new Date(event.eventStartDate).toISOString() : null,
            eventEndDateTime: event.eventEndDate ? new Date(event.eventEndDate).toISOString() : null,
        };
        const qrCodeDataUrl = await generateQrDataUrlFromPayload(qrPayload);
        const registrationIndex = event.registeredFormList.length - 1;
        if (registrationIndex >= 0) {
            event.registeredFormList[registrationIndex].qrPayload = qrPayload;
            event.registeredFormList[registrationIndex].qrCodeDataUrl = qrCodeDataUrl;
        }

        requestEntry.status = "Approved";
        requestEntry.reviewedAt = new Date();

        await Promise.all([event.save(), participant.save()]);

        let ticketEmailSent = true;
        try {
            await sendRegistrationTicketEmail({
                recipientEmail: participant.email,
                userId: participant._id,
                eventId: event._id,
                participantName,
                eventName: event.eventName,
                organizerName: organizer?.organizerName || "Unknown Organizer",
                registrationDateTime,
                eventStartDateTime: event.eventStartDate || null,
                eventEndDateTime: event.eventEndDate || null,
                qrCodeDataUrl,
            });
        } catch (emailError) {
            ticketEmailSent = false;
            console.error("Failed to send registration ticket email:", emailError.message);
        }

        return res.status(200).json({
            success: true,
            message: ticketEmailSent
                ? "Registration request approved and participant registered."
                : "Registration approved but ticket email could not be sent.",
            data: event,
        });
    } catch (error) {
        console.error("Error in reviewRegistrationPaymentRequest:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const recordEventVisit = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        if (!req.user?.id || req.user?.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event Not Found" });
        }

        pruneOldVisits(event);
        event.visitsTimeStamps.push(new Date());
        await event.save();

        return res.status(200).json({
            success: true,
            data: {
                visitsTimeStamps: event.visitsTimeStamps,
                visitsCount: event.visitsTimeStamps.length,
            },
        });
    } catch (error) {
        console.error("Error in recordEventVisit:", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};
