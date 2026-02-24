import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Badge,
    Box,
    Button,
    Flex,
    Heading,
    Input,
    SimpleGrid,
    Stack,
    Text,
    Textarea,
} from "@chakra-ui/react";
import { apiCall } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const statusBadgeStyles = {
    Published: { bg: "green.200", color: "green.800" },
    Ongoing: { bg: "green.600", color: "white" },
    Completed: { bg: "blue.600", color: "white" },
    Closed: { bg: "blue.700", color: "white" },
    Cancelled: { bg: "red.600", color: "white" },
};

const formatDateTime = (value) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleString();
};

const InfoRow = ({ label, value }) => (
    <Box>
        <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">
            {label}
        </Text>
        <Text fontSize="sm" color="gray.800" fontWeight="medium">
            {value}
        </Text>
    </Box>
);

const ParticipantEventInfo = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [event, setEvent] = useState(null);
    const [organizer, setOrganizer] = useState(null);
    const [items, setItems] = useState([]);
    const [purchaseQuantities, setPurchaseQuantities] = useState({});
    const [itemSelections, setItemSelections] = useState({});
    const [purchaseError, setPurchaseError] = useState("");
    const [purchaseSuccess, setPurchaseSuccess] = useState("");
    const [purchasingItemId, setPurchasingItemId] = useState("");
    const [feedbackRating, setFeedbackRating] = useState("5");
    const [feedbackComment, setFeedbackComment] = useState("");
    const [myFeedback, setMyFeedback] = useState(null);
    const [feedbackMeta, setFeedbackMeta] = useState({
        isRegistered: false,
        hasAttended: false,
        canSubmit: false,
    });
    const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackError, setFeedbackError] = useState("");
    const [feedbackSuccess, setFeedbackSuccess] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError("");
            try {
                const eventResponse = await apiCall(`/events/${eventId}`);

                if (!eventResponse?.success) {
                    setError(eventResponse?.message || "Failed to fetch event details");
                    setEvent(null);
                    setOrganizer(null);
                    return;
                }

                const payload = eventResponse.data || {};
                setEvent(payload.event || null);
                setOrganizer(payload.organizer || null);
            } catch (err) {
                setError("Something went wrong while fetching event details.");
                setEvent(null);
                setOrganizer(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [eventId]);

    useEffect(() => {
        const recordVisit = async () => {
            if (!event?._id || user?.role !== "Participant") return;
            try {
                await apiCall(`/events/${event._id}/visit`, "PUT");
            } catch {
                // Ignore visit logging failures to avoid blocking page view.
            }
        };

        recordVisit();
    }, [event?._id, user?.role]);

    useEffect(() => {
        const fetchMyFeedback = async () => {
            if (!event?._id || event.eventType !== "Normal Event" || user?.role !== "Participant") {
                setMyFeedback(null);
                setFeedbackMeta({ isRegistered: false, hasAttended: false, canSubmit: false });
                return;
            }

            setIsLoadingFeedback(true);
            setFeedbackError("");
            try {
                const response = await apiCall(`/events/${event._id}/feedback/me`);
                if (!response?.success) {
                    setFeedbackError(response?.message || "Failed to fetch feedback status.");
                    return;
                }

                const meta = response.data || {};
                setFeedbackMeta({
                    isRegistered: Boolean(meta.isRegistered),
                    hasAttended: Boolean(meta.hasAttended),
                    canSubmit: Boolean(meta.canSubmit),
                });

                if (meta.feedback) {
                    setMyFeedback(meta.feedback);
                    setFeedbackRating(String(meta.feedback.rating || 5));
                    setFeedbackComment(meta.feedback.comment || "");
                } else {
                    setMyFeedback(null);
                    setFeedbackRating("5");
                    setFeedbackComment("");
                }
            } catch {
                setFeedbackError("Something went wrong while fetching feedback status.");
            } finally {
                setIsLoadingFeedback(false);
            }
        };

        fetchMyFeedback();
    }, [event?._id, event?.eventType, user?.role]);

    useEffect(() => {
        const fetchItems = async () => {
            if (!event?._id || event.eventType !== "Merchandise Event") {
                setItems([]);
                setPurchaseQuantities({});
                return;
            }
            try {
                const itemIds = Array.isArray(event.itemIds) ? event.itemIds : [];
                let fetchedItems = [];

                const byEventResponse = await apiCall(`/items/event/${event._id}?lite=true`);
                if (byEventResponse?.success) {
                    fetchedItems = Array.isArray(byEventResponse.data) ? byEventResponse.data : [];
                }

                if (fetchedItems.length === 0 && itemIds.length > 0) {
                    const byIdsResponse = await apiCall(`/items/by-ids`, "POST", { itemIds, lite: true });
                    if (byIdsResponse?.success) {
                        fetchedItems = Array.isArray(byIdsResponse.data) ? byIdsResponse.data : [];
                    }
                }

                const safeItems = fetchedItems.filter((item) => item && item._id);
                setItems(safeItems);
                setPurchaseQuantities((prev) => {
                    const next = { ...prev };
                    safeItems.forEach((item) => {
                        if (!next[item._id]) next[item._id] = 1;
                    });
                    return next;
                });
                setItemSelections((prev) => {
                    const next = { ...prev };
                    safeItems.forEach((item) => {
                        if (!next[item._id]) {
                            const colorOptions = Array.isArray(item.colorOptions) ? item.colorOptions : [];
                            const sizeOptions = Array.isArray(item.sizeOptions) ? item.sizeOptions : [];
                            next[item._id] = {
                                selectedColor: colorOptions.length > 0 ? colorOptions[0] : "",
                                selectedSize: sizeOptions.length > 0 ? sizeOptions[0] : "",
                            };
                        }
                    });
                    return next;
                });
            } catch {
                setItems([]);
            }
        };

        fetchItems();
    }, [event?._id, event?.eventType]);

    const alreadyRegistered = useMemo(() => {
        if (!event || !user?._id) return false;
        return Array.isArray(event.registeredFormList)
            ? event.registeredFormList.some((entry) => String(entry.participantId) === String(user._id))
            : false;
    }, [event, user?._id]);

    const isDeadlinePassed = useMemo(() => {
        if (!event?.registrationDeadline) return false;
        const deadline = new Date(event.registrationDeadline);
        if (Number.isNaN(deadline.getTime())) return false;
        return new Date() > deadline;
    }, [event?.registrationDeadline]);

    const isNotEligible = useMemo(() => {
        if (!event || !user) return false;
        return event.eligibility === "Must be a IIIT Student" && user.isIIIT !== true;
    }, [event, user]);

    const isRegistrationLimitReached = useMemo(() => {
        if (!event) return false;
        if (typeof event.registrationLimit !== "number") return false;
        const registeredCount = Array.isArray(event.registeredFormList) ? event.registeredFormList.length : 0;
        return registeredCount >= event.registrationLimit;
    }, [event]);

    const hasPendingRegistrationApproval = useMemo(() => {
        if (!event || !user?._id) return false;
        const requests = Array.isArray(event.pendingRegistrationRequests) ? event.pendingRegistrationRequests : [];
        return requests.some((request) => {
            if (request.status !== "Pending") return false;
            if (String(request.participantId) === String(user._id)) return true;
            if (!Array.isArray(request.teamMembers)) return false;
            return request.teamMembers.some((member) => String(member.participantId) === String(user._id));
        });
    }, [event, user?._id]);

    const isRegistrationClosedByOrganizer = useMemo(() => {
        if (!event) return false;
        return event.registrationOpen === false;
    }, [event]);

    const isRegistrationStatusClosed = useMemo(() => {
        if (!event) return false;
        return event.status !== "Published" && event.status !== "Ongoing";
    }, [event]);

    const registerDisabledReason = useMemo(() => {
        if (alreadyRegistered) return "Already Registered";
        if (isRegistrationStatusClosed) return "Registration Closed";
        if (hasPendingRegistrationApproval) return "Pending Approval";
        if (isRegistrationClosedByOrganizer) return "Registration Closed";
        if (isDeadlinePassed) return "Registration Closed";
        if (isNotEligible) return "Not Eligible";
        if (isRegistrationLimitReached) return "Registration Full";
        return "";
    }, [alreadyRegistered, isRegistrationStatusClosed, hasPendingRegistrationApproval, isRegistrationClosedByOrganizer, isDeadlinePassed, isNotEligible, isRegistrationLimitReached]);

    const countPurchasesByCurrentUser = (item) => {
        if (!item) return 0;
        if (typeof item.myPurchasedQuantity === "number") return item.myPurchasedQuantity;
        if (!user?._id || !Array.isArray(item.purchasedBy)) return 0;
        return item.purchasedBy.filter((buyerId) => String(buyerId) === String(user._id)).length;
    };

    const handleQuantityChange = (itemId, value) => {
        const parsed = Number(value);
        setPurchaseQuantities((prev) => ({
            ...prev,
            [itemId]: Number.isInteger(parsed) && parsed > 0 ? parsed : 1,
        }));
    };

    const handleItemSelectionChange = (itemId, field, value) => {
        setItemSelections((prev) => ({
            ...prev,
            [itemId]: {
                ...(prev[itemId] || {}),
                [field]: value,
            },
        }));
    };

    const handlePurchase = async (item) => {
        if (!item?._id) return;
        setPurchaseError("");
        setPurchaseSuccess("");

        const quantity = Number(purchaseQuantities[item._id] || 1);
        if (!Number.isInteger(quantity) || quantity < 1) {
            setPurchaseError("Quantity must be at least 1.");
            return;
        }

        const alreadyBought = countPurchasesByCurrentUser(item);
        if (typeof item.purchaseLimitPerParticipant === "number" && alreadyBought + quantity > item.purchaseLimitPerParticipant) {
            setPurchaseError("Purchase limit exceeded for this item.");
            return;
        }
        if (item.stockAvailable < quantity) {
            setPurchaseError("Requested quantity exceeds available stock.");
            return;
        }

        const selectedColor = itemSelections[item._id]?.selectedColor || "";
        const selectedSize = itemSelections[item._id]?.selectedSize || "";
        const colorOptions = Array.isArray(item.colorOptions) ? item.colorOptions : [];
        const sizeOptions = Array.isArray(item.sizeOptions) ? item.sizeOptions : [];
        if (colorOptions.length > 0 && !selectedColor) {
            setPurchaseError("Please select a color option.");
            return;
        }
        if (sizeOptions.length > 0 && !selectedSize) {
            setPurchaseError("Please select a size option.");
            return;
        }

        const paymentAmount = (Number(item.cost) || 0) * quantity;
        navigate(`/participant/items/${item._id}/payment`, {
            state: {
                eventId: event?._id,
                eventName: event?.eventName || "Merchandise Event",
                itemName: item.itemName || "Item",
                quantity,
                paymentAmount,
                selectedColor,
                selectedSize,
            },
        });
    };

    const handleSubmitFeedback = async () => {
        if (!event?._id || event.eventType !== "Normal Event") return;
        setFeedbackError("");
        setFeedbackSuccess("");

        const rating = Number(feedbackRating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            setFeedbackError("Rating must be between 1 and 5.");
            return;
        }
        if (!feedbackComment.trim()) {
            setFeedbackError("Comment is required.");
            return;
        }

        setIsSubmittingFeedback(true);
        try {
            const response = await apiCall(`/events/${event._id}/feedback`, "POST", {
                rating,
                comment: feedbackComment.trim(),
            });
            if (!response?.success) {
                setFeedbackError(response?.message || "Failed to submit feedback.");
                return;
            }

            const submittedFeedback = response.data || {
                rating,
                comment: feedbackComment.trim(),
                submittedAt: new Date().toISOString(),
            };
            setMyFeedback(submittedFeedback);
            setFeedbackSuccess(response.message || "Feedback submitted successfully.");
        } catch {
            setFeedbackError("Something went wrong while submitting feedback.");
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    if (isLoading) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="980px">
                    <Text color="gray.600">Loading event details...</Text>
                </Box>
            </Flex>
        );
    }

    if (error) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="980px">
                    <Text color="red.500">{error}</Text>
                </Box>
            </Flex>
        );
    }

    if (!event) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="980px">
                    <Text color="gray.600">Event not available for participants.</Text>
                </Box>
            </Flex>
        );
    }

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="980px">
                <Stack gap={6}>
                    <Box p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" boxShadow="sm">
                        <Stack gap={4}>
                            <Badge
                                alignSelf="start"
                                borderRadius="full"
                                px={3}
                                py={1}
                                textTransform="none"
                                fontWeight="semibold"
                                bg={statusBadgeStyles[event.status]?.bg || "gray.200"}
                                color={statusBadgeStyles[event.status]?.color || "gray.800"}
                            >
                                {event.status}
                            </Badge>
                            <Heading size="lg">{event.eventName}</Heading>
                            <Text color="gray.700">{event.eventDescription}</Text>
                            {event.eventType === "Normal Event" && (
                                <Button
                                    colorPalette="teal"
                                    alignSelf="start"
                                    onClick={() => navigate(`/participant/registerEvent/${event._id}`)}
                                    disabled={Boolean(registerDisabledReason)}
                                >
                                    {registerDisabledReason || "Register"}
                                </Button>
                            )}
                            <Box h="1px" bg="gray.200" />
                            <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                                <InfoRow label="Organizer" value={organizer?.organizerName || "Unknown Organizer"} />
                                <InfoRow label="Type" value={event.eventType || "N/A"} />
                                <InfoRow label="Eligibility" value={event.eligibility || "N/A"} />
                                <InfoRow label="Registration Deadline" value={formatDateTime(event.registrationDeadline)} />
                                <InfoRow label="Event Start" value={formatDateTime(event.eventStartDate)} />
                                <InfoRow label="Event End" value={formatDateTime(event.eventEndDate)} />
                                <InfoRow label="Registration Limit" value={event.registrationLimit ?? "N/A"} />
                                <InfoRow label="Registration Fee" value={event.registrationFee ?? "N/A"} />
                            </SimpleGrid>
                        </Stack>
                    </Box>

                    {event.eventType === "Merchandise Event" && (
                        <Box p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" boxShadow="sm">
                            <Stack gap={4}>
                                <Heading size="md">Item List</Heading>
                                {purchaseError && <Text color="red.500" fontSize="sm">{purchaseError}</Text>}
                                {purchaseSuccess && <Text color="green.600" fontSize="sm">{purchaseSuccess}</Text>}
                                {Array.isArray(items) && items.length > 0 ? (
                                    <Stack gap={3}>
                                        {items.map((item, index) => {
                                            const alreadyBought = countPurchasesByCurrentUser(item);
                                            const requestedQuantity = Number(purchaseQuantities[item._id] || 1);
                                            const exceedsLimit = typeof item.purchaseLimitPerParticipant === "number" &&
                                                alreadyBought + requestedQuantity > item.purchaseLimitPerParticipant;
                                            const exceedsStock = requestedQuantity > item.stockAvailable;
                                            const cannotBuy = item.stockAvailable <= 0 || exceedsLimit || exceedsStock;

                                            return (
                                            <Box key={item._id || `${item.itemName}-${index}`} border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                                                <SimpleGrid columns={{ base: 1, md: 3 }} gap={2}>
                                                    <InfoRow label="Item Name" value={item.itemName || "N/A"} />
                                                    <InfoRow label="Cost" value={item.cost ?? "N/A"} />
                                                    <InfoRow label="Stock Available" value={item.stockAvailable ?? "N/A"} />
                                                    <InfoRow label="Purchase Limit" value={item.purchaseLimitPerParticipant ?? "N/A"} />
                                                    <InfoRow label="Color Options" value={Array.isArray(item.colorOptions) && item.colorOptions.length > 0 ? item.colorOptions.join(", ") : "N/A"} />
                                                    <InfoRow label="Size Options" value={Array.isArray(item.sizeOptions) && item.sizeOptions.length > 0 ? item.sizeOptions.join(", ") : "N/A"} />
                                                    <InfoRow label="Already Purchased By You" value={alreadyBought} />
                                                    <Box>
                                                        <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                            Quantity
                                                        </Text>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            step="1"
                                                            value={purchaseQuantities[item._id] ?? 1}
                                                            onChange={(e) => handleQuantityChange(item._id, e.target.value)}
                                                        />
                                                    </Box>
                                                    {Array.isArray(item.colorOptions) && item.colorOptions.length > 0 && (
                                                        <Box>
                                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                                Select Color
                                                            </Text>
                                                            <select
                                                                value={itemSelections[item._id]?.selectedColor || ""}
                                                                onChange={(e) => handleItemSelectionChange(item._id, "selectedColor", e.target.value)}
                                                                style={{
                                                                    width: "100%",
                                                                    padding: "0.5rem",
                                                                    borderRadius: "0.375rem",
                                                                    border: "1px solid #E2E8F0",
                                                                    backgroundColor: "white",
                                                                }}
                                                            >
                                                                <option value="">Select Color</option>
                                                                {item.colorOptions.map((option) => (
                                                                    <option key={option} value={option}>{option}</option>
                                                                ))}
                                                            </select>
                                                        </Box>
                                                    )}
                                                    {Array.isArray(item.sizeOptions) && item.sizeOptions.length > 0 && (
                                                        <Box>
                                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                                Select Size
                                                            </Text>
                                                            <select
                                                                value={itemSelections[item._id]?.selectedSize || ""}
                                                                onChange={(e) => handleItemSelectionChange(item._id, "selectedSize", e.target.value)}
                                                                style={{
                                                                    width: "100%",
                                                                    padding: "0.5rem",
                                                                    borderRadius: "0.375rem",
                                                                    border: "1px solid #E2E8F0",
                                                                    backgroundColor: "white",
                                                                }}
                                                            >
                                                                <option value="">Select Size</option>
                                                                {item.sizeOptions.map((option) => (
                                                                    <option key={option} value={option}>{option}</option>
                                                                ))}
                                                            </select>
                                                        </Box>
                                                    )}
                                                </SimpleGrid>
                                                <Button
                                                    mt={3}
                                                    colorPalette="teal"
                                                    onClick={() => handlePurchase(item)}
                                                    loading={purchasingItemId === item._id}
                                                    disabled={cannotBuy || purchasingItemId === item._id}
                                                >
                                                    {item.stockAvailable <= 0
                                                        ? "Out of Stock"
                                                        : exceedsLimit
                                                            ? "Limit Exceeded"
                                                            : exceedsStock
                                                                ? "Insufficient Stock"
                                                                : "Purchase"}
                                                </Button>
                                            </Box>
                                        );
                                        })}
                                    </Stack>
                                ) : (
                                    <Text color="gray.600">No items available.</Text>
                                )}
                            </Stack>
                        </Box>
                    )}

                    {event.eventType === "Normal Event" && (
                        <Box p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" boxShadow="sm">
                            <Stack gap={3}>
                                <Heading size="md">Anonymous Feedback</Heading>
                                <Text fontSize="sm" color="gray.600">
                                    Your identity is hidden from organizers. Submit a rating and comment for events you attended.
                                </Text>
                                {isLoadingFeedback ? (
                                    <Text color="gray.600">Checking feedback eligibility...</Text>
                                ) : !feedbackMeta.isRegistered ? (
                                    <Text color="gray.600">Only registered participants can submit feedback for this event.</Text>
                                ) : !feedbackMeta.hasAttended ? (
                                    <Text color="gray.600">Feedback opens after the event is completed.</Text>
                                ) : (
                                    <Stack gap={3}>
                                        {feedbackError && <Text color="red.500" fontSize="sm">{feedbackError}</Text>}
                                        {feedbackSuccess && <Text color="green.600" fontSize="sm">{feedbackSuccess}</Text>}
                                        {myFeedback?.submittedAt && (
                                            <Text fontSize="sm" color="gray.600">
                                                Last submitted at: {formatDateTime(myFeedback.submittedAt)}
                                            </Text>
                                        )}
                                        <Box>
                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                Star Rating
                                            </Text>
                                            <select
                                                value={feedbackRating}
                                                onChange={(e) => setFeedbackRating(e.target.value)}
                                                style={{
                                                    width: "100%",
                                                    maxWidth: "220px",
                                                    padding: "0.5rem",
                                                    borderRadius: "0.375rem",
                                                    border: "1px solid #E2E8F0",
                                                    backgroundColor: "white",
                                                }}
                                            >
                                                <option value="5">5 - Excellent</option>
                                                <option value="4">4 - Good</option>
                                                <option value="3">3 - Average</option>
                                                <option value="2">2 - Poor</option>
                                                <option value="1">1 - Very Poor</option>
                                            </select>
                                        </Box>
                                        <Box>
                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                Comment
                                            </Text>
                                            <Textarea
                                                value={feedbackComment}
                                                onChange={(e) => setFeedbackComment(e.target.value)}
                                                placeholder="Share your feedback"
                                                rows={4}
                                            />
                                        </Box>
                                        <Button
                                            colorPalette="teal"
                                            alignSelf="start"
                                            onClick={handleSubmitFeedback}
                                            loading={isSubmittingFeedback}
                                            disabled={!feedbackMeta.canSubmit || isSubmittingFeedback}
                                        >
                                            {myFeedback ? "Update Feedback" : "Submit Feedback"}
                                        </Button>
                                    </Stack>
                                )}
                            </Stack>
                        </Box>
                    )}
                </Stack>
            </Box>
        </Flex>
    );
};

export default ParticipantEventInfo;
