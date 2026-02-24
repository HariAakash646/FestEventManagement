import { useEffect, useState } from "react";
import {
    Badge,
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
    const [approvedPasswordsByRequestId, setApprovedPasswordsByRequestId] = useState({});
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
        const comment = window.prompt(`Optional comment for ${action.toLowerCase()} request:`, "") || "";
        setActioningId(id);
        setError("");
        try {
            const response = await apiCall(`/password-reset-requests/${id}`, "PUT", { action, comment });
            if (!response?.success) {
                setError(response?.message || `Failed to ${action.toLowerCase()} request`);
                return;
            }

            if (action === "Approved") {
                const temporaryPassword = response?.generatedCredentials?.temporaryPassword || "";
                if (temporaryPassword) {
                    setApprovedPasswordsByRequestId((prev) => ({
                        ...prev,
                        [id]: temporaryPassword,
                    }));
                }
            }

            setRequests((prev) =>
                prev.map((request) =>
                    request._id === id
                        ? {
                            ...request,
                            status: action,
                            reviewedAt: response?.data?.reviewedAt || new Date().toISOString(),
                            reviewComment: response?.data?.reviewComment || comment,
                            reviewHistory: response?.data?.reviewHistory || request.reviewHistory,
                        }
                        : request
                )
            );
        } catch {
            setError(`Something went wrong while trying to ${action.toLowerCase()} request.`);
        } finally {
            setActioningId(null);
        }
    };

    const statusBadge = (status) => {
        if (status === "Approved") return <Badge colorPalette="green">Approved</Badge>;
        if (status === "Rejected") return <Badge colorPalette="red">Rejected</Badge>;
        return <Badge colorPalette="orange">Pending</Badge>;
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
                                        <HStack>
                                            <Text fontWeight="semibold">{request.organizerName || "Unknown Organizer"}</Text>
                                            {statusBadge(request.status)}
                                        </HStack>
                                        <Text fontSize="sm" color="gray.700">Email: {request.organizerEmail || "N/A"}</Text>
                                        <Text fontSize="sm" color="gray.700">Organizer ID: {request.organizerId}</Text>
                                        <Text fontSize="sm" color="gray.700">Reason: {request.reasonForPasswordChangeRequest}</Text>
                                        <Text fontSize="sm" color="gray.700">Requested At: {formatDate(request.requestDate)}</Text>
                                        {request.reviewedAt && (
                                            <Text fontSize="sm" color="gray.700">Reviewed At: {formatDate(request.reviewedAt)}</Text>
                                        )}
                                        {request.reviewComment && (
                                            <Text fontSize="sm" color="gray.700">Review Comment: {request.reviewComment}</Text>
                                        )}
                                        {request.status === "Approved" && approvedPasswordsByRequestId[request._id] && (
                                            <Text fontSize="sm" color="teal.700" fontWeight="semibold">
                                                Generated Password: {approvedPasswordsByRequestId[request._id]}
                                            </Text>
                                        )}
                                    </Stack>

                                    {request.status === "Pending" ? (
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
                                    ) : (
                                        <Text fontSize="sm" color="gray.600">Reviewed</Text>
                                    )}
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
