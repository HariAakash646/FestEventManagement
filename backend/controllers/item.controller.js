import mongoose from "mongoose";

import Event from "../models/event.model.js";
import Item from "../models/item.model.js";
import User from "../models/user.model.js";
import { sendMerchPurchaseEmail } from "../utils/email.js";
import { generateQrDataUrlFromPayload } from "../utils/qr.js";

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

const normalizeStringArray = (values) => {
    if (!Array.isArray(values)) return [];
    return [...new Set(values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean))];
};

const validatePurchaseEligibility = ({ item, participant, event, quantity, selectedColor = "", selectedSize = "" }) => {
    if (!item) return "Item Not Found";
    if (!participant || participant.role !== "Participant") return "Participant access required";
    if (!event) return "Event Not Found";
    if (event.eventType !== "Merchandise Event") return "This item is not linked to a merchandise event";
    if (event.status !== "Published" && event.status !== "Ongoing") return "Purchases are not open for this event";
    if (!Number.isInteger(quantity) || quantity < 1) return "quantity must be an integer >= 1";
    if (item.stockAvailable < quantity) return "Insufficient stock available";

    const allowedColors = normalizeStringArray(item.colorOptions);
    const allowedSizes = normalizeStringArray(item.sizeOptions);
    if (allowedColors.length > 0 && !allowedColors.includes(selectedColor)) {
        return "Please choose a valid color option";
    }
    if (allowedSizes.length > 0 && !allowedSizes.includes(selectedSize)) {
        return "Please choose a valid size option";
    }

    const participantId = String(participant._id);
    const alreadyPurchasedCount = Array.isArray(item.purchasedBy)
        ? item.purchasedBy.filter((userId) => String(userId) === participantId).length
        : 0;
    if (
        typeof item.purchaseLimitPerParticipant === "number" &&
        alreadyPurchasedCount + quantity > item.purchaseLimitPerParticipant
    ) {
        return "Per participant purchase limit exceeded";
    }

    return "";
};

