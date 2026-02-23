import { useMemo, useState } from "react";
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

const UploadPaymentProof = () => {
    const { eventId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const [paymentProof, setPaymentProof] = useState(null);
    const [submitError, setSubmitError] = useState("");
    const [submitSuccess, setSubmitSuccess] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const paymentAmount = useMemo(() => {
        const raw = location.state?.paymentAmount;
        return typeof raw === "number" ? raw : 0;
    }, [location.state]);

    const formResponses = useMemo(() => {
        const raw = location.state?.formResponses;
        return raw && typeof raw === "object" ? raw : null;
    }, [location.state]);

    const eventName = location.state?.eventName || "Event";

    const handleCompleteRegistration = async () => {
        setSubmitError("");
        setSubmitSuccess("");

        if (paymentAmount > 0 && !paymentProof?.contentBase64) {
            setSubmitError("Please upload a payment proof before completing registration.");
            return;
        }

        if (!formResponses) {
            setSubmitError("Registration form data is missing. Please fill the registration form again.");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await apiCall(`/events/${eventId}/registration-requests`, "POST", {
                formResponses,
                paymentProof,
            });
            if (!response?.success) {
                setSubmitError(response?.message || "Failed to submit payment proof.");
                return;
            }

            setSubmitSuccess("Payment proof submitted. Waiting for organizer approval.");
            setTimeout(() => navigate(`/participant/events/${eventId}`), 800);
        } catch (err) {
            setSubmitError(err?.message || "Something went wrong while completing registration.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!formResponses) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="720px">
                    <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                        <Heading size="md">Payment Proof Upload</Heading>
                        <Text color="gray.700">
                            Registration form data was not found. Please go back and submit the registration form again.
                        </Text>
                        <Button colorPalette="teal" onClick={() => navigate(`/participant/registerEvent/${eventId}`)}>
                            Back to Registration Form
                        </Button>
                    </Stack>
                </Box>
            </Flex>
        );
    }

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="720px">
                <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                    <Heading size="md">Payment Proof Upload</Heading>
                    <Text color="gray.700">
                        Please complete payment of Rs. {paymentAmount} and upload payment proof here.
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                        Event: {eventName}
                    </Text>

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
                            <Text fontSize="xs" color="gray.600" mt={1}>
                                Selected: {paymentProof.name}
                            </Text>
                        )}
                    </Box>

                    {submitError && <Text color="red.500" fontSize="sm">{submitError}</Text>}
                    {submitSuccess && <Text color="green.600" fontSize="sm">{submitSuccess}</Text>}

                    <Button
                        colorPalette="teal"
                        onClick={handleCompleteRegistration}
                        loading={isSubmitting}
                    >
                        Complete Registration
                    </Button>
                </Stack>
            </Box>
        </Flex>
    );
};

export default UploadPaymentProof;
