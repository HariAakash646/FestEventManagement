import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Badge,
    Box,
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

const OngoingEvents = () => {
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
                const filter = Number.isInteger(user?.organizerId)
                    ? `?lite=true&organizerId=${user.organizerId}`
                    : "?lite=true";
                const response = await apiCall(`/events${filter}`);
                if (!response?.success) {
                    setError(response?.message || "Failed to fetch events");
                    setEvents([]);
                    return;
                }
                setEvents(Array.isArray(response.data) ? response.data : []);
            } catch {
                setError("Something went wrong while fetching events.");
                setEvents([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchEvents();
    }, [user?.organizerId]);

    const ongoingEvents = useMemo(() => {
        if (!user?.organizerId) return [];
        return events.filter(
            (event) => event.organizerId === user.organizerId && event.status === "Ongoing"
        );
    }, [events, user?.organizerId]);

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="1080px">
                <Heading size="lg" mb={6}>
                    Ongoing Events
                </Heading>

                {isLoading && <Text color="gray.600">Loading events...</Text>}
                {!isLoading && error && <Text color="red.500">{error}</Text>}
                {!isLoading && !error && ongoingEvents.length === 0 && (
                    <Text color="gray.600">No ongoing events right now.</Text>
                )}

                {!isLoading && !error && ongoingEvents.length > 0 && (
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                        {ongoingEvents.map((event) => (
                            <Box
                                key={event._id}
                                p={5}
                                border="1px solid"
                                borderColor="gray.200"
                                borderRadius="lg"
                                bg="white"
                                boxShadow="sm"
                                cursor="pointer"
                                transition="all 0.2s ease"
                                _hover={{
                                    boxShadow: "md",
                                    borderColor: "teal.200",
                                    transform: "translateY(-2px)",
                                }}
                                onClick={() => navigate(`/organizer/eventInfo/${event._id}`)}
                            >
                                <Stack gap={2}>
                                    <Badge
                                        alignSelf="start"
                                        borderRadius="full"
                                        px={3}
                                        py={1}
                                        textTransform="none"
                                        fontWeight="semibold"
                                        bg="green.600"
                                        color="white"
                                    >
                                        Ongoing
                                    </Badge>
                                    <Text fontSize="lg" fontWeight="bold" color="gray.800">
                                        {event.eventName}
                                    </Text>
                                    <Text color="gray.700">{event.eventDescription}</Text>
                                    <Text fontSize="sm" color="gray.700">
                                        Start: {formatDateTime(event.eventStartDate)}
                                    </Text>
                                    <Text fontSize="sm" color="gray.700">
                                        End: {formatDateTime(event.eventEndDate)}
                                    </Text>
                                    <Text fontSize="sm" color="teal.700" fontWeight="semibold">
                                        Type: {event.eventType}
                                    </Text>
                                    {event.eventType === "Normal Event" && (
                                        <Text fontSize="sm" color="gray.700" fontWeight="medium">
                                            Registered Users:{" "}
                                            {event.registeredCount ??
                                                (Array.isArray(event.registeredFormList)
                                                    ? event.registeredFormList.length
                                                    : 0)}
                                        </Text>
                                    )}
                                </Stack>
                            </Box>
                        ))}
                    </SimpleGrid>
                )}
            </Box>
        </Flex>
    );
};

export default OngoingEvents;
