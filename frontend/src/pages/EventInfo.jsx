import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
    Textarea,
} from "@chakra-ui/react";
import { apiCall } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const statusBadgeStyles = {
    Draft: { bg: "yellow.200", color: "yellow.800" },
    Published: { bg: "green.200", color: "green.800" },
    Ongoing: { bg: "green.600", color: "white" },
    Completed: { bg: "blue.600", color: "white" },
    Cancelled: { bg: "red.600", color: "white" },
    Closed: { bg: "red.500", color: "white" },
};

const selectStyle = {
    width: "100%",
    padding: "0.5rem",
    borderRadius: "0.375rem",
    border: "1px solid #E2E8F0",
    backgroundColor: "white",
};
const DATA_TYPE_OPTIONS = ["Text", "Number", "Boolean", "Date", "Email", "Phone", "Dropdown", "Checkbox", "File"];
const isOptionsType = (dataType) => dataType === "Dropdown" || dataType === "Checkbox";

const formatDate = (value) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleString();
};

const toDateTimeLocal = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    const shifted = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
    return shifted.toISOString().slice(0, 16);
};

const displayValue = (field, value) => {
    if (field === "registrationDeadline" || field === "eventStartDate" || field === "eventEndDate") {
        return formatDate(value);
    }
    if (field === "registrationOpen") {
        return value === false ? "No" : "Yes";
    }
    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }
    if (field === "eventTags") {
        return Array.isArray(value) && value.length > 0 ? value.join(", ") : "N/A";
    }
    return value !== undefined && value !== null && value !== "" ? value : "N/A";
};

const formatSubmittedFieldValue = (field) => {
    const value = field?.value;
    if (value === undefined || value === null || value === "") return "N/A";

    if (field?.dataType === "Boolean") {
        return value ? "Yes" : "No";
    }

    if (field?.dataType === "Date") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toLocaleDateString();
        }
    }

    if (Array.isArray(value)) {
        return value.join(", ");
    }

    if (field?.dataType === "File" && typeof value === "object") {
        return value?.name || "Uploaded file";
    }

    return String(value);
};

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

