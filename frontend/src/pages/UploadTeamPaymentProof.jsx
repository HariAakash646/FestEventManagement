import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
    Box,
    Button,
    Flex,
    Heading,
    Input,
    Stack,
    Text,
} from "@chakra-ui/react";
import { apiCall } from "../utils/api.js";

const UploadTeamPaymentProof = () => {
    const { eventId, teamCode } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const [paymentProof, setPaymentProof] = useState(null);
    const [submitError, setSubmitError] = useState("");
    const [submitSuccess, setSubmitSuccess] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [organizerUpiId, setOrganizerUpiId] = useState("");

    const paymentAmount = useMemo(() => {
        const raw = location.state?.paymentAmount;
        return typeof raw === "number" ? raw : 0;
    }, [location.state]);

    const eventName = location.state?.eventName || "Team Event";
    const teamJoinLink = location.state?.teamJoinLink || "";
    const roleLabel = location.state?.role === "leader" ? "Team Leader" : "Team Member";

    useEffect(() => {
        const fetchOrganizerUpi = async () => {
            try {
                const response = await apiCall(`/events/${eventId}`);
                if (!response?.success) {
                    setOrganizerUpiId("");
                    return;
                }
                setOrganizerUpiId(response?.data?.organizer?.organizerUpiId || "");
            } catch {
                setOrganizerUpiId("");
            }
        };
        fetchOrganizerUpi();
    }, [eventId]);

    const handleSubmitPaymentProof = async () => {
        setSubmitError("");
        setSubmitSuccess("");

        if (!paymentProof?.contentBase64) {
            setSubmitError("Please upload a payment proof before submitting.");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await apiCall(`/events/${eventId}/team-registration/${teamCode}/payment-proof`, "POST", {
                paymentProof,
            });
            if (!response?.success) {
                setSubmitError(response?.message || "Failed to submit team payment proof.");
                return;
            }

            setSubmitSuccess("Payment proof submitted. Waiting for organizer verification.");
            setTimeout(() => navigate(`/participant/events/${eventId}`), 900);
        } catch (err) {
            setSubmitError(err?.message || "Something went wrong while submitting payment proof.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="720px">
                <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                    <Heading size="md">Team Payment Proof Upload</Heading>
                    <Text color="gray.700">
                        Please complete payment of Rs. {paymentAmount} and upload payment proof here.
                    </Text>
                    {organizerUpiId && (
                        <Box border="1px solid" borderColor="teal.200" borderRadius="md" p={3} bg="teal.50">
                            <Text fontSize="sm" color="teal.900">
                                Pay to UPI ID: <b>{organizerUpiId}</b>
                            </Text>
                        </Box>
                    )}
                    <Text fontSize="sm" color="gray.600">Event: {eventName}</Text>
                    <Text fontSize="sm" color="gray.600">Role: {roleLabel}</Text>
                    {teamJoinLink && (
                        <Box border="1px solid" borderColor="teal.200" borderRadius="md" p={3} bg="teal.50">
                            <Text fontSize="sm" fontWeight="semibold" color="teal.800">Team Join Link</Text>
                            <Text fontSize="xs" color="teal.900" wordBreak="break-all">{teamJoinLink}</Text>
                        </Box>
                    )}

                    <Box>
                        <Text fontSize="sm" mb={1}>Payment Proof</Text>
                        <Input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) {
                                    setPaymentProof(null);
                                    return;
                                }
                                const reader = new FileReader();
                                reader.onload = () => {
                                    setPaymentProof({
                                        name: file.name,
                                        type: file.type,
                                        size: file.size,
                                        contentBase64: typeof reader.result === "string" ? reader.result : "",
                                    });
                                    setSubmitError("");
                                };
                                reader.onerror = () => {
                                    setPaymentProof(null);
                                    setSubmitError("Failed to read payment proof file.");
                                };
                                reader.readAsDataURL(file);
                            }}
                        />
                        {paymentProof?.name && (
                            <Text fontSize="xs" color="gray.600" mt={1}>Selected: {paymentProof.name}</Text>
                        )}
                    </Box>

                    {submitError && <Text color="red.500" fontSize="sm">{submitError}</Text>}
                    {submitSuccess && <Text color="green.600" fontSize="sm">{submitSuccess}</Text>}

                    <Button
                        colorPalette="teal"
                        onClick={handleSubmitPaymentProof}
                        loading={isSubmitting}
                    >
                        Submit Payment Proof
                    </Button>
                </Stack>
            </Box>
        </Flex>
    );
};

export default UploadTeamPaymentProof;
