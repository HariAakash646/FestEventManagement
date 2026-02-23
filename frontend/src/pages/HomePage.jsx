import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box,
    Button,
    Flex,
    Heading,
    SimpleGrid,
    Stack,
    Text,
} from "@chakra-ui/react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiCall } from "../utils/api.js";

const formatDateTime = (value) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleString();
};

const computeEventStatus = (event) => {
    const now = new Date();
    const start = new Date(event?.eventStartDate);
    const end = new Date(event?.eventEndDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return "Upcoming";
    }

    if (now < start) return "Upcoming";
    if (now > end) return "Completed";
    return "Ongoing";
};

const formatCalendarUtc = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
};

const escapeIcsText = (value) =>
    String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");

const buildIcsContent = ({ rows, organizerNameById, reminderMinutes }) => {
    const nowUtc = formatCalendarUtc(new Date());
    const events = rows
        .map(({ event }) => {
            const startUtc = formatCalendarUtc(event?.eventStartDate);
            const endUtc = formatCalendarUtc(event?.eventEndDate);
            if (!startUtc || !endUtc) return "";
            const organizerName = organizerNameById.get(event.organizerId) || "Unknown Organizer";
            const summary = escapeIcsText(event.eventName || "Event");
            const description = escapeIcsText(
                `${event.eventDescription || ""}\nOrganizer: ${organizerName}\nStatus: ${computeEventStatus(event)}`
            );
            const alarmBlock = reminderMinutes > 0
                ? [
                    "BEGIN:VALARM",
                    `TRIGGER:-PT${Math.max(1, reminderMinutes)}M`,
                    "ACTION:DISPLAY",
                    `DESCRIPTION:${summary} reminder`,
                    "END:VALARM",
                ].join("\r\n")
                : "";

            return [
                "BEGIN:VEVENT",
                `UID:${String(event._id)}@campus-events`,
                `DTSTAMP:${nowUtc}`,
                `DTSTART:${startUtc}`,
                `DTEND:${endUtc}`,
                `SUMMARY:${summary}`,
                `DESCRIPTION:${description}`,
                alarmBlock,
                "END:VEVENT",
            ]
                .filter(Boolean)
                .join("\r\n");
        })
        .filter(Boolean);

    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Campus Events//Participant Calendar Export//EN",
        "CALSCALE:GREGORIAN",
        ...events,
        "END:VCALENDAR",
    ].join("\r\n");
};

const downloadIcs = (content, filename) => {
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};

