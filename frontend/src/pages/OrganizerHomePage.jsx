import { useEffect, useMemo, useState } from "react";
import {
    Badge,
    Box,
    Button,
    Flex,
    Heading,
    HStack,
    SimpleGrid,
    Stack,
    Text,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiCall } from "../utils/api.js";

const statusBadgeStyles = {
    Draft: { bg: "yellow.200", color: "yellow.800" },
    Published: { bg: "green.200", color: "green.800" },
    Ongoing: { bg: "green.600", color: "white" },
    Completed: { bg: "blue.600", color: "white" },
    Cancelled: { bg: "red.600", color: "white" },
    Closed: { bg: "red.500", color: "white" },
};

const OrganizerHome = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchEvents = async () => {
            setIsLoading(true);
            setError("");

            try {
                const organizerFilter = Number.isInteger(user?.organizerId) ? `?lite=true&organizerId=${user.organizerId}` : "?lite=true";
                const response = await apiCall(`/events${organizerFilter}`);
                if (!response?.success) {
                    setError(response?.message || "Failed to fetch events");
                    setEvents([]);
                    return;
                }

                const fetchedEvents = Array.isArray(response.data) ? response.data : [];

                const now = new Date();
                const publishedToOngoing = fetchedEvents.filter((event) => {
                    if (event.organizerId !== user?.organizerId) return false;
                    if (event.status !== "Published") return false;
                    if (!event.eventStartDate || !event.eventEndDate) return false;

                    const start = new Date(event.eventStartDate);
                    const end = new Date(event.eventEndDate);
                    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

                    return now >= start && now <= end;
                });

                if (publishedToOngoing.length === 0) {
                    setEvents(fetchedEvents);
                    return;
                }

                const updateResults = await Promise.all(
                    publishedToOngoing.map(async (event) => {
                        try {
                            const updateResponse = await apiCall(`/events/${event._id}`, "PUT", { status: "Ongoing" });
                            return updateResponse?.success ? updateResponse.data : null;
                        } catch (err) {
                            return null;
                        }
                    })
                );

                const updatedById = new Map(
                    updateResults
                        .filter(Boolean)
                        .map((updatedEvent) => [updatedEvent._id, updatedEvent])
                );

                setEvents(
                    fetchedEvents.map((event) => updatedById.get(event._id) || event)
                );
            } catch (err) {
                setError("Something went wrong while fetching events");
                setEvents([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEvents();
    }, [user?.organizerId]);

    const organizerEvents = useMemo(() => {
        if (!user?.organizerId) return [];
        return events.filter((event) => event.organizerId === user.organizerId);
    }, [events, user?.organizerId]);

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="1080px">
                <Heading size="lg" mb={6}>
                    Your Events
                </Heading>

                {isLoading && (
                    <Text color="gray.600">Loading events...</Text>
                )}

                {!isLoading && error && (
                    <Text color="red.500">{error}</Text>
                )}

                {!isLoading && !error && organizerEvents.length === 0 && (
                    <Text color="gray.600">
                        No events found for this organizer.
                    </Text>
                )}

                {!isLoading && !error && organizerEvents.length > 0 && (
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                        {organizerEvents.map((event) => (
                            <Box
                                key={event._id}
                                p={5}
                                border="1px solid"
                                borderColor="gray.200"
                                borderRadius="lg"
                                bg="white"
                                boxShadow="sm"
                            >
                                <Stack gap={3}>
                                    <Badge
                                        alignSelf="start"
                                        borderRadius="full"
                                        px={3}
                                        py={1}
                                        textTransform="none"
                                        fontWeight="semibold"
                                        bg={statusBadgeStyles[event.status]?.bg || "gray.200"}
                                        color={statusBadgeStyles[event.status]?.color || "gray.800"}
                                    >
                                        {event.status || "Draft"}
                                    </Badge>
                                    <Text fontSize="lg" fontWeight="bold" color="gray.800">
                                        {event.eventName}
                                    </Text>
                                    <Text color="gray.700">
                                        {event.eventDescription}
                                    </Text>
                                    {Array.isArray(event.eventTags) && event.eventTags.length > 0 && (
                                        <HStack gap={2} wrap="wrap">
                                            {event.eventTags.map((tag) => (
                                                <Badge
                                                    key={tag}
                                                    bg="blue.100"
                                                    color="blue.700"
                                                    borderRadius="full"
                                                    px={2.5}
                                                    py={1}
                                                    textTransform="none"
                                                    fontSize="xs"
                                                >
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </HStack>
                                    )}
                                    <Text fontSize="sm" color="teal.700" fontWeight="semibold">
                                        Type: {event.eventType}
                                    </Text>
                                    {event.eventType === "Normal Event" && (
                                        <Text fontSize="sm" color="gray.700" fontWeight="medium">
                                            Registered Users: {Array.isArray(event.registeredFormList) ? event.registeredFormList.length : 0}
                                        </Text>
                                    )}
                                    <Button
                                        colorPalette="teal"
                                        variant="outline"
                                        alignSelf="start"
                                        onClick={() => navigate(`/organizer/eventInfo/${event._id}`)}
                                    >
                                        Event Info / Edit
                                    </Button>
                                </Stack>
                            </Box>
                        ))}
                    </SimpleGrid>
                )}
            </Box>
        </Flex>
    );
};

export default OrganizerHome;
