import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box,
    Button,
    Flex,
    Heading,
    Stack,
    Text,
} from "@chakra-ui/react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiCall } from "../utils/api.js";

const FollowOrganizations = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const [organizers, setOrganizers] = useState([]);
    const [selectedOrganizerIds, setSelectedOrganizerIds] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchOrganizers = async () => {
            setIsLoading(true);
            setError("");
            try {
                const response = await apiCall("/users");
                if (!response?.success) {
                    setError(response?.message || "Failed to fetch organizations");
                    setOrganizers([]);
                    return;
                }

                const users = Array.isArray(response.data) ? response.data : [];
                const clubs = users.filter((u) => u.role === "Organizer");
                setOrganizers(clubs);

                const existing = Array.isArray(user?.followedClubs)
                    ? user.followedClubs
                    : [];
                setSelectedOrganizerIds(existing);
            } catch {
                setError("Something went wrong while fetching organizations.");
                setOrganizers([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrganizers();
    }, [user?.followedClubs]);

    const toggleFollow = (organizerId) => {
        setSelectedOrganizerIds((prev) =>
            prev.includes(organizerId)
                ? prev.filter((id) => id !== organizerId)
                : [...prev, organizerId]
        );
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError("");
        try {
            const response = await apiCall("/users/me/followed-clubs", "PUT", {
                followedClubs: selectedOrganizerIds,
            });

            if (!response?.success) {
                setError(response?.message || "Failed to update followed organizations");
                return;
            }

            if (updateUser) {
                updateUser(response.data);
            }

            navigate("/participant/browse-events");
        } catch {
            setError("Something went wrong while updating followed organizations.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="720px">
                <Heading size="lg" mb={6}>Follow Organizations</Heading>

                {isLoading ? (
                    <Text color="gray.600">Loading organizations...</Text>
                ) : (
                    <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                        <Text fontSize="sm" color="gray.600">
                            Select zero or more organizations to follow.
                        </Text>

                        {organizers.length === 0 ? (
                            <Text fontSize="sm" color="gray.600">No organizations available.</Text>
                        ) : (
                            <Stack gap={2}>
                                {organizers.map((organizer) => (
                                    <Text key={organizer._id} as="label" fontSize="sm" display="flex" alignItems="center" gap={2}>
                                        <input
                                            type="checkbox"
                                            checked={selectedOrganizerIds.includes(organizer.organizerId)}
                                            onChange={() => toggleFollow(organizer.organizerId)}
                                        />
                                        {organizer.organizerName}
                                    </Text>
                                ))}
                            </Stack>
                        )}

                        {error && <Text color="red.500" fontSize="sm">{error}</Text>}

                        <Button colorPalette="teal" onClick={handleSubmit} loading={isSubmitting}>
                            Save and Finish
                        </Button>
                    </Stack>
                )}
            </Box>
        </Flex>
    );
};

export default FollowOrganizations;