const csvEscape = (value) => {
    if (value === undefined || value === null) return "";
    const normalized = String(value);
    if (/[",\n]/.test(normalized)) {
        return `"${normalized.replace(/"/g, "\"\"")}"`;
    }
    return normalized;
};

const EventInfo = () => {
    const { eventId } = useParams();
    const { user } = useAuth();

    const [eventData, setEventData] = useState(null);
    const [items, setItems] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const [editingField, setEditingField] = useState("");
    const [editValue, setEditValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [editingItemIndex, setEditingItemIndex] = useState(null);
    const [itemDraft, setItemDraft] = useState({
        itemName: "",
        cost: "",
        stockAvailable: "",
        purchaseLimitPerParticipant: "",
        colorOptionsRaw: "",
        sizeOptionsRaw: "",
    });
    const [itemSaveError, setItemSaveError] = useState("");
    const [isSavingItem, setIsSavingItem] = useState(false);
    const [editingFormTitle, setEditingFormTitle] = useState(false);
    const [formTitleDraft, setFormTitleDraft] = useState("");
    const [isSavingFormTitle, setIsSavingFormTitle] = useState(false);
    const [editingRegFieldIndex, setEditingRegFieldIndex] = useState(null);
    const [editingRegFieldSection, setEditingRegFieldSection] = useState("single");
    const [regFieldDraft, setRegFieldDraft] = useState({
        fieldLabel: "",
        fieldDescription: "",
        dataType: "Text",
        required: false,
        optionsRaw: "",
    });
    const [regFieldSaveError, setRegFieldSaveError] = useState("");
    const [isSavingRegField, setIsSavingRegField] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isTogglingRegistrationOpen, setIsTogglingRegistrationOpen] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [availableTags, setAvailableTags] = useState([]);
    const [editTags, setEditTags] = useState([]);
    const [newTagName, setNewTagName] = useState("");
    const [isCreatingTag, setIsCreatingTag] = useState(false);
    const [tagError, setTagError] = useState("");
    const [selectedRegistrationIndex, setSelectedRegistrationIndex] = useState(null);
    const [selectedMerchPurchaseKey, setSelectedMerchPurchaseKey] = useState("");
    const [participantSearchTerm, setParticipantSearchTerm] = useState("");
    const [processingPendingRequestId, setProcessingPendingRequestId] = useState("");
    const [pendingRequestActionError, setPendingRequestActionError] = useState("");
    const [processingTeamPaymentKey, setProcessingTeamPaymentKey] = useState("");
    const [teamPaymentActionError, setTeamPaymentActionError] = useState("");
    const [processingPendingMerchRequestKey, setProcessingPendingMerchRequestKey] = useState("");
    const [pendingMerchRequestActionError, setPendingMerchRequestActionError] = useState("");
    const [feedbackRatingFilter, setFeedbackRatingFilter] = useState("All");

    useEffect(() => {
        const fetchEvent = async () => {
            setIsLoading(true);
            setError("");
            try {
                const [eventsResponse, usersResponse] = await Promise.all([
                    apiCall("/events"),
                    apiCall("/users?lite=true"),
                ]);

                if (!eventsResponse?.success) {
                    setError(eventsResponse?.message || "Failed to fetch event details");
                    setEventData(null);
                    return;
                }

                if (usersResponse?.success) {
                    setAllUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
                } else {
                    setAllUsers([]);
                }

                const foundEvent = (eventsResponse.data || []).find((item) => item._id === eventId);
                if (!foundEvent) {
                    setError("Event not found.");
                    setEventData(null);
                    return;
                }

                setEventData(foundEvent);
                setSelectedRegistrationIndex(null);
                setSelectedMerchPurchaseKey("");
            } catch (err) {
                setError("Something went wrong while fetching event details");
                setEventData(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEvent();
    }, [eventId]);

    const userById = allUsers.reduce((acc, currentUser) => {
        acc[String(currentUser._id)] = currentUser;
        return acc;
    }, {});

    const isDraftEvent = eventData?.status === "Draft";
    const isPublishedEvent = eventData?.status === "Published";

    const registrations = Array.isArray(eventData?.registeredFormList) ? eventData.registeredFormList : [];
    const isRegistrationFormLocked = registrations.length > 0;
    const canEditRegistrationForm = isDraftEvent && !isRegistrationFormLocked;
    const selectedRegistration =
        selectedRegistrationIndex !== null ? registrations[selectedRegistrationIndex] || null : null;
    const participantSearchQuery = normalizeText(participantSearchTerm);
    const filteredRegistrationRows = registrations
        .map((entry, index) => {
            const participant = userById[String(entry.participantId)];
            const participantName = participant
                ? `${participant.firstName || ""} ${participant.lastName || ""}`.trim() ||
                participant.email ||
                "Unknown Participant"
                : "Unknown Participant";
            const participantEmail = participant?.email || "N/A";

            return {
                entry,
                index,
                participantName,
                participantEmail,
            };
        })
        .filter((row) => fuzzyIncludes(normalizeText(row.participantName), participantSearchQuery));
    const pendingRegistrationRequests = (Array.isArray(eventData?.pendingRegistrationRequests)
        ? eventData.pendingRegistrationRequests
        : [])
        .filter((request) => request?.status === "Pending")
        .map((request) => {
            const participant = userById[String(request.participantId)];
            return {
                ...request,
                participantName: request.participantName || (participant
                    ? `${participant.firstName || ""} ${participant.lastName || ""}`.trim() || participant.email || "Unknown Participant"
                    : "Unknown Participant"),
                participantEmail: request.participantEmail || participant?.email || "N/A",
            };
        })
        .sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
    const merchandisePurchaseRows = (Array.isArray(items) ? items : [])
        .flatMap((item) => {
            const records = Array.isArray(item.purchaseRecords) ? item.purchaseRecords : [];
            return records.map((record, recordIndex) => {
                const participantId = String(record.participantId || "");
                const participant = userById[participantId];
                const participantName = participant
                    ? `${participant.firstName || ""} ${participant.lastName || ""}`.trim() || participant.email || "Unknown Participant"
                    : "Unknown Participant";
                const participantEmail = participant?.email || "N/A";
                return {
                    key: `${String(item._id)}-${recordIndex}-${record?.purchasedAt || ""}`,
                    itemId: String(item._id),
                    itemName: item.itemName || "N/A",
                    participantId,
                    participantName,
                    participantEmail,
                    quantity: record.quantity ?? 0,
                    selectedColor: record.selectedColor || "",
                    selectedSize: record.selectedSize || "",
                    purchasedAt: record.purchasedAt || null,
                    qrPayload: record.qrPayload || null,
                    qrCodeDataUrl: record.qrCodeDataUrl || "",
                };
            });
        })
        .sort((a, b) => {
            const itemCmp = a.itemName.localeCompare(b.itemName);
            if (itemCmp !== 0) return itemCmp;
            return a.participantName.localeCompare(b.participantName);
        });
    const totalMerchPurchases = merchandisePurchaseRows.reduce((sum, row) => sum + row.quantity, 0);
    const selectedMerchPurchase = merchandisePurchaseRows.find((row) => row.key === selectedMerchPurchaseKey) || null;

    // --- Event Analytics ---
    const allRequests = Array.isArray(eventData?.pendingRegistrationRequests) ? eventData.pendingRegistrationRequests : [];
    const analyticsRegistrationCount = registrations.length;
    const analyticsPendingCount = allRequests.filter((r) => r?.status === "Pending").length;
    const analyticsApprovedCount = allRequests.filter((r) => r?.status === "Approved").length;
    const analyticsRejectedCount = allRequests.filter((r) => r?.status === "Rejected").length;

    const analyticsNormalRevenue = (() => {
        const fee = Number(eventData?.registrationFee) || 0;
        return fee * analyticsRegistrationCount;
    })();

    const analyticsMerchRevenue = merchandisePurchaseRows.reduce((sum, row) => {
        const item = (Array.isArray(items) ? items : []).find((i) => String(i._id) === row.itemId);
        return sum + (row.quantity * (item?.cost || 0));
    }, 0);

    const analyticsTotalRevenue = eventData?.eventType === "Merchandise Event" ? analyticsMerchRevenue : analyticsNormalRevenue;

    const analyticsTeamRequests = allRequests.filter((r) => r?.isTeamRegistration);
    const analyticsTeamsComplete = analyticsTeamRequests.filter((r) => {
        const memberCount = 1 + (Array.isArray(r.teamMembers) ? r.teamMembers.length : 0);
        return memberCount >= (r.targetTeamSize || Infinity);
    }).length;
    const analyticsTeamsPending = analyticsTeamRequests.filter((r) => {
        const memberCount = 1 + (Array.isArray(r.teamMembers) ? r.teamMembers.length : 0);
        return memberCount < (r.targetTeamSize || Infinity);
    }).length;
    const pendingMerchPurchaseRequests = (Array.isArray(items) ? items : [])
        .flatMap((item) => {
            const requests = Array.isArray(item.pendingPurchaseRequests) ? item.pendingPurchaseRequests : [];
            return requests
                .filter((request) => request.status === "Pending")
                .map((request) => {
                    const participantId = String(request.participantId || "");
                    const participant = userById[participantId];
                    const participantName = request.participantName || (participant
                        ? `${participant.firstName || ""} ${participant.lastName || ""}`.trim() || participant.email || "Unknown Participant"
                        : "Unknown Participant");
                    const participantEmail = request.participantEmail || participant?.email || "N/A";
                    return {
                        key: `${String(item._id)}-${String(request._id)}`,
                        itemId: String(item._id),
                        requestId: String(request._id),
                        itemName: item.itemName || "N/A",
                        participantName,
                        participantEmail,
                        quantity: request.quantity ?? 0,
                        paymentAmount: request.paymentAmount ?? ((item.cost || 0) * (request.quantity || 0)),
                        selectedColor: request.selectedColor || "",
                        selectedSize: request.selectedSize || "",
                        requestedAt: request.requestedAt || null,
                        paymentProofDataUrl: request.paymentProof?.contentBase64 || "",
                    };
                });
        })
        .sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
    const feedbackRows = (Array.isArray(eventData?.feedbackList) ? eventData.feedbackList : [])
        .map((entry, index) => ({
            key: `${String(entry?._id || index)}-${index}`,
            rating: Number(entry?.rating) || 0,
            comment: entry?.comment || "",
            submittedAt: entry?.submittedAt || null,
        }))
        .filter((entry) => Number.isInteger(entry.rating) && entry.rating >= 1 && entry.rating <= 5)
        .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
    const filteredFeedbackRows = feedbackRows.filter((entry) => (
        feedbackRatingFilter === "All" ? true : String(entry.rating) === String(feedbackRatingFilter)
    ));
    const feedbackStats = feedbackRows.reduce(
        (acc, entry) => {
            acc.total += 1;
            acc.sum += entry.rating;
            acc.counts[entry.rating] = (acc.counts[entry.rating] || 0) + 1;
            return acc;
        },
        {
            total: 0,
            sum: 0,
            counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        }
    );
    const averageFeedbackRating = feedbackStats.total > 0
        ? (feedbackStats.sum / feedbackStats.total).toFixed(2)
        : "N/A";

    const handlePendingRequestReview = async (requestId, action) => {
        if (!eventData?._id || !requestId) return;
        setProcessingPendingRequestId(requestId);
        setPendingRequestActionError("");
        try {
            const response = await apiCall(`/events/${eventData._id}/registration-requests/${requestId}`, "PUT", { action });
            if (!response?.success) {
                setPendingRequestActionError(response?.message || "Failed to review request.");
                return;
            }
            setEventData(response.data || eventData);
        } catch {
            setPendingRequestActionError("Something went wrong while reviewing request.");
        } finally {
            setProcessingPendingRequestId("");
        }
    };

    const handleTeamPaymentReview = async (requestId, participantId, action) => {
        if (!eventData?._id || !requestId || !participantId) return;
        const key = `${requestId}-${participantId}`;
        setProcessingTeamPaymentKey(key);
        setTeamPaymentActionError("");
        try {
            const response = await apiCall(
                `/events/${eventData._id}/team-registration/${requestId}/payments/${participantId}`,
                "PUT",
                { action }
            );
            if (!response?.success) {
                setTeamPaymentActionError(response?.message || "Failed to review team payment proof.");
                return;
            }
            setEventData(response.data || eventData);
        } catch {
            setTeamPaymentActionError("Something went wrong while reviewing team payment proof.");
        } finally {
            setProcessingTeamPaymentKey("");
        }
    };

    const handlePendingMerchRequestReview = async (itemId, requestId, action) => {
        if (!itemId || !requestId) return;
        const key = `${itemId}-${requestId}`;
        setProcessingPendingMerchRequestKey(key);
        setPendingMerchRequestActionError("");
        try {
            const response = await apiCall(`/items/${itemId}/purchase-requests/${requestId}`, "PUT", { action });
            if (!response?.success) {
                setPendingMerchRequestActionError(response?.message || "Failed to review purchase request.");
                return;
            }
            const updatedItem = response?.data?.item;
            if (updatedItem?._id) {
                setItems((prev) => prev.map((current) => (String(current._id) === String(updatedItem._id) ? updatedItem : current)));
            }
        } catch {
            setPendingMerchRequestActionError("Something went wrong while reviewing purchase request.");
        } finally {
            setProcessingPendingMerchRequestKey("");
        }
    };

    const exportRegistrationCsv = () => {
        if (filteredRegistrationRows.length === 0) return;

        const fieldLabels = Array.from(
            new Set(
                filteredRegistrationRows.flatMap((row) =>
                    Array.isArray(row.entry?.formSnapshot)
                        ? row.entry.formSnapshot.map((field) => field.fieldLabel || "")
                        : []
                )
            )
        ).filter(Boolean);

        const headers = ["Participant Name", "Participant Email", "Participant ID", "Registered At", ...fieldLabels];
        const lines = [headers.map(csvEscape).join(",")];

        filteredRegistrationRows.forEach((row) => {
            const snapshot = Array.isArray(row.entry?.formSnapshot) ? row.entry.formSnapshot : [];
            const byLabel = new Map(snapshot.map((field) => [field.fieldLabel || "", formatSubmittedFieldValue(field)]));
            const values = [
                row.participantName,
                row.participantEmail,
                row.entry?.participantId ? String(row.entry.participantId) : "",
                formatDate(row.entry?.registeredAt),
                ...fieldLabels.map((label) => byLabel.get(label) || ""),
            ];
            lines.push(values.map(csvEscape).join(","));
        });

        const csvContent = lines.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${(eventData?.eventName || "event").replace(/[^a-z0-9-_]/gi, "_")}_registrations.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    };

    const exportFeedbackCsv = () => {
        if (filteredFeedbackRows.length === 0) return;

        const headers = ["Submitted At", "Rating", "Comment"];
        const lines = [headers.map(csvEscape).join(",")];

        filteredFeedbackRows.forEach((row) => {
            lines.push([
                formatDate(row.submittedAt),
                row.rating,
                row.comment,
            ].map(csvEscape).join(","));
        });

        const csvContent = lines.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${(eventData?.eventName || "event").replace(/[^a-z0-9-_]/gi, "_")}_feedback.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    };

    useEffect(() => {
        const fetchTags = async () => {
            try {
                const response = await apiCall("/tags");
                if (!response?.success) return;
                setAvailableTags(Array.isArray(response.data) ? response.data : []);
            } catch {
                // Keep page usable even if tag fetch fails.
            }
        };

        fetchTags();
    }, []);

    useEffect(() => {
        const fetchEventItems = async () => {
            if (!eventData?._id || eventData.eventType !== "Merchandise Event") {
                setItems([]);
                return;
            }
            try {
                const itemIds = Array.isArray(eventData.itemIds) ? eventData.itemIds : [];
                let fetchedItems = [];

                const byEventResponse = await apiCall(`/items/event/${eventData._id}`);
                if (byEventResponse?.success) {
                    fetchedItems = Array.isArray(byEventResponse.data) ? byEventResponse.data : [];
                }

                if (fetchedItems.length === 0 && itemIds.length > 0) {
                    const byIdsResponse = await apiCall("/items/by-ids", "POST", { itemIds });
                    if (byIdsResponse?.success) {
                        fetchedItems = Array.isArray(byIdsResponse.data) ? byIdsResponse.data : [];
                    }
                }

                setItems(fetchedItems.filter((item) => item && item._id));
            } catch {
                setItems([]);
            }
        };

        fetchEventItems();
    }, [eventData?._id, eventData?.eventType, eventData?.itemIds]);

    const canEditFieldByStatus = (field) => {
        if (isDraftEvent) return true;
        if (isPublishedEvent) {
            return field === "eventDescription" || field === "registrationDeadline" || field === "registrationLimit";
        }
        return false;
    };

    const beginEdit = (field) => {
        if (!eventData || !canEditFieldByStatus(field)) return;

        const value = eventData[field];
        if (field === "eventTags") {
            setEditTags(Array.isArray(value) ? value : []);
            setNewTagName("");
            setTagError("");
        } else if (field === "registrationDeadline" || field === "eventStartDate" || field === "eventEndDate") {
            setEditValue(toDateTimeLocal(value));
        } else if (value === null || value === undefined) {
            setEditValue("");
        } else {
            setEditValue(String(value));
        }

        setSaveError("");
        setEditingField(field);
    };

    const cancelEdit = () => {
        setEditingField("");
        setEditValue("");
        setSaveError("");
        setTagError("");
        setNewTagName("");
        setEditTags([]);
    };

    const buildPayload = (field, value) => {
        if (field === "registrationLimit" || field === "registrationFee") {
            return { [field]: value === "" ? null : Number(value) };
        }

        if (field === "organizerId") {
            return { [field]: Number(value) };
        }

        if (field === "registrationDeadline" || field === "eventStartDate" || field === "eventEndDate") {
            return { [field]: value === "" ? null : value };
        }

        return { [field]: value };
    };

    const saveField = async (field) => {
        if (!eventData?._id) return;

        const payload = field === "eventTags"
            ? { eventTags: editTags }
            : buildPayload(field, editValue);

        setIsSaving(true);
        setSaveError("");
        try {
            const response = await apiCall(`/events/${eventData._id}`, "PUT", payload);
            if (!response?.success) {
                setSaveError(response?.message || "Failed to update field");
                return;
            }

            setEventData(response.data || eventData);
            setEditingField("");
            setEditValue("");
            setTagError("");
            setNewTagName("");
            setEditTags([]);
        } catch (err) {
            setSaveError("Something went wrong while updating field");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleEditTag = (tagName) => {
        setEditTags((prev) =>
            prev.includes(tagName)
                ? prev.filter((tag) => tag !== tagName)
                : [...prev, tagName]
        );
    };

    const handleCreateTagForEvent = async () => {
        setTagError("");
        const normalizedName = newTagName.trim();

        if (!normalizedName) {
            setTagError("Tag name is required.");
            return;
        }

        const organizerId = user?.organizerId ?? eventData?.organizerId;
        if (!organizerId) {
            setTagError("Organizer is not available.");
            return;
        }

        if (
            availableTags.some(
                (tag) => (tag.name || "").toLowerCase() === normalizedName.toLowerCase()
            )
        ) {
            setTagError("Tag already exists.");
            return;
        }

        setIsCreatingTag(true);
        try {
            const response = await apiCall("/tags", "POST", {
                name: normalizedName,
                createdBy: organizerId,
            });
            if (!response?.success) {
                setTagError(response?.message || "Failed to create tag.");
                return;
            }

            setAvailableTags((prev) => [...prev, response.data]);
            setEditTags((prev) => [...prev, normalizedName]);
            setNewTagName("");
        } catch {
            setTagError("Something went wrong while creating tag.");
        } finally {
            setIsCreatingTag(false);
        }
    };

    const renderInput = (field) => {
        if (field === "eventDescription") {
            return (
                <Textarea
                    rows={3}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                />
            );
        }

        if (field === "eventType") {
            return (
                <select value={editValue} onChange={(e) => setEditValue(e.target.value)} style={selectStyle}>
                    <option value="Normal Event">Normal Event</option>
                    <option value="Merchandise Event">Merchandise Event</option>
                </select>
            );
        }

        if (field === "eligibility") {
            return (
                <select value={editValue} onChange={(e) => setEditValue(e.target.value)} style={selectStyle}>
                    <option value="Must be a IIIT Student">Must be a IIIT Student</option>
                    <option value="Open to all">Open to all</option>
                </select>
            );
        }

        if (field === "status") {
            return (
                <select value={editValue} onChange={(e) => setEditValue(e.target.value)} style={selectStyle}>
                    <option value="Draft">Draft</option>
                    <option value="Published">Published</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Closed">Closed</option>
                </select>
            );
        }

        if (field === "registrationDeadline" || field === "eventStartDate" || field === "eventEndDate") {
            return (
                <Input
                    type="datetime-local"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                />
            );
        }

        if (field === "registrationLimit") {
            return (
                <Input
                    type="number"
                    min="1"
                    step="1"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                />
            );
        }

        if (field === "registrationFee") {
            return (
                <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                />
            );
        }

        if (field === "eventTags") {
            return (
                <Stack gap={2}>
                    {availableTags.length === 0 && (
                        <Text fontSize="xs" color="gray.500">No tags available yet.</Text>
                    )}
                    {availableTags.map((tag) => (
                        <Text
                            as="label"
                            key={tag._id || tag.name}
                            display="flex"
                            alignItems="center"
                            gap={2}
                            fontSize="sm"
                        >
                            <input
                                type="checkbox"
                                checked={editTags.includes(tag.name)}
                                onChange={() => toggleEditTag(tag.name)}
                            />
                            {tag.name}
                        </Text>
                    ))}
                    <Text fontSize="sm" mt={1}>Create New Tag</Text>
                    <HStack gap={2} align="start">
                        <Input
                            placeholder="Enter new tag name"
                            value={newTagName}
                            onChange={(e) => {
                                setNewTagName(e.target.value);
                                setTagError("");
                            }}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            colorPalette="teal"
                            onClick={handleCreateTagForEvent}
                            loading={isCreatingTag}
                        >
                            Add Tag
                        </Button>
                    </HStack>
                    {tagError && <Text color="red.500" fontSize="xs">{tagError}</Text>}
                </Stack>
            );
        }

        return <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} />;
    };

    const renderField = (label, field) => (
        <Box>
            <HStack justify="space-between" align="start" mb={1}>
                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                    {label}
                </Text>
                {editingField === field ? (
                    <HStack gap={1}>
                        <Button
                            size="xs"
                            colorPalette="green"
                            onClick={() => saveField(field)}
                            loading={isSaving}
                        >
                            ✓
                        </Button>
                        <Button size="xs" colorPalette="red" variant="outline" onClick={cancelEdit} disabled={isSaving}>
                            ✕
                        </Button>
                    </HStack>
                ) : canEditFieldByStatus(field) ? (
                    <Button size="xs" variant="outline" onClick={() => beginEdit(field)}>
                        Edit
                    </Button>
                ) : null}
            </HStack>

            {editingField === field && canEditFieldByStatus(field) ? (
                renderInput(field)
            ) : (
                <Text fontSize="sm" color="gray.800" fontWeight="medium">
                    {displayValue(field, eventData?.[field])}
                </Text>
            )}
        </Box>
    );

    const toggleRegistrationOpen = async () => {
        if (!eventData?._id || !isPublishedEvent) return;

        setIsTogglingRegistrationOpen(true);
        setSaveError("");
        try {
            const currentlyOpen = eventData.registrationOpen !== false;
            const response = await apiCall(`/events/${eventData._id}`, "PUT", { registrationOpen: !currentlyOpen });
            if (!response?.success) {
                setSaveError(response?.message || "Failed to update registration state.");
                return;
            }
            setEventData(response.data || eventData);
        } catch (err) {
            setSaveError("Something went wrong while updating registration state.");
        } finally {
            setIsTogglingRegistrationOpen(false);
        }
    };

    const renderReadOnlyField = (label, field) => (
        <Box>
            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                {label}
            </Text>
            <Text fontSize="sm" color="gray.800" fontWeight="medium">
                {displayValue(field, eventData?.[field])}
            </Text>
        </Box>
    );

    const beginEditItem = (index) => {
        if (!isDraftEvent) return;
        const item = items?.[index];
        if (!item) return;

        setEditingItemIndex(index);
        setItemSaveError("");
        setItemDraft({
            itemName: item.itemName || "",
            cost: item.cost !== undefined && item.cost !== null ? String(item.cost) : "",
            stockAvailable: item.stockAvailable !== undefined && item.stockAvailable !== null ? String(item.stockAvailable) : "",
            purchaseLimitPerParticipant:
                item.purchaseLimitPerParticipant !== undefined && item.purchaseLimitPerParticipant !== null
                    ? String(item.purchaseLimitPerParticipant)
                    : "",
            colorOptionsRaw: Array.isArray(item.colorOptions) ? item.colorOptions.join(", ") : "",
            sizeOptionsRaw: Array.isArray(item.sizeOptions) ? item.sizeOptions.join(", ") : "",
        });
    };

    const beginAddItem = () => {
        if (!isDraftEvent) return;
        setEditingItemIndex(-1);
        setItemSaveError("");
        setItemDraft({
            itemName: "",
            cost: "",
            stockAvailable: "",
            purchaseLimitPerParticipant: "",
            colorOptionsRaw: "",
            sizeOptionsRaw: "",
        });
    };

    const cancelItemEdit = () => {
        setEditingItemIndex(null);
        setItemSaveError("");
        setItemDraft({
            itemName: "",
            cost: "",
            stockAvailable: "",
            purchaseLimitPerParticipant: "",
            colorOptionsRaw: "",
            sizeOptionsRaw: "",
        });
    };

    const handleItemDraftChange = (field, value) => {
        setItemDraft((prev) => ({ ...prev, [field]: value }));
    };

    const normalizeItemFromDraft = () => {
        if (!itemDraft.itemName.trim()) {
            return { error: "Item name is required." };
        }

        if (itemDraft.cost === "" || !Number.isInteger(Number(itemDraft.cost)) || Number(itemDraft.cost) < 1) {
            return { error: "Cost must be an integer >= 1." };
        }

        if (
            itemDraft.stockAvailable === "" ||
            !Number.isInteger(Number(itemDraft.stockAvailable)) ||
            Number(itemDraft.stockAvailable) < 0
        ) {
            return { error: "Stock Available must be an integer >= 0." };
        }

        if (
            itemDraft.purchaseLimitPerParticipant !== "" &&
            (!Number.isInteger(Number(itemDraft.purchaseLimitPerParticipant)) ||
                Number(itemDraft.purchaseLimitPerParticipant) < 1)
        ) {
            return { error: "Purchase Limit must be an integer >= 1." };
        }

        const normalizedItem = {
            itemName: itemDraft.itemName.trim(),
            cost: Number(itemDraft.cost),
            stockAvailable: Number(itemDraft.stockAvailable),
            colorOptions: itemDraft.colorOptionsRaw
                .split(",")
                .map((option) => option.trim())
                .filter(Boolean),
            sizeOptions: itemDraft.sizeOptionsRaw
                .split(",")
                .map((option) => option.trim())
                .filter(Boolean),
            ...(itemDraft.purchaseLimitPerParticipant !== ""
                ? { purchaseLimitPerParticipant: Number(itemDraft.purchaseLimitPerParticipant) }
                : {}),
        };

        return { item: normalizedItem };
    };

    const saveItemListChange = async () => {
        if (!eventData?._id || editingItemIndex === null || !isDraftEvent) return;

        const result = normalizeItemFromDraft();
        if (result.error) {
            setItemSaveError(result.error);
            return;
        }

        const existingItems = Array.isArray(items) ? items : [];
        const updatedItemList =
            editingItemIndex === -1
                ? [...existingItems, result.item]
                : existingItems.map((item, index) => (index === editingItemIndex ? result.item : item));

        setIsSavingItem(true);
        setItemSaveError("");
        try {
            const response = await apiCall(`/items/bulk`, "POST", {
                eventId: eventData._id,
                items: updatedItemList,
            });
            if (!response?.success) {
                setItemSaveError(response?.message || "Failed to update item list.");
                return;
            }

            setItems(Array.isArray(response.data) ? response.data : []);
            cancelItemEdit();
        } catch (err) {
            setItemSaveError("Something went wrong while updating item list.");
        } finally {
            setIsSavingItem(false);
        }
    };

    const beginEditFormTitle = () => {
        if (!canEditRegistrationForm) return;
        setEditingFormTitle(true);
        setRegFieldSaveError("");
        setFormTitleDraft(eventData?.customForm?.formTitle || "Registration Form");
    };

    const cancelFormTitleEdit = () => {
        setEditingFormTitle(false);
        setFormTitleDraft("");
    };

    const saveFormTitleChange = async () => {
        if (!eventData?._id || !canEditRegistrationForm) return;
        const fields = Array.isArray(eventData.customForm?.fields) ? eventData.customForm.fields : [];
        const leaderFields = Array.isArray(eventData.customForm?.leaderFields) ? eventData.customForm.leaderFields : [];
        const memberFields = Array.isArray(eventData.customForm?.memberFields) ? eventData.customForm.memberFields : [];
        const payload = {
            customForm: {
                formTitle: formTitleDraft.trim() || "Registration Form",
                fields,
                leaderFields,
                memberFields,
                leaderFormTitle: eventData.customForm?.leaderFormTitle || "Team Leader Form",
                memberFormTitle: eventData.customForm?.memberFormTitle || "Team Member Form",
            },
        };

        setIsSavingFormTitle(true);
        setRegFieldSaveError("");
        try {
            const response = await apiCall(`/events/${eventData._id}`, "PUT", payload);
            if (!response?.success) {
                setRegFieldSaveError(response?.message || "Failed to update form title.");
                return;
            }
            setEventData(response.data || eventData);
            setEditingFormTitle(false);
        } catch (err) {
            setRegFieldSaveError("Something went wrong while updating form title.");
        } finally {
            setIsSavingFormTitle(false);
        }
    };

    const getRegFieldsForSection = (section) => {
        if (section === "leader") {
            return Array.isArray(eventData?.customForm?.leaderFields) ? eventData.customForm.leaderFields : [];
        }
        if (section === "member") {
            return Array.isArray(eventData?.customForm?.memberFields) ? eventData.customForm.memberFields : [];
        }
        return Array.isArray(eventData?.customForm?.fields) ? eventData.customForm.fields : [];
    };

    const buildCustomFormPayloadWithSection = (section, updatedFields) => ({
        formTitle: eventData?.customForm?.formTitle || "Registration Form",
        fields: section === "single"
            ? updatedFields
            : (Array.isArray(eventData?.customForm?.fields) ? eventData.customForm.fields : []),
        leaderFields: section === "leader"
            ? updatedFields
            : (Array.isArray(eventData?.customForm?.leaderFields) ? eventData.customForm.leaderFields : []),
        memberFields: section === "member"
            ? updatedFields
            : (Array.isArray(eventData?.customForm?.memberFields) ? eventData.customForm.memberFields : []),
        leaderFormTitle: eventData?.customForm?.leaderFormTitle || "Team Leader Form",
        memberFormTitle: eventData?.customForm?.memberFormTitle || "Team Member Form",
    });

    const beginEditRegField = (index, section = "single") => {
        if (!canEditRegistrationForm) return;
        const sectionFields = getRegFieldsForSection(section);
        const field = sectionFields[index];
        if (!field) return;

        setEditingRegFieldSection(section);
        setEditingRegFieldIndex(index);
        setRegFieldSaveError("");
        setRegFieldDraft({
            fieldLabel: field.fieldLabel || "",
            fieldDescription: field.fieldDescription || "",
            dataType: field.dataType || "Text",
            required: !!field.required,
            optionsRaw: Array.isArray(field.options) ? field.options.join(", ") : "",
        });
    };

    const beginAddRegField = (section = "single") => {
        if (!canEditRegistrationForm) return;
        setEditingRegFieldSection(section);
        setEditingRegFieldIndex(-1);
        setRegFieldSaveError("");
        setRegFieldDraft({
            fieldLabel: "",
            fieldDescription: "",
            dataType: "Text",
            required: false,
            optionsRaw: "",
        });
    };

    const cancelRegFieldEdit = () => {
        setEditingRegFieldIndex(null);
        setEditingRegFieldSection("single");
        setRegFieldSaveError("");
        setRegFieldDraft({
            fieldLabel: "",
            fieldDescription: "",
            dataType: "Text",
            required: false,
            optionsRaw: "",
        });
    };

    const handleRegFieldDraftChange = (field, value) => {
        setRegFieldDraft((prev) => ({ ...prev, [field]: value }));
    };

    const normalizeRegFieldFromDraft = () => {
        if (!regFieldDraft.fieldLabel.trim()) {
            return { error: "Field label is required." };
        }
        if (!regFieldDraft.dataType) {
            return { error: "Datatype is required." };
        }
        if (isOptionsType(regFieldDraft.dataType)) {
            const optionCount = regFieldDraft.optionsRaw
                .split(",")
                .map((option) => option.trim())
                .filter(Boolean).length;
            if (optionCount < 2) {
                return { error: "At least two options are required for dropdown/checkbox fields." };
            }
        }

        return {
            field: {
                fieldLabel: regFieldDraft.fieldLabel.trim(),
                fieldDescription: regFieldDraft.fieldDescription.trim(),
                dataType: regFieldDraft.dataType,
                required: !!regFieldDraft.required,
                options: isOptionsType(regFieldDraft.dataType)
                    ? regFieldDraft.optionsRaw
                        .split(",")
                        .map((option) => option.trim())
                        .filter(Boolean)
                    : [],
            },
        };
    };

    const saveRegFieldChange = async () => {
        if (!eventData?._id || editingRegFieldIndex === null || !canEditRegistrationForm) return;

        const result = normalizeRegFieldFromDraft();
        if (result.error) {
            setRegFieldSaveError(result.error);
            return;
        }

        const existingFields = getRegFieldsForSection(editingRegFieldSection);
        const updatedFields =
            editingRegFieldIndex === -1
                ? [...existingFields, result.field]
                : existingFields.map((field, index) => (index === editingRegFieldIndex ? result.field : field));

        const payload = {
            customForm: buildCustomFormPayloadWithSection(editingRegFieldSection, updatedFields),
        };

        setIsSavingRegField(true);
        setRegFieldSaveError("");
        try {
            const response = await apiCall(`/events/${eventData._id}`, "PUT", payload);
            if (!response?.success) {
                setRegFieldSaveError(response?.message || "Failed to update registration form.");
                return;
            }
            setEventData(response.data || eventData);
            cancelRegFieldEdit();
        } catch (err) {
            setRegFieldSaveError("Something went wrong while updating registration form.");
        } finally {
            setIsSavingRegField(false);
        }
    };

    const moveRegField = async (index, direction, section = "single") => {
        if (!eventData?._id || !canEditRegistrationForm) return;
        const existingFields = getRegFieldsForSection(section);
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= existingFields.length) return;

        const updatedFields = [...existingFields];
        [updatedFields[index], updatedFields[targetIndex]] = [updatedFields[targetIndex], updatedFields[index]];

        const payload = {
            customForm: buildCustomFormPayloadWithSection(section, updatedFields),
        };

        setIsSavingRegField(true);
        setRegFieldSaveError("");
        try {
            const response = await apiCall(`/events/${eventData._id}`, "PUT", payload);
            if (!response?.success) {
                setRegFieldSaveError(response?.message || "Failed to reorder registration form.");
                return;
            }
            setEventData(response.data || eventData);
        } catch {
            setRegFieldSaveError("Something went wrong while reordering registration form.");
        } finally {
            setIsSavingRegField(false);
        }
    };

    const publishEvent = async () => {
        if (!eventData?._id || eventData.status !== "Draft") return;

        setIsPublishing(true);
        setSaveError("");
        try {
            const response = await apiCall(`/events/${eventData._id}`, "PUT", { status: "Published" });
            if (!response?.success) {
                setSaveError(response?.message || "Failed to publish event.");
                return;
            }
            setEventData(response.data || eventData);
        } catch (err) {
            setSaveError("Something went wrong while publishing event.");
        } finally {
            setIsPublishing(false);
        }
    };

    const updateEventStatus = async (nextStatus) => {
        if (!eventData?._id) return;
        setIsUpdatingStatus(true);
        setSaveError("");
        try {
            const response = await apiCall(`/events/${eventData._id}`, "PUT", { status: nextStatus });
            if (!response?.success) {
                setSaveError(response?.message || "Failed to update event status.");
                return;
            }
            setEventData(response.data || eventData);
        } catch {
            setSaveError("Something went wrong while updating event status.");
        } finally {
            setIsUpdatingStatus(false);
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

    if (error || !eventData) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="980px">
                    <Text color="red.500">{error || "Event not found."}</Text>
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
                                bg={statusBadgeStyles[eventData.status]?.bg || "gray.200"}
                                color={statusBadgeStyles[eventData.status]?.color || "gray.800"}
                            >
                                {eventData.status || "Draft"}
                            </Badge>

                            {saveError && (
                                <Text color="red.500" fontSize="sm">
                                    {saveError}
                                </Text>
                            )}

                            <HStack justify="space-between" align="center" wrap="wrap">
                                <Heading size="lg">Event Details</Heading>
                                <HStack gap={2}>
                                    {isPublishedEvent && (
                                        <Button
                                            size="sm"
                                            colorPalette={eventData.registrationOpen === false ? "green" : "red"}
                                            variant={eventData.registrationOpen === false ? "solid" : "outline"}
                                            onClick={toggleRegistrationOpen}
                                            loading={isTogglingRegistrationOpen}
                                        >
                                            {eventData.registrationOpen === false ? "Open Registration" : "Close Registration"}
                                        </Button>
                                    )}
                                    {(eventData.status === "Draft" || eventData.status === "Published" || eventData.status === "Ongoing") && (
                                        <Button
                                            size="sm"
                                            colorPalette="red"
                                            variant="outline"
                                            onClick={() => updateEventStatus("Cancelled")}
                                            loading={isUpdatingStatus}
                                        >
                                            Cancel Event
                                        </Button>
                                    )}
                                    {eventData.status === "Ongoing" && (
                                        <Button
                                            size="sm"
                                            colorPalette="blue"
                                            onClick={() => updateEventStatus("Completed")}
                                            loading={isUpdatingStatus}
                                        >
                                            Mark Completed
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        colorPalette="teal"
                                        onClick={publishEvent}
                                        disabled={!isDraftEvent || isUpdatingStatus}
                                        loading={isPublishing}
                                    >
                                        Publish Event
                                    </Button>
                                </HStack>
                            </HStack>
                            <Box h="1px" bg="gray.200" />
                            <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                                {renderField("Event Name", "eventName")}
                                {renderField("Event Description", "eventDescription")}
                                {renderField("Type", "eventType")}
                                {renderReadOnlyField("Status", "status")}
                                {renderField("Eligibility", "eligibility")}
                                {renderField("Registration Deadline", "registrationDeadline")}
                                {renderField("Event Start", "eventStartDate")}
                                {renderField("Event End", "eventEndDate")}
                                {renderField("Registration Limit", "registrationLimit")}
                                {renderReadOnlyField("Registration Open", "registrationOpen")}
                                {renderField("Registration Fee", "registrationFee")}
                                {renderField("Event Tags", "eventTags")}
                                {renderReadOnlyField("Organizer ID", "organizerId")}
                                <Box>
                                    <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                                        {eventData.eventType === "Merchandise Event" ? "Total Purchases" : "Registered Participants"}
                                    </Text>
                                    <Text fontSize="sm" color="gray.800" fontWeight="medium">
                                        {eventData.eventType === "Merchandise Event"
                                            ? totalMerchPurchases
                                            : (Array.isArray(eventData.registeredFormList) ? eventData.registeredFormList.length : 0)}
                                    </Text>
                                </Box>
                            </SimpleGrid>
                        </Stack>
                    </Box>

                    {/* Event Analytics Section */}
                    {eventData.status !== "Draft" && (
                        <Box p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" boxShadow="sm">
                            <Stack gap={4}>
                                <Heading size="md">Event Analytics</Heading>
                                <Box h="1px" bg="gray.200" />
                                <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                                    <Box p={4} bg="teal.50" borderRadius="md" textAlign="center">
                                        <Text fontSize="2xl" fontWeight="bold" color="teal.700">
                                            {eventData.eventType === "Merchandise Event" ? totalMerchPurchases : analyticsRegistrationCount}
                                        </Text>
                                        <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="wider">
                                            {eventData.eventType === "Merchandise Event" ? "Total Sales" : "Registrations"}
                                        </Text>
                                    </Box>
                                    <Box p={4} bg="yellow.50" borderRadius="md" textAlign="center">
                                        <Text fontSize="2xl" fontWeight="bold" color="yellow.700">
                                            {analyticsPendingCount}
                                        </Text>
                                        <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="wider">
                                            Pending Approval
                                        </Text>
                                    </Box>
                                    <Box p={4} bg="green.50" borderRadius="md" textAlign="center">
                                        <Text fontSize="2xl" fontWeight="bold" color="green.700">
                                            ₹{analyticsTotalRevenue.toLocaleString()}
                                        </Text>
                                        <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="wider">
                                            Revenue
                                        </Text>
                                    </Box>
                                    {eventData.registrationLimit > 0 && (
                                        <Box p={4} bg="blue.50" borderRadius="md" textAlign="center">
                                            <Text fontSize="2xl" fontWeight="bold" color="blue.700">
                                                {eventData.eventType === "Merchandise Event"
                                                    ? totalMerchPurchases
                                                    : analyticsRegistrationCount}
                                                {" / "}
                                                {eventData.registrationLimit}
                                            </Text>
                                            <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="wider">
                                                Capacity Filled
                                            </Text>
                                        </Box>
                                    )}
                                </SimpleGrid>
                                {eventData.isTeamEvent && analyticsTeamRequests.length > 0 && (
                                    <>
                                        <Box h="1px" bg="gray.200" />
                                        <Heading size="sm">Team Completion</Heading>
                                        <SimpleGrid columns={{ base: 2, md: 3 }} gap={4}>
                                            <Box p={4} bg="green.50" borderRadius="md" textAlign="center">
                                                <Text fontSize="2xl" fontWeight="bold" color="green.700">
                                                    {analyticsTeamsComplete}
                                                </Text>
                                                <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="wider">
                                                    Teams Complete
                                                </Text>
                                            </Box>
                                            <Box p={4} bg="orange.50" borderRadius="md" textAlign="center">
                                                <Text fontSize="2xl" fontWeight="bold" color="orange.700">
                                                    {analyticsTeamsPending}
                                                </Text>
                                                <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="wider">
                                                    Teams Incomplete
                                                </Text>
                                            </Box>
                                            <Box p={4} bg="teal.50" borderRadius="md" textAlign="center">
                                                <Text fontSize="2xl" fontWeight="bold" color="teal.700">
                                                    {analyticsTeamRequests.length}
                                                </Text>
                                                <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="wider">
                                                    Total Teams
                                                </Text>
                                            </Box>
                                        </SimpleGrid>
                                    </>
                                )}
                                {eventData.eventType === "Merchandise Event" && items.length > 0 && (
                                    <>
                                        <Box h="1px" bg="gray.200" />
                                        <Heading size="sm">Sales by Item</Heading>
                                        <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                                            {items.map((item) => {
                                                const sold = Array.isArray(item.purchaseRecords)
                                                    ? item.purchaseRecords.reduce((s, r) => s + (r.quantity || 0), 0)
                                                    : 0;
                                                const itemRevenue = sold * (item.cost || 0);
                                                return (
                                                    <Box key={String(item._id)} p={3} bg="gray.50" borderRadius="md">
                                                        <Text fontSize="sm" fontWeight="semibold" color="gray.800">{item.itemName}</Text>
                                                        <HStack gap={4} mt={1}>
                                                            <Text fontSize="xs" color="gray.600">Sold: {sold} / {item.stockAvailable + sold}</Text>
                                                            <Text fontSize="xs" color="gray.600">Revenue: ₹{itemRevenue.toLocaleString()}</Text>
                                                            <Text fontSize="xs" color="gray.600">Stock Left: {item.stockAvailable}</Text>
                                                        </HStack>
                                                    </Box>
                                                );
                                            })}
                                        </SimpleGrid>
                                    </>
                                )}
                            </Stack>
                        </Box>
                    )}

                    {eventData.eventType === "Normal Event" ? (
                        <Box p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" boxShadow="sm">
                            <Stack gap={4}>
                                <HStack justify="space-between" align="center" wrap="wrap">
                                    <Heading size="md">Registered Participants</Heading>
                                    <HStack w={{ base: "full", md: "auto" }} gap={2}>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={exportRegistrationCsv}
                                            disabled={filteredRegistrationRows.length === 0}
                                        >
                                            Export CSV
                                        </Button>
                                        <Box w={{ base: "full", md: "340px" }}>
                                            <Input
                                                placeholder="Search by participant name"
                                                value={participantSearchTerm}
                                                onChange={(e) => setParticipantSearchTerm(e.target.value)}
                                            />
                                        </Box>
                                    </HStack>
                                </HStack>
                                <Box border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                                    <Stack gap={3}>
                                        <Heading size="sm">Pending Registration Requests</Heading>
                                        {pendingRequestActionError && (
                                            <Text color="red.500" fontSize="sm">{pendingRequestActionError}</Text>
                                        )}
                                        {teamPaymentActionError && (
                                            <Text color="red.500" fontSize="sm">{teamPaymentActionError}</Text>
                                        )}
                                        {pendingRegistrationRequests.length === 0 ? (
                                            <Text color="gray.600">No pending requests for this event.</Text>
                                        ) : (
                                            <Stack gap={2}>
                                                {pendingRegistrationRequests.map((request) => (
                                                    request.isTeamRegistration && typeof eventData.registrationFee === "number" && eventData.registrationFee > 0 ? (
                                                        <Box
                                                            key={String(request._id)}
                                                            border="1px solid"
                                                            borderColor="gray.100"
                                                            borderRadius="md"
                                                            p={3}
                                                        >
                                                            <Stack gap={2}>
                                                                <Text fontSize="sm" fontWeight="semibold" color="gray.800">
                                                                    Team Registration Request
                                                                </Text>
                                                                <Text fontSize="sm" color="gray.700">
                                                                    Team Size: {1 + (Array.isArray(request.teamMembers) ? request.teamMembers.length : 0)} / {request.targetTeamSize || "N/A"}
                                                                </Text>
                                                                <Text fontSize="sm" color="gray.700">
                                                                    Join Link: {request.teamJoinLink || "N/A"}
                                                                </Text>
                                                                <Box border="1px solid" borderColor="gray.100" borderRadius="md" p={2}>
                                                                    <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                                                                        Leader Payment
                                                                    </Text>
                                                                    <Text fontSize="sm" color="gray.700">Name: {request.participantName}</Text>
                                                                    <Text fontSize="sm" color="gray.700">Email: {request.participantEmail}</Text>
                                                                    <Text fontSize="sm" color="gray.700">Status: {request.leaderPaymentStatus || "PendingSubmission"}</Text>
                                                                    <Text fontSize="sm" color="gray.700">Payment: Rs. {request.leaderPaymentAmount ?? eventData.registrationFee ?? 0}</Text>
                                                                    {request.leaderPaymentProof?.contentBase64 ? (
                                                                        <Button
                                                                            as="a"
                                                                            href={request.leaderPaymentProof.contentBase64}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            size="xs"
                                                                            alignSelf="start"
                                                                            variant="outline"
                                                                            mt={2}
                                                                        >
                                                                            View Payment Proof
                                                                        </Button>
                                                                    ) : (
                                                                        <Text fontSize="sm" color="gray.600" mt={1}>Payment proof not uploaded yet.</Text>
                                                                    )}
                                                                    <HStack mt={2}>
                                                                        <Button
                                                                            size="xs"
                                                                            colorPalette="green"
                                                                            onClick={() => handleTeamPaymentReview(String(request._id), String(request.participantId), "approve")}
                                                                            loading={processingTeamPaymentKey === `${String(request._id)}-${String(request.participantId)}`}
                                                                            disabled={!request.leaderPaymentProof?.contentBase64}
                                                                        >
                                                                            Approve
                                                                        </Button>
                                                                        <Button
                                                                            size="xs"
                                                                            colorPalette="red"
                                                                            variant="outline"
                                                                            onClick={() => handleTeamPaymentReview(String(request._id), String(request.participantId), "reject")}
                                                                            loading={processingTeamPaymentKey === `${String(request._id)}-${String(request.participantId)}`}
                                                                            disabled={!request.leaderPaymentProof?.contentBase64}
                                                                        >
                                                                            Reject
                                                                        </Button>
                                                                    </HStack>
                                                                </Box>
                                                                {(Array.isArray(request.teamMembers) ? request.teamMembers : []).map((member, memberIndex) => (
                                                                    <Box key={`${String(request._id)}-member-${memberIndex}`} border="1px solid" borderColor="gray.100" borderRadius="md" p={2}>
                                                                        <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                                                                            Member Payment
                                                                        </Text>
                                                                        <Text fontSize="sm" color="gray.700">Name: {member.participantName}</Text>
                                                                        <Text fontSize="sm" color="gray.700">Email: {member.participantEmail}</Text>
                                                                        <Text fontSize="sm" color="gray.700">Status: {member.paymentStatus || "PendingSubmission"}</Text>
                                                                        <Text fontSize="sm" color="gray.700">Payment: Rs. {member.paymentAmount ?? eventData.registrationFee ?? 0}</Text>
                                                                        {member.paymentProof?.contentBase64 ? (
                                                                            <Button
                                                                                as="a"
                                                                                href={member.paymentProof.contentBase64}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                size="xs"
                                                                                alignSelf="start"
                                                                                variant="outline"
                                                                                mt={2}
                                                                            >
                                                                                View Payment Proof
                                                                            </Button>
                                                                        ) : (
                                                                            <Text fontSize="sm" color="gray.600" mt={1}>Payment proof not uploaded yet.</Text>
                                                                        )}
                                                                        <HStack mt={2}>
                                                                            <Button
                                                                                size="xs"
                                                                                colorPalette="green"
                                                                                onClick={() => handleTeamPaymentReview(String(request._id), String(member.participantId), "approve")}
                                                                                loading={processingTeamPaymentKey === `${String(request._id)}-${String(member.participantId)}`}
                                                                                disabled={!member.paymentProof?.contentBase64}
                                                                            >
                                                                                Approve
                                                                            </Button>
                                                                            <Button
                                                                                size="xs"
                                                                                colorPalette="red"
                                                                                variant="outline"
                                                                                onClick={() => handleTeamPaymentReview(String(request._id), String(member.participantId), "reject")}
                                                                                loading={processingTeamPaymentKey === `${String(request._id)}-${String(member.participantId)}`}
                                                                                disabled={!member.paymentProof?.contentBase64}
                                                                            >
                                                                                Reject
                                                                            </Button>
                                                                        </HStack>
                                                                    </Box>
                                                                ))}
                                                            </Stack>
                                                        </Box>
                                                    ) : (
                                                        <Box
                                                            key={String(request._id)}
                                                            border="1px solid"
                                                            borderColor="gray.100"
                                                            borderRadius="md"
                                                            p={3}
                                                        >
                                                            <Stack gap={2}>
                                                                <SimpleGrid columns={{ base: 1, md: 2 }} gap={2}>
                                                                    <Text fontSize="sm" color="gray.700">Name: {request.participantName}</Text>
                                                                    <Text fontSize="sm" color="gray.700">Email: {request.participantEmail}</Text>
                                                                    <Text fontSize="sm" color="gray.700">Requested At: {formatDate(request.requestedAt)}</Text>
                                                                    <Text fontSize="sm" color="gray.700">Payment: Rs. {request.paymentAmount ?? 0}</Text>
                                                                </SimpleGrid>
                                                                {request.paymentProof?.contentBase64 ? (
                                                                    <Button
                                                                        as="a"
                                                                        href={request.paymentProof.contentBase64}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        size="xs"
                                                                        alignSelf="start"
                                                                        variant="outline"
                                                                    >
                                                                        View Payment Proof
                                                                    </Button>
                                                                ) : (
                                                                    <Text fontSize="sm" color="gray.600">Payment proof not available.</Text>
                                                                )}
                                                                <HStack>
                                                                    <Button
                                                                        size="xs"
                                                                        colorPalette="green"
                                                                        onClick={() => handlePendingRequestReview(String(request._id), "approve")}
                                                                        loading={processingPendingRequestId === String(request._id)}
                                                                    >
                                                                        Accept
                                                                    </Button>
                                                                    <Button
                                                                        size="xs"
                                                                        colorPalette="red"
                                                                        variant="outline"
                                                                        onClick={() => handlePendingRequestReview(String(request._id), "reject")}
                                                                        loading={processingPendingRequestId === String(request._id)}
                                                                    >
                                                                        Reject
                                                                    </Button>
                                                                </HStack>
                                                            </Stack>
                                                        </Box>
                                                    )
                                                ))}
                                            </Stack>
                                        )}
                                    </Stack>
                                </Box>
                                {registrations.length === 0 ? (
                                    <Text color="gray.600">No participants have registered yet.</Text>
                                ) : (
                                    <Stack gap={3}>
                                        <Box border="1px solid" borderColor="gray.100" borderRadius="md" overflowX="auto">
                                            <Box
                                                minW="640px"
                                                px={3}
                                                py={2}
                                                bg="gray.50"
                                                borderBottom="1px solid"
                                                borderColor="gray.100"
                                            >
                                                <SimpleGrid columns={4} gap={3}>
                                                    <Text fontSize="xs" color="gray.500" fontWeight="bold">Name</Text>
                                                    <Text fontSize="xs" color="gray.500" fontWeight="bold">Email</Text>
                                                    <Text fontSize="xs" color="gray.500" fontWeight="bold">Registered At</Text>
                                                    <Text fontSize="xs" color="gray.500" fontWeight="bold">Form Fields</Text>
                                                </SimpleGrid>
                                            </Box>
                                            <Stack gap={0}>
                                                {filteredRegistrationRows.map((row) => {
                                                    const { entry, index, participantName, participantEmail } = row;
                                                    const isSelected = selectedRegistrationIndex === index;

                                                    return (
                                                        <Box
                                                            key={`${entry.participantId}-${entry.registeredAt}-${index}`}
                                                            minW="640px"
                                                            px={3}
                                                            py={2.5}
                                                            borderTop={index === 0 ? "none" : "1px solid"}
                                                            borderColor="gray.100"
                                                            bg={isSelected ? "teal.50" : "white"}
                                                            cursor="pointer"
                                                            onClick={() => setSelectedRegistrationIndex(index)}
                                                        >
                                                            <SimpleGrid columns={4} gap={3}>
                                                                <Text fontSize="sm" fontWeight="medium" color="gray.800">
                                                                    {participantName}
                                                                </Text>
                                                                <Text fontSize="sm" color="gray.700">
                                                                    {participantEmail}
                                                                </Text>
                                                                <Text fontSize="sm" color="gray.700">
                                                                    {formatDate(entry.registeredAt)}
                                                                </Text>
                                                                <Text fontSize="sm" color="gray.700">
                                                                    {Array.isArray(entry.formSnapshot) ? entry.formSnapshot.length : 0}
                                                                </Text>
                                                            </SimpleGrid>
                                                        </Box>
                                                    );
                                                })}
                                                {filteredRegistrationRows.length === 0 && (
                                                    <Box minW="640px" px={3} py={3}>
                                                        <Text fontSize="sm" color="gray.600">
                                                            No participants matched your search.
                                                        </Text>
                                                    </Box>
                                                )}
                                            </Stack>
                                        </Box>

                                        <Box border="1px solid" borderColor="gray.100" borderRadius="md" p={4}>
                                            {selectedRegistration ? (
                                                <Stack gap={3}>
                                                    <Text fontSize="sm" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                                                        Selected Participant Submission
                                                    </Text>
                                                    {Array.isArray(selectedRegistration.formSnapshot) &&
                                                        selectedRegistration.formSnapshot.length > 0 ? (
                                                        <Stack gap={3}>
                                                            {selectedRegistration.formSnapshot.map((field, fieldIndex) => (
                                                                <Box
                                                                    key={`${field.fieldLabel}-${fieldIndex}`}
                                                                    border="1px solid"
                                                                    borderColor="gray.100"
                                                                    borderRadius="md"
                                                                    p={3}
                                                                >
                                                                    <Text fontWeight="semibold" color="gray.800">
                                                                        {field.fieldLabel || `Field ${fieldIndex + 1}`}
                                                                    </Text>
                                                                    {field.fieldDescription && (
                                                                        <Text fontSize="xs" color="gray.500" mt={1}>
                                                                            {field.fieldDescription}
                                                                        </Text>
                                                                    )}
                                                                    <Text fontSize="sm" color="teal.700" mt={1}>
                                                                        Type: {field.dataType || "N/A"}
                                                                    </Text>
                                                                    <Text fontSize="sm" color="gray.800" mt={1}>
                                                                        Response: {formatSubmittedFieldValue(field)}
                                                                    </Text>
                                                                </Box>
                                                            ))}
                                                        </Stack>
                                                    ) : (
                                                        <Text color="gray.600">No form data submitted.</Text>
                                                    )}
                                                    {selectedRegistration.qrCodeDataUrl && (
                                                        <Box border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                                                            <Text fontSize="sm" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={2}>
                                                                Registration QR
                                                            </Text>
                                                            <Box
                                                                as="img"
                                                                src={selectedRegistration.qrCodeDataUrl}
                                                                alt="Registration QR"
                                                                maxW="220px"
                                                                borderRadius="md"
                                                            />
                                                        </Box>
                                                    )}
                                                </Stack>
                                            ) : (
                                                <Text color="gray.600">Select a participant row to view submission details.</Text>
                                            )}
                                        </Box>
                                    </Stack>
                                )}
                                <Box border="1px solid" borderColor="gray.100" borderRadius="md" p={4}>
                                    <Stack gap={4}>
                                        <HStack justify="space-between" align="center" wrap="wrap">
                                            <Heading size="sm">Feedback Analytics</Heading>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={exportFeedbackCsv}
                                                disabled={filteredFeedbackRows.length === 0}
                                            >
                                                Export Feedback CSV
                                            </Button>
                                        </HStack>

                                        <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
                                            <Box p={3} border="1px solid" borderColor="gray.100" borderRadius="md">
                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">Average Rating</Text>
                                                <Text fontSize="lg" fontWeight="semibold" color="teal.700">{averageFeedbackRating}</Text>
                                            </Box>
                                            <Box p={3} border="1px solid" borderColor="gray.100" borderRadius="md">
                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">Total Feedback</Text>
                                                <Text fontSize="lg" fontWeight="semibold" color="gray.800">{feedbackStats.total}</Text>
                                            </Box>
                                            <Box p={3} border="1px solid" borderColor="gray.100" borderRadius="md">
                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">Rating Distribution</Text>
                                                <Text fontSize="sm" color="gray.700">
                                                    5★ {feedbackStats.counts[5]} | 4★ {feedbackStats.counts[4]} | 3★ {feedbackStats.counts[3]} | 2★ {feedbackStats.counts[2]} | 1★ {feedbackStats.counts[1]}
                                                </Text>
                                            </Box>
                                        </SimpleGrid>

                                        <HStack gap={2} wrap="wrap">
                                            {["All", "5", "4", "3", "2", "1"].map((rating) => (
                                                <Box
                                                    key={rating}
                                                    as="button"
                                                    px={3}
                                                    py={1.5}
                                                    borderRadius="full"
                                                    border="1px solid"
                                                    borderColor={feedbackRatingFilter === rating ? "teal.400" : "gray.200"}
                                                    bg={feedbackRatingFilter === rating ? "teal.50" : "white"}
                                                    color={feedbackRatingFilter === rating ? "teal.700" : "gray.700"}
                                                    fontWeight="semibold"
                                                    fontSize="sm"
                                                    onClick={() => setFeedbackRatingFilter(rating)}
                                                >
                                                    {rating === "All" ? "All Ratings" : `${rating}★`}
                                                </Box>
                                            ))}
                                        </HStack>

                                        {filteredFeedbackRows.length === 0 ? (
                                            <Text color="gray.600">No feedback found for the selected rating.</Text>
                                        ) : (
                                            <Box border="1px solid" borderColor="gray.100" borderRadius="md" overflowX="auto">
                                                <Box
                                                    minW="640px"
                                                    px={3}
                                                    py={2}
                                                    bg="gray.50"
                                                    borderBottom="1px solid"
                                                    borderColor="gray.100"
                                                >
                                                    <SimpleGrid columns={3} gap={3}>
                                                        <Text fontSize="xs" color="gray.500" fontWeight="bold">Submitted At</Text>
                                                        <Text fontSize="xs" color="gray.500" fontWeight="bold">Rating</Text>
                                                        <Text fontSize="xs" color="gray.500" fontWeight="bold">Comment</Text>
                                                    </SimpleGrid>
                                                </Box>
                                                <Stack gap={0}>
                                                    {filteredFeedbackRows.map((entry, index) => (
                                                        <Box
                                                            key={entry.key}
                                                            minW="640px"
                                                            px={3}
                                                            py={2.5}
                                                            borderTop={index === 0 ? "none" : "1px solid"}
                                                            borderColor="gray.100"
                                                            bg="white"
                                                        >
                                                            <SimpleGrid columns={3} gap={3}>
                                                                <Text fontSize="sm" color="gray.700">{formatDate(entry.submittedAt)}</Text>
                                                                <Text fontSize="sm" color="teal.700" fontWeight="semibold">{entry.rating} / 5</Text>
                                                                <Text fontSize="sm" color="gray.800">{entry.comment}</Text>
                                                            </SimpleGrid>
                                                        </Box>
                                                    ))}
                                                </Stack>
                                            </Box>
                                        )}
                                    </Stack>
                                </Box>
                            </Stack>
                        </Box>
                    ) : (
                        <Box p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" boxShadow="sm">
                            <Stack gap={4}>
                                <Heading size="md">Purchase Info</Heading>
                                <Box border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                                    <Stack gap={3}>
                                        <Heading size="sm">Pending Purchase Requests</Heading>
                                        {pendingMerchRequestActionError && (
                                            <Text color="red.500" fontSize="sm">{pendingMerchRequestActionError}</Text>
                                        )}
                                        {pendingMerchPurchaseRequests.length === 0 ? (
                                            <Text color="gray.600">No pending purchase requests.</Text>
                                        ) : (
                                            <Stack gap={2}>
                                                {pendingMerchPurchaseRequests.map((request) => (
                                                    <Box
                                                        key={request.key}
                                                        border="1px solid"
                                                        borderColor="gray.100"
                                                        borderRadius="md"
                                                        p={3}
                                                    >
                                                        <Stack gap={2}>
                                                            <SimpleGrid columns={{ base: 1, md: 2 }} gap={2}>
                                                                <Text fontSize="sm" color="gray.700">Item: {request.itemName}</Text>
                                                                <Text fontSize="sm" color="gray.700">Participant: {request.participantName}</Text>
                                                                <Text fontSize="sm" color="gray.700">Email: {request.participantEmail}</Text>
                                                                <Text fontSize="sm" color="gray.700">Quantity: {request.quantity}</Text>
                                                                <Text fontSize="sm" color="gray.700">Color: {request.selectedColor || "N/A"}</Text>
                                                                <Text fontSize="sm" color="gray.700">Size: {request.selectedSize || "N/A"}</Text>
                                                                <Text fontSize="sm" color="gray.700">Payment: Rs. {request.paymentAmount}</Text>
                                                                <Text fontSize="sm" color="gray.700">Requested At: {formatDate(request.requestedAt)}</Text>
                                                            </SimpleGrid>
                                                            {request.paymentProofDataUrl ? (
                                                                <Button
                                                                    as="a"
                                                                    href={request.paymentProofDataUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    size="xs"
                                                                    alignSelf="start"
                                                                    variant="outline"
                                                                >
                                                                    View Payment Proof
                                                                </Button>
                                                            ) : (
                                                                <Text fontSize="sm" color="gray.600">Payment proof not available.</Text>
                                                            )}
                                                            <HStack>
                                                                <Button
                                                                    size="xs"
                                                                    colorPalette="green"
                                                                    onClick={() => handlePendingMerchRequestReview(request.itemId, request.requestId, "approve")}
                                                                    loading={processingPendingMerchRequestKey === request.key}
                                                                >
                                                                    Accept
                                                                </Button>
                                                                <Button
                                                                    size="xs"
                                                                    colorPalette="red"
                                                                    variant="outline"
                                                                    onClick={() => handlePendingMerchRequestReview(request.itemId, request.requestId, "reject")}
                                                                    loading={processingPendingMerchRequestKey === request.key}
                                                                >
                                                                    Reject
                                                                </Button>
                                                            </HStack>
                                                        </Stack>
                                                    </Box>
                                                ))}
                                            </Stack>
                                        )}
                                    </Stack>
                                </Box>
                                {merchandisePurchaseRows.length === 0 ? (
                                    <Text color="gray.600">No purchases have been made yet.</Text>
                                ) : (
                                    <Stack gap={3}>
                                        <Box border="1px solid" borderColor="gray.100" borderRadius="md" overflowX="auto">
                                            <Box
                                                minW="700px"
                                                px={3}
                                                py={2}
                                                bg="gray.50"
                                                borderBottom="1px solid"
                                                borderColor="gray.100"
                                            >
                                                <SimpleGrid columns={4} gap={3}>
                                                    <Text fontSize="xs" color="gray.500" fontWeight="bold">Item</Text>
                                                    <Text fontSize="xs" color="gray.500" fontWeight="bold">Participant</Text>
                                                    <Text fontSize="xs" color="gray.500" fontWeight="bold">Quantity</Text>
                                                    <Text fontSize="xs" color="gray.500" fontWeight="bold">Purchased At</Text>
                                                </SimpleGrid>
                                            </Box>
                                            <Stack gap={0}>
                                                {merchandisePurchaseRows.map((row, index) => (
                                                    <Box
                                                        key={row.key}
                                                        minW="700px"
                                                        px={3}
                                                        py={2.5}
                                                        borderTop={index === 0 ? "none" : "1px solid"}
                                                        borderColor="gray.100"
                                                        bg={selectedMerchPurchaseKey === row.key ? "teal.50" : "white"}
                                                        cursor="pointer"
                                                        onClick={() => setSelectedMerchPurchaseKey(row.key)}
                                                    >
                                                        <SimpleGrid columns={4} gap={3}>
                                                            <Text fontSize="sm" fontWeight="medium" color="gray.800">{row.itemName}</Text>
                                                            <Text fontSize="sm" color="gray.700">{row.participantName}</Text>
                                                            <Text fontSize="sm" color="gray.700">{row.quantity}</Text>
                                                            <Text fontSize="sm" color="gray.700">{formatDate(row.purchasedAt)}</Text>
                                                        </SimpleGrid>
                                                    </Box>
                                                ))}
                                            </Stack>
                                        </Box>

                                        <Box border="1px solid" borderColor="gray.100" borderRadius="md" p={4}>
                                            {selectedMerchPurchase ? (
                                                <Stack gap={3}>
                                                    <Text fontSize="sm" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                                                        Selected Purchase
                                                    </Text>
                                                    <SimpleGrid columns={{ base: 1, md: 2 }} gap={2}>
                                                        <Text fontSize="sm" color="gray.700">Item: {selectedMerchPurchase.itemName}</Text>
                                                        <Text fontSize="sm" color="gray.700">Participant: {selectedMerchPurchase.participantName}</Text>
                                                        <Text fontSize="sm" color="gray.700">Email: {selectedMerchPurchase.participantEmail}</Text>
                                                        <Text fontSize="sm" color="gray.700">Quantity: {selectedMerchPurchase.quantity}</Text>
                                                        <Text fontSize="sm" color="gray.700">Color: {selectedMerchPurchase.selectedColor || "N/A"}</Text>
                                                        <Text fontSize="sm" color="gray.700">Size: {selectedMerchPurchase.selectedSize || "N/A"}</Text>
                                                        <Text fontSize="sm" color="gray.700">Purchased At: {formatDate(selectedMerchPurchase.purchasedAt)}</Text>
                                                    </SimpleGrid>
                                                    {selectedMerchPurchase.qrCodeDataUrl && (
                                                        <Box>
                                                            <Text fontSize="sm" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={2}>
                                                                Purchase QR
                                                            </Text>
                                                            <Box
                                                                as="img"
                                                                src={selectedMerchPurchase.qrCodeDataUrl}
                                                                alt="Purchase QR"
                                                                maxW="220px"
                                                                borderRadius="md"
                                                            />
                                                        </Box>
                                                    )}
                                                </Stack>
                                            ) : (
                                                <Text color="gray.600">Select a purchase row to view QR details.</Text>
                                            )}
                                        </Box>
                                    </Stack>
                                )}
                            </Stack>
                        </Box>
                    )}

                    {eventData.eventType === "Normal Event" && (
                        <Box p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" boxShadow="sm">
                            <Stack gap={4}>
                                <HStack justify="space-between" align="center">
                                    <Heading size="md">Registration Form</Heading>
                                    {canEditRegistrationForm && !eventData.isTeamEvent && editingRegFieldIndex === null && !editingFormTitle && (
                                        <Button size="sm" colorPalette="teal" variant="outline" onClick={beginAddRegField}>
                                            Add New Field
                                        </Button>
                                    )}
                                </HStack>
                                {isRegistrationFormLocked && (
                                    <Text color="orange.600" fontSize="sm">
                                        Form is locked because at least one participant has already registered.
                                    </Text>
                                )}

                                {regFieldSaveError && (
                                    <Text color="red.500" fontSize="sm">
                                        {regFieldSaveError}
                                    </Text>
                                )}

                                {eventData.isTeamEvent && (
                                    <Stack gap={3}>
                                        <Box border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                                            <HStack justify="space-between" align="center" mb={2}>
                                                <Text fontWeight="semibold" color="gray.700">
                                                    {eventData.customForm?.leaderFormTitle || "Team Leader Form"}
                                                </Text>
                                                {canEditRegistrationForm && editingRegFieldIndex === null && !editingFormTitle && (
                                                    <Button size="xs" colorPalette="teal" variant="outline" onClick={() => beginAddRegField("leader")}>
                                                        Add Field
                                                    </Button>
                                                )}
                                            </HStack>
                                            {Array.isArray(eventData.customForm?.leaderFields) && eventData.customForm.leaderFields.length > 0 ? (
                                                <Stack gap={2}>
                                                    {eventData.customForm.leaderFields.map((field, index) => (
                                                        <Box key={`leader-${field.fieldLabel || "field"}-${index}`} border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                                                            <Stack gap={3}>
                                                                <HStack justify="space-between" align="center">
                                                                    <Text fontWeight="semibold">Field {index + 1}</Text>
                                                                    <HStack gap={1}>
                                                                        <Button
                                                                            size="xs"
                                                                            variant="outline"
                                                                            onClick={() => moveRegField(index, "up", "leader")}
                                                                            disabled={index === 0 || !canEditRegistrationForm || editingRegFieldIndex !== null || editingFormTitle}
                                                                        >
                                                                            Up
                                                                        </Button>
                                                                        <Button
                                                                            size="xs"
                                                                            variant="outline"
                                                                            onClick={() => moveRegField(index, "down", "leader")}
                                                                            disabled={
                                                                                index === (eventData.customForm.leaderFields.length - 1) ||
                                                                                !canEditRegistrationForm ||
                                                                                editingRegFieldIndex !== null ||
                                                                                editingFormTitle
                                                                            }
                                                                        >
                                                                            Down
                                                                        </Button>
                                                                        {editingRegFieldSection === "leader" && editingRegFieldIndex === index ? (
                                                                            <>
                                                                                <Button size="xs" colorPalette="green" onClick={saveRegFieldChange} loading={isSavingRegField}>✓</Button>
                                                                                <Button size="xs" colorPalette="red" variant="outline" onClick={cancelRegFieldEdit} disabled={isSavingRegField}>✕</Button>
                                                                            </>
                                                                        ) : (
                                                                            <Button
                                                                                size="xs"
                                                                                variant="outline"
                                                                                onClick={() => beginEditRegField(index, "leader")}
                                                                                disabled={editingRegFieldIndex !== null || editingFormTitle || !canEditRegistrationForm}
                                                                            >
                                                                                Edit
                                                                            </Button>
                                                                        )}
                                                                    </HStack>
                                                                </HStack>

                                                                {editingRegFieldSection === "leader" && editingRegFieldIndex === index ? (
                                                                    <Stack gap={3}>
                                                                        <Box>
                                                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Field Label</Text>
                                                                            <Input value={regFieldDraft.fieldLabel} onChange={(e) => handleRegFieldDraftChange("fieldLabel", e.target.value)} />
                                                                        </Box>
                                                                        <Box>
                                                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Field Description</Text>
                                                                            <Textarea rows={2} value={regFieldDraft.fieldDescription} onChange={(e) => handleRegFieldDraftChange("fieldDescription", e.target.value)} />
                                                                        </Box>
                                                                        <Box>
                                                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Datatype</Text>
                                                                            <select value={regFieldDraft.dataType} onChange={(e) => handleRegFieldDraftChange("dataType", e.target.value)} style={selectStyle}>
                                                                                {DATA_TYPE_OPTIONS.map((type) => (
                                                                                    <option key={type} value={type}>{type}</option>
                                                                                ))}
                                                                            </select>
                                                                        </Box>
                                                                        <Box>
                                                                            <Text as="label" fontSize="sm" display="flex" alignItems="center" gap={2}>
                                                                                <input type="checkbox" checked={regFieldDraft.required} onChange={(e) => handleRegFieldDraftChange("required", e.target.checked)} />
                                                                                {regFieldDraft.required ? "Required" : "Flexible"}
                                                                            </Text>
                                                                        </Box>
                                                                        {isOptionsType(regFieldDraft.dataType) && (
                                                                            <Box>
                                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Options (comma-separated)</Text>
                                                                                <Input value={regFieldDraft.optionsRaw} onChange={(e) => handleRegFieldDraftChange("optionsRaw", e.target.value)} />
                                                                            </Box>
                                                                        )}
                                                                    </Stack>
                                                                ) : (
                                                                    <Stack gap={1}>
                                                                        <Text fontWeight="semibold">{field.fieldLabel || `Field ${index + 1}`}</Text>
                                                                        <Text fontSize="sm" color="gray.700">{field.fieldDescription || "No description"}</Text>
                                                                        <Text fontSize="sm" color="teal.700">Type: {field.dataType}</Text>
                                                                        <Text fontSize="sm" color={field.required ? "orange.600" : "gray.600"}>
                                                                            {field.required ? "Required" : "Flexible"}
                                                                        </Text>
                                                                        {Array.isArray(field.options) && field.options.length > 0 && (
                                                                            <Text fontSize="sm" color="gray.700">
                                                                                Options: {field.options.join(", ")}
                                                                            </Text>
                                                                        )}
                                                                    </Stack>
                                                                )}
                                                            </Stack>
                                                        </Box>
                                                    ))}
                                                </Stack>
                                            ) : (
                                                <Text color="gray.600">No team leader fields created yet.</Text>
                                            )}

                                            {editingRegFieldSection === "leader" && editingRegFieldIndex === -1 && (
                                                <Box border="1px solid" borderColor="teal.200" borderRadius="md" p={3} mt={3}>
                                                    <Stack gap={3}>
                                                        <HStack justify="space-between" align="center">
                                                            <Text fontWeight="semibold">New Leader Field</Text>
                                                            <HStack gap={1}>
                                                                <Button size="xs" colorPalette="green" onClick={saveRegFieldChange} loading={isSavingRegField}>✓</Button>
                                                                <Button size="xs" colorPalette="red" variant="outline" onClick={cancelRegFieldEdit} disabled={isSavingRegField}>✕</Button>
                                                            </HStack>
                                                        </HStack>
                                                        <Box>
                                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Field Label</Text>
                                                            <Input value={regFieldDraft.fieldLabel} onChange={(e) => handleRegFieldDraftChange("fieldLabel", e.target.value)} />
                                                        </Box>
                                                        <Box>
                                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Field Description</Text>
                                                            <Textarea rows={2} value={regFieldDraft.fieldDescription} onChange={(e) => handleRegFieldDraftChange("fieldDescription", e.target.value)} />
                                                        </Box>
                                                        <Box>
                                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Datatype</Text>
                                                            <select value={regFieldDraft.dataType} onChange={(e) => handleRegFieldDraftChange("dataType", e.target.value)} style={selectStyle}>
                                                                {DATA_TYPE_OPTIONS.map((type) => (
                                                                    <option key={type} value={type}>{type}</option>
                                                                ))}
                                                            </select>
                                                        </Box>
                                                        <Box>
                                                            <Text as="label" fontSize="sm" display="flex" alignItems="center" gap={2}>
                                                                <input type="checkbox" checked={regFieldDraft.required} onChange={(e) => handleRegFieldDraftChange("required", e.target.checked)} />
                                                                {regFieldDraft.required ? "Required" : "Flexible"}
                                                            </Text>
                                                        </Box>
                                                        {isOptionsType(regFieldDraft.dataType) && (
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Options (comma-separated)</Text>
                                                                <Input value={regFieldDraft.optionsRaw} onChange={(e) => handleRegFieldDraftChange("optionsRaw", e.target.value)} />
                                                            </Box>
                                                        )}
                                                    </Stack>
                                                </Box>
                                            )}
                                        </Box>

                                        <Box border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                                            <HStack justify="space-between" align="center" mb={2}>
                                                <Text fontWeight="semibold" color="gray.700">
                                                    {eventData.customForm?.memberFormTitle || "Team Member Form"}
                                                </Text>
                                                {canEditRegistrationForm && editingRegFieldIndex === null && !editingFormTitle && (
                                                    <Button size="xs" colorPalette="teal" variant="outline" onClick={() => beginAddRegField("member")}>
                                                        Add Field
                                                    </Button>
                                                )}
                                            </HStack>
                                            {Array.isArray(eventData.customForm?.memberFields) && eventData.customForm.memberFields.length > 0 ? (
                                                <Stack gap={2}>
                                                    {eventData.customForm.memberFields.map((field, index) => (
                                                        <Box key={`member-${field.fieldLabel || "field"}-${index}`} border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                                                            <Stack gap={3}>
                                                                <HStack justify="space-between" align="center">
                                                                    <Text fontWeight="semibold">Field {index + 1}</Text>
                                                                    <HStack gap={1}>
                                                                        <Button
                                                                            size="xs"
                                                                            variant="outline"
                                                                            onClick={() => moveRegField(index, "up", "member")}
                                                                            disabled={index === 0 || !canEditRegistrationForm || editingRegFieldIndex !== null || editingFormTitle}
                                                                        >
                                                                            Up
                                                                        </Button>
                                                                        <Button
                                                                            size="xs"
                                                                            variant="outline"
                                                                            onClick={() => moveRegField(index, "down", "member")}
                                                                            disabled={
                                                                                index === (eventData.customForm.memberFields.length - 1) ||
                                                                                !canEditRegistrationForm ||
                                                                                editingRegFieldIndex !== null ||
                                                                                editingFormTitle
                                                                            }
                                                                        >
                                                                            Down
                                                                        </Button>
                                                                        {editingRegFieldSection === "member" && editingRegFieldIndex === index ? (
                                                                            <>
                                                                                <Button size="xs" colorPalette="green" onClick={saveRegFieldChange} loading={isSavingRegField}>✓</Button>
                                                                                <Button size="xs" colorPalette="red" variant="outline" onClick={cancelRegFieldEdit} disabled={isSavingRegField}>✕</Button>
                                                                            </>
                                                                        ) : (
                                                                            <Button
                                                                                size="xs"
                                                                                variant="outline"
                                                                                onClick={() => beginEditRegField(index, "member")}
                                                                                disabled={editingRegFieldIndex !== null || editingFormTitle || !canEditRegistrationForm}
                                                                            >
                                                                                Edit
                                                                            </Button>
                                                                        )}
                                                                    </HStack>
                                                                </HStack>

                                                                {editingRegFieldSection === "member" && editingRegFieldIndex === index ? (
                                                                    <Stack gap={3}>
                                                                        <Box>
                                                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Field Label</Text>
                                                                            <Input value={regFieldDraft.fieldLabel} onChange={(e) => handleRegFieldDraftChange("fieldLabel", e.target.value)} />
                                                                        </Box>
                                                                        <Box>
                                                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Field Description</Text>
                                                                            <Textarea rows={2} value={regFieldDraft.fieldDescription} onChange={(e) => handleRegFieldDraftChange("fieldDescription", e.target.value)} />
                                                                        </Box>
                                                                        <Box>
                                                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Datatype</Text>
                                                                            <select value={regFieldDraft.dataType} onChange={(e) => handleRegFieldDraftChange("dataType", e.target.value)} style={selectStyle}>
                                                                                {DATA_TYPE_OPTIONS.map((type) => (
                                                                                    <option key={type} value={type}>{type}</option>
                                                                                ))}
                                                                            </select>
                                                                        </Box>
                                                                        <Box>
                                                                            <Text as="label" fontSize="sm" display="flex" alignItems="center" gap={2}>
                                                                                <input type="checkbox" checked={regFieldDraft.required} onChange={(e) => handleRegFieldDraftChange("required", e.target.checked)} />
                                                                                {regFieldDraft.required ? "Required" : "Flexible"}
                                                                            </Text>
                                                                        </Box>
                                                                        {isOptionsType(regFieldDraft.dataType) && (
                                                                            <Box>
                                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Options (comma-separated)</Text>
                                                                                <Input value={regFieldDraft.optionsRaw} onChange={(e) => handleRegFieldDraftChange("optionsRaw", e.target.value)} />
                                                                            </Box>
                                                                        )}
                                                                    </Stack>
                                                                ) : (
                                                                    <Stack gap={1}>
                                                                        <Text fontWeight="semibold">{field.fieldLabel || `Field ${index + 1}`}</Text>
                                                                        <Text fontSize="sm" color="gray.700">{field.fieldDescription || "No description"}</Text>
                                                                        <Text fontSize="sm" color="teal.700">Type: {field.dataType}</Text>
                                                                        <Text fontSize="sm" color={field.required ? "orange.600" : "gray.600"}>
                                                                            {field.required ? "Required" : "Flexible"}
                                                                        </Text>
                                                                        {Array.isArray(field.options) && field.options.length > 0 && (
                                                                            <Text fontSize="sm" color="gray.700">
                                                                                Options: {field.options.join(", ")}
                                                                            </Text>
                                                                        )}
                                                                    </Stack>
                                                                )}
                                                            </Stack>
                                                        </Box>
                                                    ))}
                                                </Stack>
                                            ) : (
                                                <Text color="gray.600">No team member fields created yet.</Text>
                                            )}

                                            {editingRegFieldSection === "member" && editingRegFieldIndex === -1 && (
                                                <Box border="1px solid" borderColor="teal.200" borderRadius="md" p={3} mt={3}>
                                                    <Stack gap={3}>
                                                        <HStack justify="space-between" align="center">
                                                            <Text fontWeight="semibold">New Member Field</Text>
                                                            <HStack gap={1}>
                                                                <Button size="xs" colorPalette="green" onClick={saveRegFieldChange} loading={isSavingRegField}>✓</Button>
                                                                <Button size="xs" colorPalette="red" variant="outline" onClick={cancelRegFieldEdit} disabled={isSavingRegField}>✕</Button>
                                                            </HStack>
                                                        </HStack>
                                                        <Box>
                                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Field Label</Text>
                                                            <Input value={regFieldDraft.fieldLabel} onChange={(e) => handleRegFieldDraftChange("fieldLabel", e.target.value)} />
                                                        </Box>
                                                        <Box>
                                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Field Description</Text>
                                                            <Textarea rows={2} value={regFieldDraft.fieldDescription} onChange={(e) => handleRegFieldDraftChange("fieldDescription", e.target.value)} />
                                                        </Box>
                                                        <Box>
                                                            <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Datatype</Text>
                                                            <select value={regFieldDraft.dataType} onChange={(e) => handleRegFieldDraftChange("dataType", e.target.value)} style={selectStyle}>
                                                                {DATA_TYPE_OPTIONS.map((type) => (
                                                                    <option key={type} value={type}>{type}</option>
                                                                ))}
                                                            </select>
                                                        </Box>
                                                        <Box>
                                                            <Text as="label" fontSize="sm" display="flex" alignItems="center" gap={2}>
                                                                <input type="checkbox" checked={regFieldDraft.required} onChange={(e) => handleRegFieldDraftChange("required", e.target.checked)} />
                                                                {regFieldDraft.required ? "Required" : "Flexible"}
                                                            </Text>
                                                        </Box>
                                                        {isOptionsType(regFieldDraft.dataType) && (
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>Options (comma-separated)</Text>
                                                                <Input value={regFieldDraft.optionsRaw} onChange={(e) => handleRegFieldDraftChange("optionsRaw", e.target.value)} />
                                                            </Box>
                                                        )}
                                                    </Stack>
                                                </Box>
                                            )}
                                        </Box>
                                    </Stack>
                                )}

                                {!eventData.isTeamEvent && (
                                    <Box border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                                        <Stack gap={2}>
                                            <HStack justify="space-between" align="center">
                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                                                    Form Title
                                                </Text>
                                                {editingFormTitle ? (
                                                    <HStack gap={1}>
                                                        <Button
                                                            size="xs"
                                                            colorPalette="green"
                                                            onClick={saveFormTitleChange}
                                                            loading={isSavingFormTitle}
                                                        >
                                                            ✓
                                                        </Button>
                                                        <Button
                                                            size="xs"
                                                            colorPalette="red"
                                                            variant="outline"
                                                            onClick={cancelFormTitleEdit}
                                                            disabled={isSavingFormTitle}
                                                        >
                                                            ✕
                                                        </Button>
                                                    </HStack>
                                                ) : (
                                                    <Button
                                                        size="xs"
                                                        variant="outline"
                                                        onClick={beginEditFormTitle}
                                                        disabled={editingRegFieldIndex !== null || !canEditRegistrationForm}
                                                    >
                                                        Edit
                                                    </Button>
                                                )}
                                            </HStack>
                                            {editingFormTitle ? (
                                                <Input value={formTitleDraft} onChange={(e) => setFormTitleDraft(e.target.value)} />
                                            ) : (
                                                <Text fontWeight="semibold" color="gray.700">
                                                    {eventData.customForm?.formTitle || "Registration Form"}
                                                </Text>
                                            )}
                                        </Stack>
                                    </Box>
                                )}

                                {!eventData.isTeamEvent && (Array.isArray(eventData.customForm?.fields) && eventData.customForm.fields.length > 0 ? (
                                    <Stack gap={3}>
                                        {eventData.customForm.fields.map((field, index) => (
                                            <Box key={`${field.fieldLabel}-${index}`} border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                                                <Stack gap={3}>
                                                    <HStack justify="space-between" align="center">
                                                        <Text fontWeight="semibold">Field {index + 1}</Text>
                                                        <HStack gap={1}>
                                                            <Button
                                                                size="xs"
                                                                variant="outline"
                                                                onClick={() => moveRegField(index, "up")}
                                                                disabled={index === 0 || !canEditRegistrationForm || editingRegFieldIndex !== null || editingFormTitle}
                                                            >
                                                                Up
                                                            </Button>
                                                            <Button
                                                                size="xs"
                                                                variant="outline"
                                                                onClick={() => moveRegField(index, "down")}
                                                                disabled={
                                                                    index === (eventData.customForm.fields.length - 1) ||
                                                                    !canEditRegistrationForm ||
                                                                    editingRegFieldIndex !== null ||
                                                                    editingFormTitle
                                                                }
                                                            >
                                                                Down
                                                            </Button>
                                                            {editingRegFieldIndex === index ? (
                                                                <>
                                                                    <Button
                                                                        size="xs"
                                                                        colorPalette="green"
                                                                        onClick={saveRegFieldChange}
                                                                        loading={isSavingRegField}
                                                                    >
                                                                        ✓
                                                                    </Button>
                                                                    <Button
                                                                        size="xs"
                                                                        colorPalette="red"
                                                                        variant="outline"
                                                                        onClick={cancelRegFieldEdit}
                                                                        disabled={isSavingRegField}
                                                                    >
                                                                        ✕
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <Button
                                                                    size="xs"
                                                                    variant="outline"
                                                                    onClick={() => beginEditRegField(index)}
                                                                    disabled={editingRegFieldIndex !== null || editingFormTitle || !canEditRegistrationForm}
                                                                >
                                                                    Edit
                                                                </Button>
                                                            )}
                                                        </HStack>
                                                    </HStack>

                                                    {editingRegFieldIndex === index ? (
                                                        <Stack gap={3}>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                                    Field Label
                                                                </Text>
                                                                <Input
                                                                    value={regFieldDraft.fieldLabel}
                                                                    onChange={(e) => handleRegFieldDraftChange("fieldLabel", e.target.value)}
                                                                />
                                                            </Box>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                                    Field Description
                                                                </Text>
                                                                <Textarea
                                                                    rows={2}
                                                                    value={regFieldDraft.fieldDescription}
                                                                    onChange={(e) => handleRegFieldDraftChange("fieldDescription", e.target.value)}
                                                                />
                                                            </Box>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                                    Datatype
                                                                </Text>
                                                                <select
                                                                    value={regFieldDraft.dataType}
                                                                    onChange={(e) => handleRegFieldDraftChange("dataType", e.target.value)}
                                                                    style={selectStyle}
                                                                >
                                                                    {DATA_TYPE_OPTIONS.map((type) => (
                                                                        <option key={type} value={type}>
                                                                            {type}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </Box>
                                                            <Box>
                                                                <Text as="label" fontSize="sm" display="flex" alignItems="center" gap={2}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={regFieldDraft.required}
                                                                        onChange={(e) => handleRegFieldDraftChange("required", e.target.checked)}
                                                                    />
                                                                    {regFieldDraft.required ? "Required" : "Flexible"}
                                                                </Text>
                                                            </Box>
                                                            {isOptionsType(regFieldDraft.dataType) && (
                                                                <Box>
                                                                    <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                                        Options (comma-separated)
                                                                    </Text>
                                                                    <Input
                                                                        value={regFieldDraft.optionsRaw}
                                                                        onChange={(e) => handleRegFieldDraftChange("optionsRaw", e.target.value)}
                                                                    />
                                                                </Box>
                                                            )}
                                                        </Stack>
                                                    ) : (
                                                        <Stack gap={1}>
                                                            <Text fontWeight="semibold">{field.fieldLabel}</Text>
                                                            <Text fontSize="sm" color="gray.700">
                                                                {field.fieldDescription || "No description"}
                                                            </Text>
                                                            <Text fontSize="sm" color="teal.700">Type: {field.dataType}</Text>
                                                            <Text fontSize="sm" color={field.required ? "orange.600" : "gray.600"}>
                                                                {field.required ? "Required" : "Flexible"}
                                                            </Text>
                                                            {Array.isArray(field.options) && field.options.length > 0 && (
                                                                <Text fontSize="sm" color="gray.700">
                                                                    Options: {field.options.join(", ")}
                                                                </Text>
                                                            )}
                                                        </Stack>
                                                    )}
                                                </Stack>
                                            </Box>
                                        ))}
                                    </Stack>
                                ) : (
                                    <Text color="gray.600">No registration form fields have been created yet.</Text>
                                ))}

                                {!eventData.isTeamEvent && editingRegFieldIndex === -1 && (
                                    <Box border="1px solid" borderColor="teal.200" borderRadius="md" p={3}>
                                        <Stack gap={3}>
                                            <HStack justify="space-between" align="center">
                                                <Text fontWeight="semibold">New Field</Text>
                                                <HStack gap={1}>
                                                    <Button
                                                        size="xs"
                                                        colorPalette="green"
                                                        onClick={saveRegFieldChange}
                                                        loading={isSavingRegField}
                                                    >
                                                        ✓
                                                    </Button>
                                                    <Button
                                                        size="xs"
                                                        colorPalette="red"
                                                        variant="outline"
                                                        onClick={cancelRegFieldEdit}
                                                        disabled={isSavingRegField}
                                                    >
                                                        ✕
                                                    </Button>
                                                </HStack>
                                            </HStack>

                                            <Stack gap={3}>
                                                <Box>
                                                    <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                        Field Label
                                                    </Text>
                                                    <Input
                                                        value={regFieldDraft.fieldLabel}
                                                        onChange={(e) => handleRegFieldDraftChange("fieldLabel", e.target.value)}
                                                    />
                                                </Box>
                                                <Box>
                                                    <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                        Field Description
                                                    </Text>
                                                    <Textarea
                                                        rows={2}
                                                        value={regFieldDraft.fieldDescription}
                                                        onChange={(e) => handleRegFieldDraftChange("fieldDescription", e.target.value)}
                                                    />
                                                </Box>
                                                <Box>
                                                    <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                        Datatype
                                                    </Text>
                                                    <select
                                                        value={regFieldDraft.dataType}
                                                        onChange={(e) => handleRegFieldDraftChange("dataType", e.target.value)}
                                                        style={selectStyle}
                                                    >
                                                        {DATA_TYPE_OPTIONS.map((type) => (
                                                            <option key={type} value={type}>
                                                                {type}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </Box>
                                                <Box>
                                                    <Text as="label" fontSize="sm" display="flex" alignItems="center" gap={2}>
                                                        <input
                                                            type="checkbox"
                                                            checked={regFieldDraft.required}
                                                            onChange={(e) => handleRegFieldDraftChange("required", e.target.checked)}
                                                        />
                                                        {regFieldDraft.required ? "Required" : "Flexible"}
                                                    </Text>
                                                </Box>
                                                {isOptionsType(regFieldDraft.dataType) && (
                                                    <Box>
                                                        <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                            Options (comma-separated)
                                                        </Text>
                                                        <Input
                                                            value={regFieldDraft.optionsRaw}
                                                            onChange={(e) => handleRegFieldDraftChange("optionsRaw", e.target.value)}
                                                        />
                                                    </Box>
                                                )}
                                            </Stack>
                                        </Stack>
                                    </Box>
                                )}
                            </Stack>
                        </Box>
                    )}

                    {eventData.eventType === "Merchandise Event" && (
                        <Box p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" boxShadow="sm">
                            <Stack gap={4}>
                                <HStack justify="space-between" align="center">
                                    <Heading size="md">Item List</Heading>
                                    {isDraftEvent && editingItemIndex === null && (
                                        <Button size="sm" colorPalette="teal" variant="outline" onClick={beginAddItem}>
                                            Add New Item
                                        </Button>
                                    )}
                                </HStack>

                                {itemSaveError && (
                                    <Text color="red.500" fontSize="sm">
                                        {itemSaveError}
                                    </Text>
                                )}

                                {Array.isArray(items) && items.length > 0 ? (
                                    <Stack gap={3}>
                                        {items.map((item, index) => (
                                            <Box key={`${item.itemName}-${index}`} border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                                                <Stack gap={3}>
                                                    <HStack justify="space-between" align="center">
                                                        <Text fontWeight="semibold">Item {index + 1}</Text>
                                                        {editingItemIndex === index ? (
                                                            <HStack gap={1}>
                                                                <Button
                                                                    size="xs"
                                                                    colorPalette="green"
                                                                    onClick={saveItemListChange}
                                                                    loading={isSavingItem}
                                                                >
                                                                    ✓
                                                                </Button>
                                                                <Button
                                                                    size="xs"
                                                                    colorPalette="red"
                                                                    variant="outline"
                                                                    onClick={cancelItemEdit}
                                                                    disabled={isSavingItem}
                                                                >
                                                                    ✕
                                                                </Button>
                                                            </HStack>
                                                        ) : (
                                                            <Button
                                                                size="xs"
                                                                variant="outline"
                                                                onClick={() => beginEditItem(index)}
                                                                disabled={editingItemIndex !== null || !isDraftEvent}
                                                            >
                                                                Edit
                                                            </Button>
                                                        )}
                                                    </HStack>

                                                    {editingItemIndex === index ? (
                                                        <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                                    Item Name
                                                                </Text>
                                                                <Input
                                                                    value={itemDraft.itemName}
                                                                    onChange={(e) => handleItemDraftChange("itemName", e.target.value)}
                                                                />
                                                            </Box>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                                    Cost
                                                                </Text>
                                                                <Input
                                                                    type="number"
                                                                    min="1"
                                                                    step="1"
                                                                    value={itemDraft.cost}
                                                                    onChange={(e) => handleItemDraftChange("cost", e.target.value)}
                                                                />
                                                            </Box>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                                    Stock Available
                                                                </Text>
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    step="1"
                                                                    value={itemDraft.stockAvailable}
                                                                    onChange={(e) => handleItemDraftChange("stockAvailable", e.target.value)}
                                                                />
                                                            </Box>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                                    Purchase Limit
                                                                </Text>
                                                                <Input
                                                                    type="number"
                                                                    min="1"
                                                                    step="1"
                                                                    value={itemDraft.purchaseLimitPerParticipant}
                                                                    onChange={(e) => handleItemDraftChange("purchaseLimitPerParticipant", e.target.value)}
                                                                />
                                                            </Box>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                                    Color Options
                                                                </Text>
                                                                <Input
                                                                    value={itemDraft.colorOptionsRaw}
                                                                    onChange={(e) => handleItemDraftChange("colorOptionsRaw", e.target.value)}
                                                                    placeholder="Red, Blue, Black"
                                                                />
                                                            </Box>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                                    Size Options
                                                                </Text>
                                                                <Input
                                                                    value={itemDraft.sizeOptionsRaw}
                                                                    onChange={(e) => handleItemDraftChange("sizeOptionsRaw", e.target.value)}
                                                                    placeholder="S, M, L, XL"
                                                                />
                                                            </Box>
                                                        </SimpleGrid>
                                                    ) : (
                                                        <SimpleGrid columns={{ base: 1, md: 2 }} gap={2}>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">Item Name</Text>
                                                                <Text fontSize="sm" color="gray.800" fontWeight="medium">{item.itemName || "N/A"}</Text>
                                                            </Box>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">Cost</Text>
                                                                <Text fontSize="sm" color="gray.800" fontWeight="medium">{item.cost ?? "N/A"}</Text>
                                                            </Box>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">Stock Available</Text>
                                                                <Text fontSize="sm" color="gray.800" fontWeight="medium">{item.stockAvailable ?? "N/A"}</Text>
                                                            </Box>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">Purchase Limit</Text>
                                                                <Text fontSize="sm" color="gray.800" fontWeight="medium">{item.purchaseLimitPerParticipant ?? "N/A"}</Text>
                                                            </Box>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">Purchased Quantity</Text>
                                                                <Text fontSize="sm" color="gray.800" fontWeight="medium">{item.purchasedQuantity ?? 0}</Text>
                                                            </Box>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">Color Options</Text>
                                                                <Text fontSize="sm" color="gray.800" fontWeight="medium">
                                                                    {Array.isArray(item.colorOptions) && item.colorOptions.length > 0 ? item.colorOptions.join(", ") : "N/A"}
                                                                </Text>
                                                            </Box>
                                                            <Box>
                                                                <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">Size Options</Text>
                                                                <Text fontSize="sm" color="gray.800" fontWeight="medium">
                                                                    {Array.isArray(item.sizeOptions) && item.sizeOptions.length > 0 ? item.sizeOptions.join(", ") : "N/A"}
                                                                </Text>
                                                            </Box>
                                                        </SimpleGrid>
                                                    )}
                                                </Stack>
                                            </Box>
                                        ))}
                                    </Stack>
                                ) : (
                                    <Text color="gray.600">No items have been added yet.</Text>
                                )}

                                {editingItemIndex === -1 && (
                                    <Box border="1px solid" borderColor="teal.200" borderRadius="md" p={3}>
                                        <Stack gap={3}>
                                            <HStack justify="space-between" align="center">
                                                <Text fontWeight="semibold">New Item</Text>
                                                <HStack gap={1}>
                                                    <Button
                                                        size="xs"
                                                        colorPalette="green"
                                                        onClick={saveItemListChange}
                                                        loading={isSavingItem}
                                                    >
                                                        ✓
                                                    </Button>
                                                    <Button
                                                        size="xs"
                                                        colorPalette="red"
                                                        variant="outline"
                                                        onClick={cancelItemEdit}
                                                        disabled={isSavingItem}
                                                    >
                                                        ✕
                                                    </Button>
                                                </HStack>
                                            </HStack>

                                            <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                                                <Box>
                                                    <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                        Item Name
                                                    </Text>
                                                    <Input
                                                        value={itemDraft.itemName}
                                                        onChange={(e) => handleItemDraftChange("itemName", e.target.value)}
                                                    />
                                                </Box>
                                                <Box>
                                                    <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                        Cost
                                                    </Text>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        value={itemDraft.cost}
                                                        onChange={(e) => handleItemDraftChange("cost", e.target.value)}
                                                    />
                                                </Box>
                                                <Box>
                                                    <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                        Stock Available
                                                    </Text>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={itemDraft.stockAvailable}
                                                        onChange={(e) => handleItemDraftChange("stockAvailable", e.target.value)}
                                                    />
                                                </Box>
                                                <Box>
                                                    <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                        Purchase Limit
                                                    </Text>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        value={itemDraft.purchaseLimitPerParticipant}
                                                        onChange={(e) => handleItemDraftChange("purchaseLimitPerParticipant", e.target.value)}
                                                    />
                                                </Box>
                                                <Box>
                                                    <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                        Color Options
                                                    </Text>
                                                    <Input
                                                        value={itemDraft.colorOptionsRaw}
                                                        onChange={(e) => handleItemDraftChange("colorOptionsRaw", e.target.value)}
                                                        placeholder="Red, Blue, Black"
                                                    />
                                                </Box>
                                                <Box>
                                                    <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
                                                        Size Options
                                                    </Text>
                                                    <Input
                                                        value={itemDraft.sizeOptionsRaw}
                                                        onChange={(e) => handleItemDraftChange("sizeOptionsRaw", e.target.value)}
                                                        placeholder="S, M, L, XL"
                                                    />
                                                </Box>
                                            </SimpleGrid>
                                        </Stack>
                                    </Box>
                                )}
                            </Stack>
                        </Box>
                    )}
                </Stack>
            </Box>
        </Flex>
    );
};

export default EventInfo;
