import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Box,
    Button,
    Flex,
    Heading,
    HStack,
    Stack,
    Text,
} from "@chakra-ui/react";
import { apiCall } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const formatDateTime = (value) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleString();
};

const ParticipantOrganizerDetail = () => {
    const { organizerId } = useParams();
    const navigate = useNavigate();
    const { updateUser } = useAuth();

    const [organizer, setOrganizer] = useState(null);
    const [events, setEvents] = useState([]);
    const [followedClubs, setFollowedClubs] = useState([]);
    const [activeTab, setActiveTab] = useState("Upcoming");
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdatingFollow, setIsUpdatingFollow] = useState(false);
    const [error, setError] = useState("");

    const organizerIdNumber = Number(organizerId);
    const organizerContactEmail = organizer?.organizerContactEmail ?? organizer?.email;

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError("");
            try {
                const [usersResponse, eventsResponse, meResponse] = await Promise.all([
                    apiCall("/users"),
                    apiCall("/events"),
                    apiCall("/users/me"),
                ]);

                if (!usersResponse?.success) {
                    setError(usersResponse?.message || "Failed to fetch organizer details");
                    return;
                }

                if (!eventsResponse?.success) {
                    setError(eventsResponse?.message || "Failed to fetch events");
                    return;
                }

                if (!meResponse?.success) {
                    setError(meResponse?.message || "Failed to fetch profile");
                    return;
                }

                const users = Array.isArray(usersResponse.data) ? usersResponse.data : [];
                const foundOrganizer = users.find(
                    (user) =>
                        user.role === "Organizer" &&
                        user.active !== false &&
                        user.organizerId === organizerIdNumber
                );

                if (!foundOrganizer) {
                    setError("Organizer not found.");
                    setOrganizer(null);
                    return;
                }

                setOrganizer(foundOrganizer);

                const allEvents = Array.isArray(eventsResponse.data) ? eventsResponse.data : [];
                const organizerEvents = allEvents.filter(
                    (event) => event.organizerId === organizerIdNumber && event.status !== "Draft"
                );
                setEvents(organizerEvents);

                const me = meResponse.data || {};
                const followed = Array.isArray(me.followedClubs) ? me.followedClubs : [];
                setFollowedClubs(followed);

                if (updateUser) {
                    updateUser(me);
                }
            } catch {
                setError("Something went wrong while loading organizer details.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [organizerIdNumber, updateUser]);

    const isFollowing = useMemo(
        () => followedClubs.includes(organizerIdNumber),
        [followedClubs, organizerIdNumber]
    );

    const handleFollowToggle = async () => {
        const nextFollowed = isFollowing
            ? followedClubs.filter((id) => id !== organizerIdNumber)
            : [...followedClubs, organizerIdNumber];

        setIsUpdatingFollow(true);
        setError("");
        try {
            const response = await apiCall("/users/me/followed-clubs", "PUT", {
                followedClubs: nextFollowed,
            });
            if (!response?.success) {
                setError(response?.message || "Failed to update followed organizers");
                return;
            }

            setFollowedClubs(nextFollowed);
            if (updateUser) {
                updateUser(response.data);
            }
        } catch {
            setError("Something went wrong while updating followed organizers.");
        } finally {
            setIsUpdatingFollow(false);
        }
    };

    const now = new Date();
    const upcomingEvents = events
        .filter((event) => {
            const start = new Date(event.eventStartDate);
            return !Number.isNaN(start.getTime()) && start > now;
        })
        .sort((a, b) => new Date(a.eventStartDate) - new Date(b.eventStartDate));

    const ongoingEvents = events
        .filter((event) => {
            const start = new Date(event.eventStartDate);
            const end = new Date(event.eventEndDate);
            const isDateWindowOngoing =
                !Number.isNaN(start.getTime()) &&
                !Number.isNaN(end.getTime()) &&
                start <= now &&
                end >= now;
            return event.status === "Ongoing" || isDateWindowOngoing;
        })
        .sort((a, b) => new Date(a.eventStartDate) - new Date(b.eventStartDate));

    const pastEvents = events
        .filter((event) => {
            const end = new Date(event.eventEndDate);
            return !Number.isNaN(end.getTime()) && end < now;
        })
        .sort((a, b) => new Date(b.eventStartDate) - new Date(a.eventStartDate));

    let eventsToShow = upcomingEvents;
    if (activeTab === "Ongoing") eventsToShow = ongoingEvents;
    if (activeTab === "Past") eventsToShow = pastEvents;

    if (isLoading) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="980px">
                    <Text color="gray.600">Loading organizer details...</Text>
                </Box>
            </Flex>
        );
    }

    if (error || !organizer) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="980px">
                    <Text color="red.500">{error || "Organizer not found."}</Text>
                </Box>
            </Flex>
        );
    }

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="980px">
                <Stack gap={6}>
                    <Box p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" boxShadow="sm">
                        <Stack gap={3}>
                            <HStack justify="space-between" align="start" wrap="wrap">
                                <Heading size="lg">{organizer.organizerName}</Heading>
                                <HStack>
                                    <Button variant="outline" onClick={() => navigate("/participant/organizers")}>Back</Button>
                                    <Button
                                        colorPalette={isFollowing ? "gray" : "teal"}
                                        variant={isFollowing ? "outline" : "solid"}
                                        onClick={handleFollowToggle}
                                        loading={isUpdatingFollow}
                                    >
                                        {isFollowing ? "Unfollow" : "Follow"}
                                    </Button>
                                </HStack>
                            </HStack>
                            <Text color="gray.700">Category: {organizer.category || "N/A"}</Text>
                            <Text color="gray.700">Description: {organizer.description || "No description."}</Text>
                            <Text color="gray.700">Contact Email: {organizerContactEmail || "N/A"}</Text>
                        </Stack>
                    </Box>

                    <Box p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" boxShadow="sm">
                        <Stack gap={4}>
                            <HStack gap={2}>
                                <Button
                                    size="sm"
                                    colorPalette={activeTab === "Upcoming" ? "teal" : "gray"}
                                    variant={activeTab === "Upcoming" ? "solid" : "outline"}
                                    onClick={() => setActiveTab("Upcoming")}
                                >
                                    Upcoming
                                </Button>
                                <Button
                                    size="sm"
                                    colorPalette={activeTab === "Ongoing" ? "teal" : "gray"}
                                    variant={activeTab === "Ongoing" ? "solid" : "outline"}
                                    onClick={() => setActiveTab("Ongoing")}
                                >
                                    Ongoing
                                </Button>
                                <Button
                                    size="sm"
                                    colorPalette={activeTab === "Past" ? "teal" : "gray"}
                                    variant={activeTab === "Past" ? "solid" : "outline"}
                                    onClick={() => setActiveTab("Past")}
                                >
                                    Past
                                </Button>
                            </HStack>

                            {eventsToShow.length === 0 ? (
                                <Text color="gray.600">No {activeTab.toLowerCase()} events found.</Text>
                            ) : (
                                <Stack gap={3}>
                                    {eventsToShow.map((event) => (
                                        <Box key={event._id} border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                                            <Stack gap={1}>
                                                <Text fontWeight="semibold">{event.eventName}</Text>
                                                <Text fontSize="sm" color="gray.700">{event.eventDescription}</Text>
                                                <Text fontSize="sm" color="teal.700">Type: {event.eventType || "N/A"}</Text>
                                                <Text fontSize="sm" color="gray.700">
                                                    Start: {formatDateTime(event.eventStartDate)}
                                                </Text>
                                                <Text fontSize="sm" color="gray.700">
                                                    End: {formatDateTime(event.eventEndDate)}
                                                </Text>
                                                <Button
                                                    mt={1}
                                                    alignSelf="start"
                                                    size="sm"
                                                    variant="outline"
                                                    colorPalette="teal"
                                                    onClick={() => navigate(`/participant/events/${event._id}`)}
                                                >
                                                    View Event
                                                </Button>
                                            </Stack>
                                        </Box>
                                    ))}
                                </Stack>
                            )}
                        </Stack>
                    </Box>
                </Stack>
            </Box>
        </Flex>
    );
};

export default ParticipantOrganizerDetail;
