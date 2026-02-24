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

const UploadMerchPaymentProof = () => {
    const { itemId } = useParams();
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
    const quantity = useMemo(() => Number(location.state?.quantity || 1), [location.state]);
    const eventId = location.state?.eventId || "";
    const eventName = location.state?.eventName || "Merchandise Event";
    const itemName = location.state?.itemName || "Item";
    const selectedColor = location.state?.selectedColor || "";
    const selectedSize = location.state?.selectedSize || "";

    const handleSubmit = async () => {
        setSubmitError("");
        setSubmitSuccess("");

        if (!paymentProof?.contentBase64) {
            setSubmitError("Please upload a payment proof before submitting.");
            return;
        }
        if (!Number.isInteger(quantity) || quantity < 1) {
            setSubmitError("Invalid quantity.");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await apiCall(`/items/${itemId}/purchase-requests`, "POST", {
                quantity,
                paymentProof,
                selectedColor,
                selectedSize,
            });
            if (!response?.success) {
                setSubmitError(response?.message || "Failed to submit payment proof.");
                return;
            }
            setSubmitSuccess("Purchase request submitted. Waiting for organizer approval.");
            setTimeout(() => navigate(eventId ? `/participant/events/${eventId}` : "/participant/browse-events"), 800);
        } catch (err) {
            setSubmitError(err?.message || "Something went wrong while submitting payment proof.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!itemId || !eventId) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="720px">
                    <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                        <Heading size="md">Merchandise Payment Proof</Heading>
                        <Text color="gray.700">Purchase context is missing. Please start purchase again from event page.</Text>
                        <Button colorPalette="teal" onClick={() => navigate("/participant/browse-events")}>
                            Back to Browse Events
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
                    <Heading size="md">Merchandise Payment Proof</Heading>
                    <Text color="gray.700">
                        Please complete payment of Rs. {paymentAmount} and upload payment proof here.
                    </Text>
                    <Text fontSize="sm" color="gray.600">Event: {eventName}</Text>
                    <Text fontSize="sm" color="gray.600">Item: {itemName}</Text>
                    <Text fontSize="sm" color="gray.600">Quantity: {quantity}</Text>
                    <Text fontSize="sm" color="gray.600">Color: {selectedColor || "N/A"}</Text>
                    <Text fontSize="sm" color="gray.600">Size: {selectedSize || "N/A"}</Text>

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

                    <Button colorPalette="teal" onClick={handleSubmit} loading={isSubmitting}>
                        Submit Purchase Request
                    </Button>
                </Stack>
            </Box>
        </Flex>
    );
};

export default UploadMerchPaymentProof;
