import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Badge,
    Box,
    Button,
    Flex,
    Heading,
    HStack,
    Input,
    SimpleGrid,
    Stack,
    Text,
} from "@chakra-ui/react";
import { apiCall } from "../utils/api.js";

const formatDateTime = (value) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleString();
};

const BrowseEvents = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [users, setUsers] = useState([]);
    const [tags, setTags] = useState([]);
    const [profile, setProfile] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showTrending, setShowTrending] = useState(false);
    const [filterFollowedClubs, setFilterFollowedClubs] = useState(false);
    const [filterInterests, setFilterInterests] = useState(false);
    const [filterFromDate, setFilterFromDate] = useState("");
    const [filterToDate, setFilterToDate] = useState("");
    const [filterEventType, setFilterEventType] = useState("All");
    const [filterEligibility, setFilterEligibility] = useState("All");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const clearFilters = () => {
        setSearchTerm("");
        setShowTrending(false);
        setFilterFollowedClubs(false);
        setFilterInterests(false);
        setFilterFromDate("");
        setFilterToDate("");
        setFilterEventType("All");
        setFilterEligibility("All");
    };

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError("");

            try {
                const [eventsResponse, usersResponse, meResponse, tagsResponse] = await Promise.all([
                    apiCall("/events?lite=true"),
                    apiCall("/users?role=Organizer&lite=true"),
                    apiCall("/users/me"),
                    apiCall("/tags"),
                ]);

                if (!eventsResponse?.success) {
                    setError(eventsResponse?.message || "Failed to fetch events");
                    setEvents([]);
                    setUsers([]);
                    return;
                }

                if (!usersResponse?.success) {
                    setError(usersResponse?.message || "Failed to fetch users");
                    setEvents([]);
                    setUsers([]);
                    return;
                }

                if (!meResponse?.success) {
                    setError(meResponse?.message || "Failed to fetch profile");
                    setEvents([]);
                    setUsers([]);
                    return;
                }

                setEvents(Array.isArray(eventsResponse.data) ? eventsResponse.data : []);
                setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
                setProfile(meResponse.data || null);
                if (tagsResponse?.success) {
                    setTags(Array.isArray(tagsResponse.data) ? tagsResponse.data : []);
                }
            } catch (err) {
                setError("Something went wrong while fetching events.");
                setEvents([]);
                setUsers([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const organizerNameById = useMemo(() => {
        const map = new Map();
        users.forEach((user) => {
            if (user.role === "Organizer" && Number.isInteger(user.organizerId)) {
                map.set(user.organizerId, user.organizerName || "Unknown Organizer");
            }
        });
        return map;
    }, [users]);

    const browseableEvents = useMemo(() => {
        return events.filter((event) => event.status === "Published" || event.status === "Ongoing");
    }, [events]);

    const normalizeText = (value) => (value || "").toLowerCase().replace(/\s+/g, " ").trim();

    const fuzzyIncludes = (text, query) => {
        if (!query) return true;
        if (text.includes(query)) return true;

        let qi = 0;
        for (let i = 0; i < text.length && qi < query.length; i += 1) {
            if (text[i] === query[qi]) qi += 1;
        }
        return qi === query.length;
    };

    const filteredEvents = useMemo(() => {
        const query = normalizeText(searchTerm);
        if (!query) return browseableEvents;

        return browseableEvents.filter((event) => {
            const eventName = normalizeText(event.eventName);
            const organizerName = normalizeText(organizerNameById.get(event.organizerId) || "");
            return fuzzyIncludes(eventName, query) || fuzzyIncludes(organizerName, query);
        });
    }, [browseableEvents, organizerNameById, searchTerm]);

    const trendingEvents = useMemo(() => {
        return [...browseableEvents]
            .sort(
                (a, b) =>
                    (Array.isArray(b.visitsTimeStamps) ? b.visitsTimeStamps.length : 0) -
                    (Array.isArray(a.visitsTimeStamps) ? a.visitsTimeStamps.length : 0)
            )
            .slice(0, 5);
    }, [browseableEvents]);

    const interestTagNames = useMemo(() => {
        const interestIds = Array.isArray(profile?.interests) ? profile.interests.map((id) => String(id)) : [];
        const tagMap = new Map((Array.isArray(tags) ? tags : []).map((tag) => [String(tag._id), tag.name]));
        return interestIds.map((id) => tagMap.get(id)).filter(Boolean);
    }, [profile?.interests, tags]);

    const filteredByControls = useMemo(() => {
        if (showTrending) return trendingEvents;

        const from = filterFromDate ? new Date(`${filterFromDate}T00:00:00`) : null;
        const to = filterToDate ? new Date(`${filterToDate}T23:59:59`) : null;
        const followed = Array.isArray(profile?.followedClubs) ? profile.followedClubs : [];

        return filteredEvents.filter((event) => {
            if (filterEventType !== "All" && event.eventType !== filterEventType) return false;
            if (filterEligibility !== "All" && event.eligibility !== filterEligibility) return false;

            if (filterFollowedClubs && !followed.includes(event.organizerId)) return false;

            if (filterInterests) {
                const eventTags = Array.isArray(event.eventTags) ? event.eventTags : [];
                const hasInterestMatch = eventTags.some((tag) => interestTagNames.includes(tag));
                if (!hasInterestMatch) return false;
            }

            const start = new Date(event.eventStartDate);
            const end = new Date(event.eventEndDate);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

            if (from && start < from) return false;
            if (from && end < from) return false;
            if (to && start > to) return false;
            if (to && end > to) return false;

            return true;
        });
    }, [
        filteredEvents,
        trendingEvents,
        showTrending,
        filterFromDate,
        filterToDate,
        filterEventType,
        filterEligibility,
        filterFollowedClubs,
        filterInterests,
        profile?.followedClubs,
        interestTagNames,
    ]);

    const eventsToRender = filteredByControls;

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="1080px">
                <Heading size="lg" mb={6}>
                    Browse Events
                </Heading>

                <HStack mb={4} gap={2} align="start">
                    <Input
                        placeholder="Search events or organizers"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={showTrending}
                    />
                    <Button
                        type="button"
                        variant={showTrending ? "solid" : "outline"}
                        colorPalette="blue"
                        onClick={() => setShowTrending((prev) => !prev)}
                    >
                        Trending
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        colorPalette="gray"
                        onClick={clearFilters}
                    >
                        Clear Filters
                    </Button>
                </HStack>

                <Stack mb={5} gap={3} p={4} border="1px solid" borderColor="gray.200" borderRadius="md" bg="gray.50">
                    <Text fontSize="sm" fontWeight="semibold" color="gray.700">Filters</Text>

                    <HStack gap={4} wrap="wrap">
                        <Text as="label" fontSize="sm" display="flex" alignItems="center" gap={2} color={showTrending ? "gray.400" : "gray.700"}>
                            <input
                                type="checkbox"
                                checked={filterFollowedClubs}
                                disabled={showTrending}
                                onChange={(e) => setFilterFollowedClubs(e.target.checked)}
                            />
                            Followed Clubs
                        </Text>
                        <Text as="label" fontSize="sm" display="flex" alignItems="center" gap={2} color={showTrending ? "gray.400" : "gray.700"}>
                            <input
                                type="checkbox"
                                checked={filterInterests}
                                disabled={showTrending}
                                onChange={(e) => setFilterInterests(e.target.checked)}
                            />
                            Interests (Tags)
                        </Text>
                    </HStack>

                    <HStack gap={3} wrap="wrap">
                        <Box>
                            <Text fontSize="xs" color="gray.600" mb={1}>From Date</Text>
                            <Input
                                type="date"
                                value={filterFromDate}
                                onChange={(e) => setFilterFromDate(e.target.value)}
                                disabled={showTrending}
                            />
                        </Box>
                        <Box>
                            <Text fontSize="xs" color="gray.600" mb={1}>To Date</Text>
                            <Input
                                type="date"
                                value={filterToDate}
                                onChange={(e) => setFilterToDate(e.target.value)}
                                disabled={showTrending}
                            />
                        </Box>
                        <Box>
                            <Text fontSize="xs" color="gray.600" mb={1}>Event Type</Text>
                            <select
                                value={filterEventType}
                                onChange={(e) => setFilterEventType(e.target.value)}
                                disabled={showTrending}
                                style={{ padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #E2E8F0", minWidth: "180px" }}
                            >
                                <option value="All">All</option>
                                <option value="Normal Event">Normal Event</option>
                                <option value="Merchandise Event">Merchandise Event</option>
                            </select>
                        </Box>
                        <Box>
                            <Text fontSize="xs" color="gray.600" mb={1}>Eligibility</Text>
                            <select
                                value={filterEligibility}
                                onChange={(e) => setFilterEligibility(e.target.value)}
                                disabled={showTrending}
                                style={{ padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #E2E8F0", minWidth: "200px" }}
                            >
                                <option value="All">All</option>
                                <option value="Must be a IIIT Student">Must be a IIIT Student</option>
                                <option value="Open to all">Open to all</option>
                            </select>
                        </Box>
                    </HStack>
                </Stack>

                {isLoading && <Text color="gray.600">Loading events...</Text>}
                {!isLoading && error && <Text color="red.500">{error}</Text>}
                {!isLoading && !error && eventsToRender.length === 0 && (
                    <Text color="gray.600">No published or ongoing events right now.</Text>
                )}

                {!isLoading && !error && eventsToRender.length > 0 && (
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                        {eventsToRender.map((event) => (
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
                                _hover={{ boxShadow: "md", borderColor: "teal.200", transform: "translateY(-2px)" }}
                                onClick={() => navigate(`/participant/events/${event._id}`)}
                            >
                                <Stack gap={2}>
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
                                    <Text fontSize="sm" color="gray.700">
                                        Start: {formatDateTime(event.eventStartDate)}
                                    </Text>
                                    <Text fontSize="sm" color="gray.700">
                                        End: {formatDateTime(event.eventEndDate)}
                                    </Text>
                                    <Text fontSize="sm" color="teal.700" fontWeight="semibold">
                                        Organizer: {organizerNameById.get(event.organizerId) || "Unknown Organizer"}
                                    </Text>
                                </Stack>
                            </Box>
                        ))}
                    </SimpleGrid>
                )}
            </Box>
        </Flex>
    );
};

export default BrowseEvents;