export const getItemsByEvent = async (req, res) => {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(404).json({ success: false, message: "Event Not Found" });
    }

    try {
        const shouldUseLite = String(req.query?.lite || "").toLowerCase() === "true";
        const participantObjectId =
            req.user?.role === "Participant" && mongoose.Types.ObjectId.isValid(req.user?.id)
                ? new mongoose.Types.ObjectId(req.user.id)
                : null;

        if (shouldUseLite) {
            const matchStage = { eventId: new mongoose.Types.ObjectId(eventId) };
            const items = await Item.aggregate([
                { $match: matchStage },
                { $sort: { createdAt: 1 } },
                {
                    $project: {
                        eventId: 1,
                        organizerId: 1,
                        itemName: 1,
                        colorOptions: 1,
                        sizeOptions: 1,
                        stockAvailable: 1,
                        cost: 1,
                        purchaseLimitPerParticipant: 1,
                        purchasedQuantity: 1,
                        myPurchasedQuantity: participantObjectId
                            ? {
                                $size: {
                                    $filter: {
                                        input: "$purchasedBy",
                                        as: "buyer",
                                        cond: { $eq: ["$$buyer", participantObjectId] },
                                    },
                                },
                            }
                            : 0,
                    },
                },
            ]);
            return res.status(200).json({ success: true, data: items });
        }

        const items = await Item.find({ eventId }).sort({ createdAt: 1 });
        return res.status(200).json({ success: true, data: items });
    } catch (error) {
        console.log("error in fetching items by event: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const getItemsByIds = async (req, res) => {
    const ids = Array.isArray(req.body?.itemIds) ? req.body.itemIds : [];

    if (ids.length === 0) {
        return res.status(200).json({ success: true, data: [] });
    }

    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
        return res.status(200).json({ success: true, data: [] });
    }

    try {
        const shouldUseLite = String(req.body?.lite || "").toLowerCase() === "true";
        const participantObjectId =
            req.user?.role === "Participant" && mongoose.Types.ObjectId.isValid(req.user?.id)
                ? new mongoose.Types.ObjectId(req.user.id)
                : null;

        if (shouldUseLite) {
            const items = await Item.aggregate([
                { $match: { _id: { $in: validIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
                {
                    $project: {
                        eventId: 1,
                        organizerId: 1,
                        itemName: 1,
                        colorOptions: 1,
                        sizeOptions: 1,
                        stockAvailable: 1,
                        cost: 1,
                        purchaseLimitPerParticipant: 1,
                        purchasedQuantity: 1,
                        myPurchasedQuantity: participantObjectId
                            ? {
                                $size: {
                                    $filter: {
                                        input: "$purchasedBy",
                                        as: "buyer",
                                        cond: { $eq: ["$$buyer", participantObjectId] },
                                    },
                                },
                            }
                            : 0,
                    },
                },
            ]);
            const byId = new Map(items.map((item) => [String(item._id), item]));
            const ordered = validIds.map((id) => byId.get(String(id))).filter(Boolean);
            return res.status(200).json({ success: true, data: ordered });
        }

        const items = await Item.find({ _id: { $in: validIds } });
        const byId = new Map(items.map((item) => [String(item._id), item]));
        const ordered = validIds.map((id) => byId.get(String(id))).filter(Boolean);
        return res.status(200).json({ success: true, data: ordered });
    } catch (error) {
        console.log("error in fetching items by ids: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const createItemsForEvent = async (req, res) => {
    const { eventId, items } = req.body || {};

    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ success: false, message: "Valid eventId is required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: "items must be a non-empty array" });
    }

    try {
        const requesterOrganizerId = await getRequesterOrganizerId(req);
        if (!Number.isInteger(requesterOrganizerId)) {
            return res.status(403).json({ success: false, message: "Organizer access required" });
        }

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event Not Found" });
        }

        if (event.organizerId !== requesterOrganizerId) {
            return res.status(403).json({ success: false, message: "Not authorized to modify items for this event" });
        }

        if (event.eventType !== "Merchandise Event") {
            return res.status(400).json({ success: false, message: "Items can be created only for merchandise events" });
        }

        const normalizedItems = [];
        for (const rawItem of items) {
            const itemName = typeof rawItem?.itemName === "string" ? rawItem.itemName.trim() : "";
            const stockAvailable = Number(rawItem?.stockAvailable);
            const cost = Number(rawItem?.cost);
            const purchaseLimitPerParticipant = rawItem?.purchaseLimitPerParticipant;
            const colorOptions = normalizeStringArray(rawItem?.colorOptions);
            const sizeOptions = normalizeStringArray(rawItem?.sizeOptions);

            if (!itemName) {
                return res.status(400).json({ success: false, message: "Each item requires itemName" });
            }

            if (!Number.isInteger(stockAvailable) || stockAvailable < 0) {
                return res.status(400).json({ success: false, message: "Each item stockAvailable must be an integer >= 0" });
            }

            if (!Number.isInteger(cost) || cost < 1) {
                return res.status(400).json({ success: false, message: "Each item cost must be an integer >= 1" });
            }

            const normalized = {
                eventId: event._id,
                organizerId: requesterOrganizerId,
                itemName,
                stockAvailable,
                cost,
                colorOptions,
                sizeOptions,
            };

            if (purchaseLimitPerParticipant !== undefined && purchaseLimitPerParticipant !== null && purchaseLimitPerParticipant !== "") {
                const parsedLimit = Number(purchaseLimitPerParticipant);
                if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
                    return res.status(400).json({ success: false, message: "purchaseLimitPerParticipant must be an integer >= 1" });
                }
                normalized.purchaseLimitPerParticipant = parsedLimit;
            }

            normalizedItems.push(normalized);
        }

        await Item.deleteMany({ eventId: event._id });
        const createdItems = await Item.insertMany(normalizedItems);
        event.itemIds = createdItems.map((item) => item._id);
        await event.save();

        return res.status(201).json({ success: true, data: createdItems });
    } catch (error) {
        console.log("error in creating items for event: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const purchaseItem = async (req, res) => {
    const { itemId } = req.params;
    const quantity = Number(req.body?.quantity);
    const selectedColor = typeof req.body?.selectedColor === "string" ? req.body.selectedColor.trim() : "";
    const selectedSize = typeof req.body?.selectedSize === "string" ? req.body.selectedSize.trim() : "";

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
        return res.status(404).json({ success: false, message: "Item Not Found" });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ success: false, message: "quantity must be an integer >= 1" });
    }

    try {
        if (!req.user?.id || req.user?.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const [item, participant] = await Promise.all([
            Item.findById(itemId),
            User.findById(req.user.id),
        ]);

        if (!item) {
            return res.status(404).json({ success: false, message: "Item Not Found" });
        }

        if (!participant || participant.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const event = await Event.findById(item.eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: "Event Not Found" });
        }

        const validationMessage = validatePurchaseEligibility({
            item,
            participant,
            event,
            quantity,
            selectedColor,
            selectedSize,
        });
        if (validationMessage) {
            const statusCode = validationMessage === "Event Not Found" || validationMessage === "Item Not Found" ? 404 :
                validationMessage === "Participant access required" ? 403 : 400;
            return res.status(statusCode).json({ success: false, message: validationMessage });
        }

        item.stockAvailable -= quantity;
        item.purchasedQuantity += quantity;
        for (let i = 0; i < quantity; i += 1) {
            item.purchasedBy.push(participant._id);
            participant.purchasedItems.push(item._id);
        }

        const purchaseDateTime = new Date();
        const participantName = `${participant.firstName || ""} ${participant.lastName || ""}`.trim() || participant.email;
        const qrPayload = {
            type: "ItemPurchase",
            userId: String(participant._id),
            eventId: String(event._id),
            itemId: String(item._id),
            participantName,
            eventName: event.eventName,
            itemName: item.itemName,
            quantity,
            selectedColor,
            selectedSize,
            costPerItem: item.cost,
            totalCost: item.cost * quantity,
            purchasedAt: purchaseDateTime.toISOString(),
        };
        const qrCodeDataUrl = await generateQrDataUrlFromPayload(qrPayload);
        item.purchaseRecords.push({
            participantId: participant._id,
            quantity,
            selectedColor,
            selectedSize,
            purchasedAt: purchaseDateTime,
            qrPayload,
            qrCodeDataUrl,
        });

        await Promise.all([item.save(), participant.save()]);

        let emailSent = true;
        try {
            await sendMerchPurchaseEmail({
                recipientEmail: participant.email,
                participantName,
                eventName: event.eventName,
                itemName: item.itemName,
                quantity,
                costPerItem: item.cost,
                totalCost: item.cost * quantity,
                purchasedAt: purchaseDateTime,
                qrPayload,
                qrCodeDataUrl,
            });
        } catch (emailError) {
            emailSent = false;
            console.error("Failed to send purchase confirmation email:", emailError.message);
        }

        return res.status(200).json({
            success: true,
            message: emailSent
                ? "Purchase successful. Confirmation email sent."
                : "Purchase successful, but confirmation email could not be sent.",
            data: {
                item,
                user: participant,
            },
        });
    } catch (error) {
        console.log("error in purchasing item: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const createPurchaseRequest = async (req, res) => {
    const { itemId } = req.params;
    const quantity = Number(req.body?.quantity);
    const paymentProof = req.body?.paymentProof || null;
    const selectedColor = typeof req.body?.selectedColor === "string" ? req.body.selectedColor.trim() : "";
    const selectedSize = typeof req.body?.selectedSize === "string" ? req.body.selectedSize.trim() : "";

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
        return res.status(404).json({ success: false, message: "Item Not Found" });
    }

    try {
        if (!req.user?.id || req.user?.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const [item, participant] = await Promise.all([
            Item.findById(itemId),
            User.findById(req.user.id),
        ]);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item Not Found" });
        }
        if (!participant || participant.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const event = await Event.findById(item.eventId);
        const validationMessage = validatePurchaseEligibility({
            item,
            participant,
            event,
            quantity,
            selectedColor,
            selectedSize,
        });
        if (validationMessage) {
            const statusCode = validationMessage === "Event Not Found" || validationMessage === "Item Not Found" ? 404 :
                validationMessage === "Participant access required" ? 403 : 400;
            return res.status(statusCode).json({ success: false, message: validationMessage });
        }

        if (!paymentProof || typeof paymentProof !== "object" || !paymentProof.contentBase64) {
            return res.status(400).json({ success: false, message: "Payment proof is required." });
        }

        const participantName = `${participant.firstName || ""} ${participant.lastName || ""}`.trim() || participant.email;
        item.pendingPurchaseRequests.push({
            participantId: participant._id,
            participantName,
            participantEmail: participant.email || "",
            quantity,
            selectedColor,
            selectedSize,
            paymentAmount: item.cost * quantity,
            paymentProof: {
                name: paymentProof.name || "",
                type: paymentProof.type || "",
                size: Number(paymentProof.size) || 0,
                contentBase64: paymentProof.contentBase64 || "",
            },
            requestedAt: new Date(),
            status: "Pending",
        });

        await item.save();
        return res.status(200).json({
            success: true,
            message: "Purchase request submitted. Waiting for organizer approval.",
            data: { item },
        });
    } catch (error) {
        console.log("error in createPurchaseRequest: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const reviewPurchaseRequest = async (req, res) => {
    const { itemId, requestId } = req.params;
    const action = String(req.body?.action || "").toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(itemId) || !mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(404).json({ success: false, message: "Item or request not found" });
    }
    if (action !== "approve" && action !== "reject") {
        return res.status(400).json({ success: false, message: "Action must be approve or reject" });
    }

    try {
        const requesterOrganizerId = await getRequesterOrganizerId(req);
        if (!Number.isInteger(requesterOrganizerId)) {
            return res.status(403).json({ success: false, message: "Organizer access required" });
        }

        const item = await Item.findById(itemId);
        if (!item) return res.status(404).json({ success: false, message: "Item Not Found" });
        if (item.organizerId !== requesterOrganizerId) {
            return res.status(403).json({ success: false, message: "Not authorized to review this item request" });
        }

        const requestEntry = Array.isArray(item.pendingPurchaseRequests)
            ? item.pendingPurchaseRequests.find((request) => String(request._id) === String(requestId))
            : null;
        if (!requestEntry) return res.status(404).json({ success: false, message: "Purchase request not found" });
        if (requestEntry.status !== "Pending") {
            return res.status(400).json({ success: false, message: "This request has already been reviewed" });
        }

        if (action === "reject") {
            requestEntry.status = "Rejected";
            requestEntry.reviewedAt = new Date();
            await item.save();
            return res.status(200).json({ success: true, message: "Purchase request rejected.", data: { item } });
        }

        const [participant, event] = await Promise.all([
            User.findById(requestEntry.participantId),
            Event.findById(item.eventId),
        ]);
        const quantity = Number(requestEntry.quantity);
        const validationMessage = validatePurchaseEligibility({
            item,
            participant,
            event,
            quantity,
            selectedColor: requestEntry.selectedColor || "",
            selectedSize: requestEntry.selectedSize || "",
        });
        if (validationMessage) {
            return res.status(400).json({ success: false, message: validationMessage });
        }

        item.stockAvailable -= quantity;
        item.purchasedQuantity += quantity;
        for (let i = 0; i < quantity; i += 1) {
            item.purchasedBy.push(participant._id);
            participant.purchasedItems.push(item._id);
        }

        const purchaseDateTime = new Date();
        const participantName = requestEntry.participantName ||
            (`${participant.firstName || ""} ${participant.lastName || ""}`.trim() || participant.email);
        const qrPayload = {
            type: "ItemPurchase",
            userId: String(participant._id),
            eventId: String(event._id),
            itemId: String(item._id),
            participantName,
            eventName: event.eventName,
            itemName: item.itemName,
            quantity,
            selectedColor: requestEntry.selectedColor || "",
            selectedSize: requestEntry.selectedSize || "",
            costPerItem: item.cost,
            totalCost: item.cost * quantity,
            purchasedAt: purchaseDateTime.toISOString(),
        };
        const qrCodeDataUrl = await generateQrDataUrlFromPayload(qrPayload);
        item.purchaseRecords.push({
            participantId: participant._id,
            quantity,
            selectedColor: requestEntry.selectedColor || "",
            selectedSize: requestEntry.selectedSize || "",
            purchasedAt: purchaseDateTime,
            qrPayload,
            qrCodeDataUrl,
        });

        requestEntry.status = "Approved";
        requestEntry.reviewedAt = new Date();

        await Promise.all([item.save(), participant.save()]);

        let emailSent = true;
        try {
            await sendMerchPurchaseEmail({
                recipientEmail: participant.email,
                participantName,
                eventName: event.eventName,
                itemName: item.itemName,
                quantity,
                costPerItem: item.cost,
                totalCost: item.cost * quantity,
                purchasedAt: purchaseDateTime,
                qrCodeDataUrl,
            });
        } catch (emailError) {
            emailSent = false;
            console.error("Failed to send purchase confirmation email:", emailError.message);
        }

        return res.status(200).json({
            success: true,
            message: emailSent
                ? "Purchase request approved and purchase completed."
                : "Purchase approved but confirmation email could not be sent.",
            data: { item },
        });
    } catch (error) {
        console.log("error in reviewPurchaseRequest: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};
