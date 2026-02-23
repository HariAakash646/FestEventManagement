import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Flex,
    Heading,
    HStack,
    Spinner,
    Stack,
    Text,
} from "@chakra-ui/react";
import { apiCall } from "../utils/api.js";

const ManageOrganizers = () => {
    const [organizers, setOrganizers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [statusUpdatingId, setStatusUpdatingId] = useState(null);
    const [error, setError] = useState("");

    const fetchOrganizers = async () => {
        setLoading(true);
        setError("");

        try {
            const data = await apiCall("/users");
            if (!data.success) {
                setError(data.message || "Failed to fetch organizers");
                setLoading(false);
                return;
            }

            const organizerUsers = (data.data || []).filter((user) => user.role === "Organizer");
            setOrganizers(organizerUsers);
        } catch (err) {
            setError("Something went wrong while fetching organizers.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrganizers();
    }, []);

    const handleDelete = async (id) => {
        const confirmed = window.confirm("Delete this organizer?");
        if (!confirmed) return;

        setDeletingId(id);
        setError("");

        try {
            const data = await apiCall(`/users/${id}`, "DELETE");
            if (!data.success) {
                setError(data.message || "Failed to delete organizer");
                return;
            }

            setOrganizers((prev) => prev.filter((org) => org._id !== id));
        } catch (err) {
            setError("Something went wrong while deleting organizer.");
        } finally {
            setDeletingId(null);
        }
    };

    const handleStatusToggle = async (organizer) => {
        const isActive = organizer.active !== false;

        setStatusUpdatingId(organizer._id);
        setError("");

        try {
            const data = isActive
                ? await apiCall(`/users/${organizer._id}`, "PUT", { active: false })
                : await apiCall(`/users/${organizer._id}/unarchive`, "POST");

            if (!data.success) {
                setError(data.message || "Failed to update organizer status");
                return;
            }

            setOrganizers((prev) =>
                prev.map((org) =>
                    org._id === organizer._id ? { ...org, active: !isActive } : org
                )
            );
        } catch (err) {
            setError("Something went wrong while updating organizer status.");
        } finally {
            setStatusUpdatingId(null);
        }
    };

    return (
        <Box maxW="900px" mx="auto" px={4} py={6}>
            <Heading size="lg" mb={5}>Manage Organizers</Heading>

            {error && (
                <Text color="red.500" mb={4}>{error}</Text>
            )}

            {loading ? (
                <Flex justify="center" py={10}>
                    <Spinner size="lg" color="teal.500" />
                </Flex>
            ) : organizers.length === 0 ? (
                <Text color="gray.600">No organizers registered yet.</Text>
            ) : (
                <Stack gap={3}>
                    {organizers.map((organizer) => {
                        const isActive = organizer.active !== false;
                        return (
                        <HStack
                            key={organizer._id}
                            justify="space-between"
                            align="start"
                            border="1px solid"
                            borderColor="gray.200"
                            borderRadius="md"
                            p={4}
                            bg="white"
                        >
                            <Box>
                                <Text fontWeight="semibold">{organizer.organizerName}</Text>
                                <Text fontSize="sm" color="gray.600">{organizer.email}</Text>
                                <Text fontSize="sm" color="gray.600">Organizer ID: {organizer.organizerId}</Text>
                                <Text fontSize="sm" color="gray.600">Category: {organizer.category}</Text>
                                <Text fontSize="sm" color="gray.600">
                                    Status: {isActive ? "Active" : "Inactive"}
                                </Text>
                            </Box>

                            <Stack gap={2}>
                                <Button
                                    colorPalette="red"
                                    variant="solid"
                                    size="sm"
                                    onClick={() => handleDelete(organizer._id)}
                                    loading={deletingId === organizer._id}
                                    disabled={
                                        deletingId !== null && deletingId !== organizer._id
                                    }
                                >
                                    Remove
                                </Button>
                                <Button
                                    colorPalette={isActive ? "orange" : "teal"}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleStatusToggle(organizer)}
                                    loading={statusUpdatingId === organizer._id}
                                    disabled={
                                        statusUpdatingId !== null &&
                                        statusUpdatingId !== organizer._id
                                    }
                                >
                                    {isActive ? "Archive" : "Unarchive"}
                                </Button>
                            </Stack>
                        </HStack>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
};

export default ManageOrganizers;
