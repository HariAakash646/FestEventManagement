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

const formatDate = (value) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleString();
};

const PasswordResetRequests = () => {
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [actioningId, setActioningId] = useState(null);

    const fetchRequests = async () => {
        setIsLoading(true);
        setError("");

        try {
            const response = await apiCall("/password-reset-requests");
            if (!response?.success) {
                setError(response?.message || "Failed to fetch password reset requests");
                setRequests([]);
                return;
            }

            setRequests(Array.isArray(response.data) ? response.data : []);
        } catch {
            setError("Something went wrong while fetching password reset requests.");
            setRequests([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleAction = async (id, action) => {
        setActioningId(id);
        setError("");
        try {
            const response = await apiCall(`/password-reset-requests/${id}`, "PUT", { action });
            if (!response?.success) {
                setError(response?.message || `Failed to ${action.toLowerCase()} request`);
                return;
            }

            setRequests((prev) => prev.filter((request) => request._id !== id));
        } catch {
            setError(`Something went wrong while trying to ${action.toLowerCase()} request.`);
        } finally {
            setActioningId(null);
        }
    };

    return (
        <Box maxW="980px" mx="auto" px={4} py={6}>
            <Heading size="lg" mb={5}>Password Reset Requests</Heading>

            {error && (
                <Text color="red.500" mb={4}>{error}</Text>
            )}

            {isLoading ? (
                <Flex justify="center" py={10}>
                    <Spinner size="lg" color="teal.500" />
                </Flex>
            ) : requests.length === 0 ? (
                <Text color="gray.600">No password reset requests available.</Text>
            ) : (
                <Stack gap={3}>
                    {requests.map((request) => {
                        return (
                            <Box
                                key={request._id}
                                border="1px solid"
                                borderColor="gray.200"
                                borderRadius="md"
                                p={4}
                                bg="white"
                            >
                                <HStack justify="space-between" align="start" flexWrap="wrap" gap={3}>
                                    <Stack gap={1}>
                                        <Text fontWeight="semibold">{request.organizerName || "Unknown Organizer"}</Text>
                                        <Text fontSize="sm" color="gray.700">Email: {request.organizerEmail || "N/A"}</Text>
                                        <Text fontSize="sm" color="gray.700">Organizer ID: {request.organizerId}</Text>
                                        <Text fontSize="sm" color="gray.700">Reason: {request.reasonForPasswordChangeRequest}</Text>
                                        <Text fontSize="sm" color="gray.700">Requested At: {formatDate(request.requestDate)}</Text>
                                    </Stack>

                                    <HStack gap={2}>
                                        <Button
                                            colorPalette="green"
                                            size="sm"
                                            onClick={() => handleAction(request._id, "Approved")}
                                            loading={actioningId === request._id}
                                            disabled={actioningId !== null && actioningId !== request._id}
                                        >
                                            Approve
                                        </Button>
                                        <Button
                                            colorPalette="red"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleAction(request._id, "Rejected")}
                                            loading={actioningId === request._id}
                                            disabled={actioningId !== null && actioningId !== request._id}
                                        >
                                            Reject
                                        </Button>
                                    </HStack>
                                </HStack>
                            </Box>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
};

export default PasswordResetRequests;