const buildGoogleCalendarUrl = ({ event, organizerName, reminderMinutes }) => {
    const startUtc = formatCalendarUtc(event?.eventStartDate);
    const endUtc = formatCalendarUtc(event?.eventEndDate);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const title = event?.eventName || "Event";
    const details = `${event?.eventDescription || ""}\nOrganizer: ${organizerName}\nReminder: ${reminderMinutes > 0 ? `${reminderMinutes} minutes before start` : "None"}`;
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: title,
        dates: `${startUtc}/${endUtc}`,
        details,
        ctz: timezone,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const buildOutlookCalendarUrl = ({ event, organizerName, reminderMinutes }) => {
    const start = new Date(event?.eventStartDate);
    const end = new Date(event?.eventEndDate);
    const title = event?.eventName || "Event";
    const body = `${event?.eventDescription || ""}\nOrganizer: ${organizerName}`;
    const params = new URLSearchParams({
        path: "/calendar/action/compose",
        rru: "addevent",
        subject: title,
        startdt: Number.isNaN(start.getTime()) ? "" : start.toISOString(),
        enddt: Number.isNaN(end.getTime()) ? "" : end.toISOString(),
        body,
        reminder: reminderMinutes > 0 ? "true" : "false",
        reminderminutesbeforestart: String(Math.max(0, reminderMinutes)),
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};

const HomePage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [registeredEventIds, setRegisteredEventIds] = useState([]);
    const [purchasedItemIds, setPurchasedItemIds] = useState([]);
    const [selectedRegisteredEventId, setSelectedRegisteredEventId] = useState("");
    const [selectedPurchaseKey, setSelectedPurchaseKey] = useState("");
    const [registeredEventsFilter, setRegisteredEventsFilter] = useState("All");
    const [selectedCalendarEventIds, setSelectedCalendarEventIds] = useState([]);
    const [calendarReminderMinutes, setCalendarReminderMinutes] = useState("30");
    const [calendarExportError, setCalendarExportError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            if (!user || user.role !== "Participant") {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError("");
            try {
                const [meResponse, eventsResponse, usersResponse] = await Promise.all([
                    apiCall("/users/me"),
                    apiCall("/events"),
                    apiCall("/users?role=Organizer&lite=true"),
                ]);

                if (!meResponse?.success) {
                    setError(meResponse?.message || "Failed to fetch profile data");
                    return;
                }

                if (!eventsResponse?.success) {
                    setError(eventsResponse?.message || "Failed to fetch events");
                    return;
                }

                if (!usersResponse?.success) {
                    setError(usersResponse?.message || "Failed to fetch organizers");
                    return;
                }

                const me = meResponse.data || {};
                setRegisteredEventIds(
                    Array.isArray(me.registeredEvents) ? me.registeredEvents.map((id) => String(id)) : []
                );
                setPurchasedItemIds(
                    Array.isArray(me.purchasedItems) ? me.purchasedItems.map((id) => String(id)) : []
                );
                setEvents(Array.isArray(eventsResponse.data) ? eventsResponse.data : []);
                setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);

                const allEventItemIds = (Array.isArray(eventsResponse.data) ? eventsResponse.data : [])
                    .flatMap((event) => (Array.isArray(event.itemIds) ? event.itemIds : []))
                    .map((id) => String(id));
                const uniqueRelevantItemIds = Array.from(
                    new Set([
                        ...(Array.isArray(me.purchasedItems) ? me.purchasedItems.map((id) => String(id)) : []),
                        ...allEventItemIds,
                    ])
                );
                if (uniqueRelevantItemIds.length > 0) {
                    const itemsResponse = await apiCall("/items/by-ids", "POST", { itemIds: uniqueRelevantItemIds });
                    if (itemsResponse?.success) {
                        setItems(Array.isArray(itemsResponse.data) ? itemsResponse.data : []);
                    } else {
                        setItems([]);
                    }
                } else {
                    setItems([]);
                }
            } catch (err) {
                setError("Something went wrong while loading your events.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const organizerNameById = useMemo(() => {
        const map = new Map();
        users.forEach((u) => {
            if (u.role === "Organizer" && Number.isInteger(u.organizerId)) {
                map.set(u.organizerId, u.organizerName || "Unknown Organizer");
            }
        });
        return map;
    }, [users]);

    const registeredEvents = useMemo(() => {
        return events
            .filter((event) => registeredEventIds.includes(String(event._id)))
            .sort((a, b) => new Date(a.eventStartDate) - new Date(b.eventStartDate));
    }, [events, registeredEventIds]);

    const registeredEventRows = useMemo(() => {
        if (!user?._id) return [];
        return registeredEvents.map((event) => {
            const registrationEntry = Array.isArray(event.registeredFormList)
                ? event.registeredFormList.find((entry) => String(entry.participantId) === String(user._id))
                : null;
            return {
                event,
                qrPayload: registrationEntry?.qrPayload || null,
                qrCodeDataUrl: registrationEntry?.qrCodeDataUrl || "",
            };
        });
    }, [registeredEvents, user?._id]);

    const filteredRegisteredEventRows = useMemo(() => {
        if (registeredEventsFilter === "All") return registeredEventRows;
        return registeredEventRows.filter(
            (row) => computeEventStatus(row.event) === registeredEventsFilter
        );
    }, [registeredEventRows, registeredEventsFilter]);

    const selectedCalendarRows = useMemo(
        () => filteredRegisteredEventRows.filter((row) => selectedCalendarEventIds.includes(String(row.event._id))),
        [filteredRegisteredEventRows, selectedCalendarEventIds]
    );

    const upcomingRegisteredEvents = useMemo(() => {
        const now = new Date();
        return registeredEvents.filter((event) => {
            const start = new Date(event.eventStartDate);
            return !Number.isNaN(start.getTime()) && start > now;
        });
    }, [registeredEvents]);

    const pendingApprovalRows = useMemo(() => {
        if (!user?._id) return [];
        return events
            .flatMap((event) => {
                const requests = Array.isArray(event.pendingRegistrationRequests) ? event.pendingRegistrationRequests : [];
                return requests
                    .filter(
                        (request) =>
                            String(request.participantId) === String(user._id) &&
                            request.status === "Pending"
                    )
                    .map((request) => ({
                        eventId: String(event._id),
                        eventName: event.eventName || "Unknown Event",
                        organizerName: organizerNameById.get(event.organizerId) || "Unknown Organizer",
                        paymentAmount: request.paymentAmount ?? event.registrationFee ?? 0,
                        requestedAt: request.requestedAt || null,
                    }));
            })
            .sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
    }, [events, organizerNameById, user?._id]);

    const pendingMerchApprovalRows = useMemo(() => {
        if (!user?._id) return [];
        return items
            .flatMap((item) => {
                const requests = Array.isArray(item.pendingPurchaseRequests) ? item.pendingPurchaseRequests : [];
                const event = events.find((currentEvent) => String(currentEvent._id) === String(item.eventId));
                const organizerName = event ? (organizerNameById.get(event.organizerId) || "Unknown Organizer") : "Unknown Organizer";
                return requests
                    .filter(
                        (request) =>
                            String(request.participantId) === String(user._id) &&
                            request.status === "Pending"
                    )
                    .map((request, index) => ({
                        key: `${String(item._id)}-${String(request._id || index)}`,
                        itemName: item.itemName || "Unknown Item",
                        eventName: event?.eventName || "Unknown Event",
                        organizerName,
                        quantity: request.quantity ?? 0,
                        paymentAmount: request.paymentAmount ?? ((item.cost || 0) * (request.quantity || 0)),
                        requestedAt: request.requestedAt || null,
                    }));
            })
            .sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
    }, [items, events, organizerNameById, user?._id]);

    const rejectedRequestRows = useMemo(() => {
        if (!user?._id) return [];
        return events
            .flatMap((event) => {
                const requests = Array.isArray(event.pendingRegistrationRequests) ? event.pendingRegistrationRequests : [];
                return requests
                    .filter(
                        (request) =>
                            String(request.participantId) === String(user._id) &&
                            request.status === "Rejected"
                    )
                    .map((request) => ({
                        eventId: String(event._id),
                        eventName: event.eventName || "Unknown Event",
                        organizerName: organizerNameById.get(event.organizerId) || "Unknown Organizer",
                        paymentAmount: request.paymentAmount ?? event.registrationFee ?? 0,
                        requestedAt: request.requestedAt || null,
                        reviewedAt: request.reviewedAt || null,
                    }));
            })
            .sort((a, b) => new Date(b.reviewedAt || b.requestedAt || 0).getTime() - new Date(a.reviewedAt || a.requestedAt || 0).getTime());
    }, [events, organizerNameById, user?._id]);

    const itemById = useMemo(() => {
        const map = new Map();
        items.forEach((item) => map.set(String(item._id), item));
        return map;
    }, [items]);

    const eventById = useMemo(() => {
        const map = new Map();
        events.forEach((event) => map.set(String(event._id), event));
        return map;
    }, [events]);

    const purchaseRows = useMemo(() => {
        if (!user?._id) return [];
        return items
            .flatMap((item) => {
                const event = eventById.get(String(item.eventId));
                const organizerName = event ? (organizerNameById.get(event.organizerId) || "Unknown Organizer") : "Unknown Organizer";
                const records = Array.isArray(item.purchaseRecords) ? item.purchaseRecords : [];
                return records
                    .filter((record) => String(record.participantId) === String(user._id))
                    .map((record, index) => ({
                        key: `${String(item._id)}-${record?.purchasedAt || ""}-${index}`,
                        itemId: String(item._id),
                        itemName: item.itemName || "Unknown Item",
                        eventName: event?.eventName || "Unknown Event",
                        organizerName,
                        quantity: record.quantity ?? 0,
                        purchasedAt: record.purchasedAt || null,
                        qrPayload: record.qrPayload || null,
                        qrCodeDataUrl: record.qrCodeDataUrl || "",
                    }));
            })
            .sort((a, b) => {
                const at = new Date(a.purchasedAt || 0).getTime();
                const bt = new Date(b.purchasedAt || 0).getTime();
                return bt - at;
            });
    }, [items, eventById, organizerNameById, user?._id]);

    const selectedRegisteredEventRow = filteredRegisteredEventRows.find(
        (row) => String(row.event._id) === String(selectedRegisteredEventId)
    ) || null;
    const selectedPurchaseRow = purchaseRows.find((row) => row.key === selectedPurchaseKey) || null;
    const allFilteredSelected =
        filteredRegisteredEventRows.length > 0 &&
        filteredRegisteredEventRows.every((row) => selectedCalendarEventIds.includes(String(row.event._id)));

    const parseReminderMinutes = () => {
        const parsed = Number(calendarReminderMinutes);
        if (!Number.isInteger(parsed) || parsed < 0) return 0;
        return parsed;
    };

    const requireSelectedRows = () => {
        if (selectedCalendarRows.length === 0) {
            setCalendarExportError("Select at least one registered event to export.");
            return false;
        }
        setCalendarExportError("");
        return true;
    };

    const handleDownloadCalendarInvite = () => {
        if (!requireSelectedRows()) return;
        const reminderMinutes = parseReminderMinutes();
        const icsContent = buildIcsContent({
            rows: selectedCalendarRows,
            organizerNameById,
            reminderMinutes,
        });
        const filename = selectedCalendarRows.length === 1
            ? `${(selectedCalendarRows[0].event.eventName || "event").replace(/[^a-z0-9-_]/gi, "_")}.ics`
            : "registered_events.ics";
        downloadIcs(icsContent, filename);
    };

    const handleExportGoogleCalendar = () => {
        if (!requireSelectedRows()) return;
        const reminderMinutes = parseReminderMinutes();
        selectedCalendarRows.forEach((row) => {
            const organizerName = organizerNameById.get(row.event.organizerId) || "Unknown Organizer";
            const url = buildGoogleCalendarUrl({
                event: row.event,
                organizerName,
                reminderMinutes,
            });
            window.open(url, "_blank", "noopener,noreferrer");
        });
    };

    const handleExportOutlookCalendar = () => {
        if (!requireSelectedRows()) return;
        const reminderMinutes = parseReminderMinutes();
        selectedCalendarRows.forEach((row) => {
            const organizerName = organizerNameById.get(row.event.organizerId) || "Unknown Organizer";
            const url = buildOutlookCalendarUrl({
                event: row.event,
                organizerName,
                reminderMinutes,
            });
            window.open(url, "_blank", "noopener,noreferrer");
        });
    };
    const teamEventRows = useMemo(() => {
        if (!user?._id) return [];

        return events
            .filter((event) => event?.isTeamEvent === true)
            .map((event) => {
                const requests = Array.isArray(event.pendingRegistrationRequests) ? event.pendingRegistrationRequests : [];
                const matchingRequest = requests
                    .filter((request) => {
                        if (!request || request.isTeamRegistration !== true) return false;
                        if (String(request.participantId) === String(user._id)) return true;
                        return Array.isArray(request.teamMembers) &&
                            request.teamMembers.some((member) => String(member.participantId) === String(user._id));
                    })
                    .sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime())[0] || null;

                const isRegistered = registeredEventIds.includes(String(event._id));
                if (!matchingRequest && !isRegistered) return null;

                const organizerName = organizerNameById.get(event.organizerId) || "Unknown Organizer";
                const userRoleInTeam = matchingRequest
                    ? (String(matchingRequest.participantId) === String(user._id) ? "Leader" : "Member")
                    : "Member";
                const status = matchingRequest?.status || (isRegistered ? "Approved" : "Unknown");
                const joinedCount = matchingRequest
                    ? 1 + (Array.isArray(matchingRequest.teamMembers) ? matchingRequest.teamMembers.length : 0)
                    : null;
                const targetSize = matchingRequest?.targetTeamSize ?? null;

                return {
                    eventId: String(event._id),
                    eventName: event.eventName || "Unknown Event",
                    organizerName,
                    status,
                    role: userRoleInTeam,
                    joinedCount,
                    targetSize,
                    eventStartDate: event.eventStartDate,
                };
            })
            .filter(Boolean)
            .sort((a, b) => new Date(a.eventStartDate || 0).getTime() - new Date(b.eventStartDate || 0).getTime());
    }, [events, organizerNameById, registeredEventIds, user?._id]);

    if (!user || user.role !== "Participant") {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="1080px">
                    <Heading size="lg" mb={3}>Home</Heading>
                    <Text color="gray.600">Log in as a participant to view upcoming registered events.</Text>
                </Box>
            </Flex>
        );
    }

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="1080px">
                <Heading size="lg" mb={6}>My Participation</Heading>

                {isLoading && <Text color="gray.600">Loading participation data...</Text>}
                {!isLoading && error && <Text color="red.500">{error}</Text>}

                {!isLoading && !error && (
                    <Stack gap={8}>
                        <Box>
                            <Heading size="md" mb={4}>Upcoming Events</Heading>
                            {upcomingRegisteredEvents.length === 0 ? (
                                <Text color="gray.600">No upcoming registered events.</Text>
                            ) : (
                                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                                    {upcomingRegisteredEvents.map((event) => (
                                        <Box
                                            key={event._id}
                                            p={5}
                                            border="1px solid"
                                            borderColor="gray.200"
                                            borderRadius="lg"
                                            bg="white"
                                            boxShadow="sm"
                                        >
                                            <Stack gap={2}>
                                                <Text fontSize="lg" fontWeight="bold" color="gray.800">
                                                    {event.eventName}
                                                </Text>
                                                <Text fontSize="sm" color="teal.700" fontWeight="semibold">
                                                    Type: {event.eventType || "N/A"}
                                                </Text>
                                                <Text fontSize="sm" color="gray.700">
                                                    Organizer: {organizerNameById.get(event.organizerId) || "Unknown Organizer"}
                                                </Text>
                                                <Text fontSize="sm" color="gray.700">
                                                    Schedule: {formatDateTime(event.eventStartDate)} to {formatDateTime(event.eventEndDate)}
                                                </Text>
                                            </Stack>
                                        </Box>
                                    ))}
                                </SimpleGrid>
                            )}
                        </Box>

                        <Box>
                            <Heading size="md" mb={4}>Team Events</Heading>
                            {teamEventRows.length === 0 ? (
                                <Text color="gray.600">No team events found for your account.</Text>
                            ) : (
                                <Box border="1px solid" borderColor="gray.200" borderRadius="md" overflowX="auto" bg="white">
                                    <Box px={4} py={2} bg="gray.50" borderBottom="1px solid" borderColor="gray.200" minW="760px">
                                        <SimpleGrid columns={6} gap={3}>
                                            <Text fontSize="xs" color="gray.500" fontWeight="bold">Event</Text>
                                            <Text fontSize="xs" color="gray.500" fontWeight="bold">Organizer</Text>
                                            <Text fontSize="xs" color="gray.500" fontWeight="bold">Role</Text>
                                            <Text fontSize="xs" color="gray.500" fontWeight="bold">Status</Text>
                                            <Text fontSize="xs" color="gray.500" fontWeight="bold">Team Size</Text>
                                            <Text fontSize="xs" color="gray.500" fontWeight="bold">Start</Text>
                                        </SimpleGrid>
                                    </Box>
                                    <Stack gap={0}>
                                        {teamEventRows.map((row, index) => (
                                            <Box
                                                key={row.eventId}
                                                px={4}
                                                py={2.5}
                                                minW="760px"
                                                borderTop={index === 0 ? "none" : "1px solid"}
                                                borderColor="gray.100"
                                                cursor="pointer"
                                                _hover={{ bg: "teal.50" }}
                                                onClick={() => navigate(`/participant/team-events/${row.eventId}`)}
                                            >
                                                <SimpleGrid columns={6} gap={3}>
                                                    <Text fontSize="sm" color="gray.800" fontWeight="medium">{row.eventName}</Text>
                                                    <Text fontSize="sm" color="gray.700">{row.organizerName}</Text>
                                                    <Text fontSize="sm" color="gray.700">{row.role}</Text>
                                                    <Text fontSize="sm" color="teal.700" fontWeight="semibold">{row.status}</Text>
                                                    <Text fontSize="sm" color="gray.700">
                                                        {row.joinedCount && row.targetSize ? `${row.joinedCount}/${row.targetSize}` : "N/A"}
                                                    </Text>
                                                    <Text fontSize="sm" color="gray.700">{formatDateTime(row.eventStartDate)}</Text>
                                                </SimpleGrid>
                                            </Box>
                                        ))}
                                    </Stack>
                                </Box>
                            )}
                        </Box>

                        <Box>
                            <Heading size="md" mb={4}>Pending Approval</Heading>
                            {pendingApprovalRows.length === 0 && pendingMerchApprovalRows.length === 0 ? (
                                <Text color="gray.600">No pending registration approvals.</Text>
                            ) : (
                                <Stack gap={2}>
                                    {pendingApprovalRows.map((row, index) => (
                                        <Box
                                            key={`${row.eventId}-${index}`}
                                            p={3}
                                            border="1px solid"
                                            borderColor="orange.200"
                                            borderRadius="md"
                                            bg="orange.50"
                                        >
                                            <Text fontSize="sm" fontWeight="semibold" color="gray.800">{row.eventName}</Text>
                                            <Text fontSize="sm" color="gray.700">Organizer: {row.organizerName}</Text>
                                            <Text fontSize="sm" color="gray.700">Payment: Rs. {row.paymentAmount}</Text>
                                            <Text fontSize="sm" color="gray.700">Requested At: {formatDateTime(row.requestedAt)}</Text>
                                        </Box>
                                    ))}
                                    {pendingMerchApprovalRows.map((row) => (
                                        <Box
                                            key={row.key}
                                            p={3}
                                            border="1px solid"
                                            borderColor="orange.200"
                                            borderRadius="md"
                                            bg="orange.50"
                                        >
                                            <Text fontSize="sm" fontWeight="semibold" color="gray.800">
                                                {row.itemName} ({row.eventName})
                                            </Text>
                                            <Text fontSize="sm" color="gray.700">Organizer: {row.organizerName}</Text>
                                            <Text fontSize="sm" color="gray.700">Quantity: {row.quantity}</Text>
                                            <Text fontSize="sm" color="gray.700">Payment: Rs. {row.paymentAmount}</Text>
                                            <Text fontSize="sm" color="gray.700">Requested At: {formatDateTime(row.requestedAt)}</Text>
                                        </Box>
                                    ))}
                                </Stack>
                            )}
                        </Box>

                        <Box>
                            <Heading size="md" mb={4}>Rejected</Heading>
                            {rejectedRequestRows.length === 0 ? (
                                <Text color="gray.600">No rejected registration requests.</Text>
                            ) : (
                                <Stack gap={2}>
                                    {rejectedRequestRows.map((row, index) => (
                                        <Box
                                            key={`${row.eventId}-${index}`}
                                            p={3}
                                            border="1px solid"
                                            borderColor="red.200"
                                            borderRadius="md"
                                            bg="red.50"
                                        >
                                            <Text fontSize="sm" fontWeight="semibold" color="gray.800">{row.eventName}</Text>
                                            <Text fontSize="sm" color="gray.700">Organizer: {row.organizerName}</Text>
                                            <Text fontSize="sm" color="gray.700">Payment: Rs. {row.paymentAmount}</Text>
                                            <Text fontSize="sm" color="gray.700">Requested At: {formatDateTime(row.requestedAt)}</Text>
                                            <Text fontSize="sm" color="gray.700">Reviewed At: {formatDateTime(row.reviewedAt)}</Text>
                                        </Box>
                                    ))}
                                </Stack>
                            )}
                        </Box>

                        <Box>
                            <Stack direction={{ base: "column", md: "row" }} justify="space-between" align={{ base: "start", md: "center" }} mb={4}>
                                <Heading size="md">Registered Events</Heading>
                                <Stack direction="row" gap={2} wrap="wrap">
                                    {["All", "Upcoming", "Ongoing", "Completed"].map((status) => (
                                        <Box
                                            key={status}
                                            as="button"
                                            px={3}
                                            py={1.5}
                                            borderRadius="full"
                                            border="1px solid"
                                            borderColor={registeredEventsFilter === status ? "teal.400" : "gray.200"}
                                            bg={registeredEventsFilter === status ? "teal.50" : "white"}
                                            color={registeredEventsFilter === status ? "teal.700" : "gray.700"}
                                            fontWeight="semibold"
                                            fontSize="sm"
                                            onClick={() => setRegisteredEventsFilter(status)}
                                        >
                                            {status}
                                        </Box>
                                    ))}
                                </Stack>
                            </Stack>
                            <Box mb={3} p={3} border="1px solid" borderColor="gray.200" borderRadius="md" bg="white">
                                <Stack direction={{ base: "column", lg: "row" }} gap={3} align={{ base: "start", lg: "center" }} justify="space-between">
                                    <Stack direction={{ base: "column", sm: "row" }} gap={2} align={{ base: "start", sm: "center" }}>
                                        <Text fontSize="sm" color="gray.700" fontWeight="semibold">Reminder</Text>
                                        <select
                                            value={calendarReminderMinutes}
                                            onChange={(e) => setCalendarReminderMinutes(e.target.value)}
                                            style={{
                                                minWidth: "200px",
                                                padding: "0.4rem 0.5rem",
                                                borderRadius: "0.375rem",
                                                border: "1px solid #E2E8F0",
                                                backgroundColor: "white",
                                            }}
                                        >
                                            <option value="0">No reminder</option>
                                            <option value="10">10 minutes before</option>
                                            <option value="30">30 minutes before</option>
                                            <option value="60">1 hour before</option>
                                            <option value="1440">1 day before</option>
                                        </select>
                                    </Stack>
                                    <Stack direction={{ base: "column", sm: "row" }} gap={2}>
                                        <Button size="sm" variant="outline" colorPalette="teal" onClick={handleDownloadCalendarInvite}>
                                            Download Calendar Invite
                                        </Button>
                                        <Button size="sm" variant="outline" colorPalette="teal" onClick={handleExportGoogleCalendar}>
                                            Export to Google Calendar
                                        </Button>
                                        <Button size="sm" variant="outline" colorPalette="teal" onClick={handleExportOutlookCalendar}>
                                            Export to Outlook
                                        </Button>
                                    </Stack>
                                </Stack>
                                {calendarExportError && (
                                    <Text color="red.500" fontSize="sm" mt={2}>
                                        {calendarExportError}
                                    </Text>
                                )}
                            </Box>
                            {filteredRegisteredEventRows.length === 0 ? (
                                <Text color="gray.600">No registered events.</Text>
                            ) : (
                                <Stack gap={3}>
                                    <Box border="1px solid" borderColor="gray.200" borderRadius="md" overflowX="auto" bg="white">
                                        <Box px={4} py={2} bg="gray.50" borderBottom="1px solid" borderColor="gray.200" minW="760px">
                                            <SimpleGrid columns={6} gap={3}>
                                                <Text fontSize="xs" color="gray.500" fontWeight="bold">
                                                    <input
                                                        type="checkbox"
                                                        checked={allFilteredSelected}
                                                        onChange={(e) => {
                                                            const visibleIds = filteredRegisteredEventRows.map((row) => String(row.event._id));
                                                            setSelectedCalendarEventIds((prev) => {
                                                                if (e.target.checked) {
                                                                    return Array.from(new Set([...prev, ...visibleIds]));
                                                                }
                                                                return prev.filter((id) => !visibleIds.includes(id));
                                                            });
                                                        }}
                                                    />{" "}
                                                    Select
                                                </Text>
                                                <Text fontSize="xs" color="gray.500" fontWeight="bold">Event</Text>
                                                <Text fontSize="xs" color="gray.500" fontWeight="bold">Organizer</Text>
                                                <Text fontSize="xs" color="gray.500" fontWeight="bold">Status</Text>
                                                <Text fontSize="xs" color="gray.500" fontWeight="bold">Start</Text>
                                                <Text fontSize="xs" color="gray.500" fontWeight="bold">End</Text>
                                            </SimpleGrid>
                                        </Box>
                                        <Stack gap={0}>
                                            {filteredRegisteredEventRows.map((row, index) => (
                                                <Box
                                                    key={row.event._id}
                                                    px={4}
                                                    py={2.5}
                                                    minW="760px"
                                                    borderTop={index === 0 ? "none" : "1px solid"}
                                                    borderColor="gray.100"
                                                    cursor="pointer"
                                                    bg={String(selectedRegisteredEventId) === String(row.event._id) ? "teal.50" : "white"}
                                                    onClick={() => setSelectedRegisteredEventId(String(row.event._id))}
                                                >
                                                    <SimpleGrid columns={6} gap={3}>
                                                        <Text fontSize="sm" color="gray.700">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedCalendarEventIds.includes(String(row.event._id))}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => {
                                                                    const rowId = String(row.event._id);
                                                                    setSelectedCalendarEventIds((prev) =>
                                                                        e.target.checked
                                                                            ? Array.from(new Set([...prev, rowId]))
                                                                            : prev.filter((id) => id !== rowId)
                                                                    );
                                                                }}
                                                            />
                                                        </Text>
                                                        <Text fontSize="sm" color="gray.800" fontWeight="medium">{row.event.eventName}</Text>
                                                        <Text fontSize="sm" color="gray.700">{organizerNameById.get(row.event.organizerId) || "Unknown Organizer"}</Text>
                                                        <Text fontSize="sm" color="teal.700" fontWeight="semibold">{computeEventStatus(row.event)}</Text>
                                                        <Text fontSize="sm" color="gray.700">{formatDateTime(row.event.eventStartDate)}</Text>
                                                        <Text fontSize="sm" color="gray.700">{formatDateTime(row.event.eventEndDate)}</Text>
                                                    </SimpleGrid>
                                                </Box>
                                            ))}
                                        </Stack>
                                    </Box>

                                    <Box border="1px solid" borderColor="gray.200" borderRadius="md" p={4} bg="white">
                                        {selectedRegisteredEventRow ? (
                                            <Stack gap={3}>
                                                <Text fontSize="sm" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                                                    Ticket Details
                                                </Text>
                                                <Text fontSize="sm" color="gray.700">User ID: {selectedRegisteredEventRow.qrPayload?.userId || String(user?._id || "N/A")}</Text>
                                                <Text fontSize="sm" color="gray.700">Event ID: {selectedRegisteredEventRow.qrPayload?.eventId || String(selectedRegisteredEventRow.event._id)}</Text>
                                                <Text fontSize="sm" color="gray.700">Participant Name: {selectedRegisteredEventRow.qrPayload?.participantName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "N/A"}</Text>
                                                <Text fontSize="sm" color="gray.700">Event Name: {selectedRegisteredEventRow.qrPayload?.eventName || selectedRegisteredEventRow.event.eventName}</Text>
                                                <Text fontSize="sm" color="gray.700">Organizer Name: {selectedRegisteredEventRow.qrPayload?.organizerName || organizerNameById.get(selectedRegisteredEventRow.event.organizerId) || "Unknown Organizer"}</Text>
                                                <Text fontSize="sm" color="gray.700">Status: {computeEventStatus(selectedRegisteredEventRow.event)}</Text>
                                                <Text fontSize="sm" color="gray.700">Registration Date and Time: {formatDateTime(selectedRegisteredEventRow.qrPayload?.registrationDateTime)}</Text>
                                                <Text fontSize="sm" color="gray.700">Event Start Date and Time: {formatDateTime(selectedRegisteredEventRow.qrPayload?.eventStartDateTime || selectedRegisteredEventRow.event.eventStartDate)}</Text>
                                                <Text fontSize="sm" color="gray.700">Event End Date and Time: {formatDateTime(selectedRegisteredEventRow.qrPayload?.eventEndDateTime || selectedRegisteredEventRow.event.eventEndDate)}</Text>
                                                {selectedRegisteredEventRow.qrCodeDataUrl ? (
                                                    <Box as="img" src={selectedRegisteredEventRow.qrCodeDataUrl} alt="Event Ticket QR" maxW="220px" borderRadius="md" />
                                                ) : (
                                                    <Text fontSize="sm" color="gray.600">QR not available for this ticket.</Text>
                                                )}
                                            </Stack>
                                        ) : (
                                            <Text color="gray.600">Click a registered event row to view ticket details and QR.</Text>
                                        )}
                                    </Box>
                                </Stack>
                            )}
                        </Box>

                        <Box>
                            <Heading size="md" mb={4}>Merchandise Purchases</Heading>
                            {purchaseRows.length === 0 ? (
                                <Text color="gray.600">No merchandise purchases.</Text>
                            ) : (
                                <Stack gap={3}>
                                    <Box border="1px solid" borderColor="gray.200" borderRadius="md" overflowX="auto" bg="white">
                                        <Box px={4} py={2} bg="gray.50" borderBottom="1px solid" borderColor="gray.200" minW="760px">
                                            <SimpleGrid columns={5} gap={3}>
                                                <Text fontSize="xs" color="gray.500" fontWeight="bold">Item</Text>
                                                <Text fontSize="xs" color="gray.500" fontWeight="bold">Merch Event</Text>
                                                <Text fontSize="xs" color="gray.500" fontWeight="bold">Organizer</Text>
                                                <Text fontSize="xs" color="gray.500" fontWeight="bold">Quantity</Text>
                                                <Text fontSize="xs" color="gray.500" fontWeight="bold">Purchased At</Text>
                                            </SimpleGrid>
                                        </Box>
                                        <Stack gap={0}>
                                            {purchaseRows.map((purchase, index) => (
                                                <Box
                                                    key={purchase.key}
                                                    px={4}
                                                    py={2.5}
                                                    minW="760px"
                                                    borderTop={index === 0 ? "none" : "1px solid"}
                                                    borderColor="gray.100"
                                                    cursor="pointer"
                                                    bg={selectedPurchaseKey === purchase.key ? "teal.50" : "white"}
                                                    onClick={() => setSelectedPurchaseKey(purchase.key)}
                                                >
                                                    <SimpleGrid columns={5} gap={3}>
                                                        <Text fontSize="sm" color="gray.800" fontWeight="medium">{purchase.itemName}</Text>
                                                        <Text fontSize="sm" color="gray.700">{purchase.eventName}</Text>
                                                        <Text fontSize="sm" color="gray.700">{purchase.organizerName}</Text>
                                                        <Text fontSize="sm" color="teal.700" fontWeight="semibold">{purchase.quantity}</Text>
                                                        <Text fontSize="sm" color="gray.700">{formatDateTime(purchase.purchasedAt)}</Text>
                                                    </SimpleGrid>
                                                </Box>
                                            ))}
                                        </Stack>
                                    </Box>

                                    <Box border="1px solid" borderColor="gray.200" borderRadius="md" p={4} bg="white">
                                        {selectedPurchaseRow ? (
                                            <Stack gap={3}>
                                                <Text fontSize="sm" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                                                    Purchase Ticket Details
                                                </Text>
                                                <Text fontSize="sm" color="gray.700">User ID: {selectedPurchaseRow.qrPayload?.userId || String(user?._id || "N/A")}</Text>
                                                <Text fontSize="sm" color="gray.700">Event ID: {selectedPurchaseRow.qrPayload?.eventId || "N/A"}</Text>
                                                <Text fontSize="sm" color="gray.700">Item ID: {selectedPurchaseRow.qrPayload?.itemId || selectedPurchaseRow.itemId}</Text>
                                                <Text fontSize="sm" color="gray.700">Participant Name: {selectedPurchaseRow.qrPayload?.participantName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "N/A"}</Text>
                                                <Text fontSize="sm" color="gray.700">Event Name: {selectedPurchaseRow.qrPayload?.eventName || selectedPurchaseRow.eventName}</Text>
                                                <Text fontSize="sm" color="gray.700">Item Name: {selectedPurchaseRow.qrPayload?.itemName || selectedPurchaseRow.itemName}</Text>
                                                <Text fontSize="sm" color="gray.700">Organizer Name: {selectedPurchaseRow.organizerName}</Text>
                                                <Text fontSize="sm" color="gray.700">Quantity: {selectedPurchaseRow.qrPayload?.quantity ?? selectedPurchaseRow.quantity}</Text>
                                                <Text fontSize="sm" color="gray.700">Cost per Item: {selectedPurchaseRow.qrPayload?.costPerItem ?? "N/A"}</Text>
                                                <Text fontSize="sm" color="gray.700">Total Cost: {selectedPurchaseRow.qrPayload?.totalCost ?? "N/A"}</Text>
                                                <Text fontSize="sm" color="gray.700">Purchase Date and Time: {formatDateTime(selectedPurchaseRow.qrPayload?.purchasedAt || selectedPurchaseRow.purchasedAt)}</Text>
                                                {selectedPurchaseRow.qrCodeDataUrl ? (
                                                    <Box as="img" src={selectedPurchaseRow.qrCodeDataUrl} alt="Purchase Ticket QR" maxW="220px" borderRadius="md" />
                                                ) : (
                                                    <Text fontSize="sm" color="gray.600">QR not available for this purchase.</Text>
                                                )}
                                            </Stack>
                                        ) : (
                                            <Text color="gray.600">Click a merchandise purchase row to view ticket details and QR.</Text>
                                        )}
                                    </Box>
                                </Stack>
                            )}
                        </Box>
                    </Stack>
                )}
            </Box>
        </Flex>
    );
};

export default HomePage;
