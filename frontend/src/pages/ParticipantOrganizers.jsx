import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const ParticipantOrganizers = () => {
    const navigate = useNavigate();
    const { updateUser } = useAuth();

    const [organizers, setOrganizers] = useState([]);
    const [followedClubs, setFollowedClubs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [updatingOrganizerId, setUpdatingOrganizerId] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError("");

            try {
                const [usersResponse, meResponse] = await Promise.all([
                    apiCall("/users"),
                    apiCall("/users/me"),
                ]);

                if (!usersResponse?.success) {
                    setError(usersResponse?.message || "Failed to fetch organizers");
                    setOrganizers([]);
                    return;
                }

                if (!meResponse?.success) {
                    setError(meResponse?.message || "Failed to fetch profile");
                    setOrganizers([]);
                    return;
                }

                const allUsers = Array.isArray(usersResponse.data) ? usersResponse.data : [];
                const approvedOrganizers = allUsers.filter(
                    (user) => user.role === "Organizer" && user.active !== false
                );

                setOrganizers(approvedOrganizers);

                const me = meResponse.data || {};
                const followed = Array.isArray(me.followedClubs) ? me.followedClubs : [];
                setFollowedClubs(followed);

                if (updateUser) {
                    updateUser(me);
                }
            } catch {
                setError("Something went wrong while fetching organizers.");
                setOrganizers([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [updateUser]);

    const handleFollowToggle = async (organizerId) => {
        const isFollowing = followedClubs.includes(organizerId);
        const nextFollowed = isFollowing
            ? followedClubs.filter((id) => id !== organizerId)
            : [...followedClubs, organizerId];

        setUpdatingOrganizerId(organizerId);
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
            setUpdatingOrganizerId(null);
        }
    };

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="980px">
                <Heading size="lg" mb={6}>Clubs / Organizers</Heading>

                {isLoading && <Text color="gray.600">Loading organizers...</Text>}
                {!isLoading && error && <Text color="red.500" mb={4}>{error}</Text>}
                {!isLoading && !error && organizers.length === 0 && (
                    <Text color="gray.600">No approved organizers found.</Text>
                )}

                {!isLoading && !error && organizers.length > 0 && (
                    <Stack gap={3}>
                        {organizers.map((organizer) => {
                            const isFollowing = followedClubs.includes(organizer.organizerId);
                            return (
                                <Box
                                    key={organizer._id}
                                    border="1px solid"
                                    borderColor="gray.200"
                                    borderRadius="md"
                                    p={4}
                                    bg="white"
                                    cursor="pointer"
                                    onClick={() => navigate(`/participant/organizers/${organizer.organizerId}`)}
                                >
                                    <HStack justify="space-between" align="start" gap={3}>
                                        <Stack gap={1}>
                                            <Text fontWeight="semibold" fontSize="lg">{organizer.organizerName}</Text>
                                            <Text fontSize="sm" color="gray.600">Category: {organizer.category || "N/A"}</Text>
                                            <Text fontSize="sm" color="gray.700">{organizer.description || "No description."}</Text>
                                        </Stack>

                                        <Button
                                            size="sm"
                                            colorPalette={isFollowing ? "gray" : "teal"}
                                            variant={isFollowing ? "outline" : "solid"}
                                            loading={updatingOrganizerId === organizer.organizerId}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleFollowToggle(organizer.organizerId);
                                            }}
                                        >
                                            {isFollowing ? "Unfollow" : "Follow"}
                                        </Button>
                                    </HStack>
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </Box>
        </Flex>
    );
};

export default ParticipantOrganizers;
