import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Box,
    Button,
    Flex,
    Heading,
    Input,
    Stack,
    Text,
    Textarea,
} from "@chakra-ui/react";
import { apiCall } from "../utils/api.js";

const selectStyle = {
    width: "100%",
    padding: "0.5rem",
    borderRadius: "0.375rem",
    border: "1px solid #E2E8F0",
    backgroundColor: "white",
};

const isOptionsType = (dataType) => dataType === "Dropdown" || dataType === "Checkbox";

const JoinTeamEvent = () => {
    const { eventId, teamCode } = useParams();
    const navigate = useNavigate();

    const [event, setEvent] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [formValues, setFormValues] = useState({});
    const [formErrors, setFormErrors] = useState({});
    const [submitError, setSubmitError] = useState("");
    const [submitSuccess, setSubmitSuccess] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchEvent = async () => {
            setIsLoading(true);
            setError("");
            try {
                const response = await apiCall(`/events/${eventId}`);
                if (!response?.success) {
                    setError(response?.message || "Failed to fetch event details");
                    setEvent(null);
                    return;
                }
                setEvent(response?.data?.event || null);
            } catch {
                setError("Something went wrong while fetching event details.");
                setEvent(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEvent();
    }, [eventId]);

    const isJoinableTeamEvent = useMemo(() => {
        if (!event) return false;
        if (event.status !== "Published" && event.status !== "Ongoing") return false;
        return event.isTeamEvent === true;
    }, [event]);

    const memberFields = useMemo(
        () => (Array.isArray(event?.customForm?.memberFields) ? event.customForm.memberFields : []),
        [event]
    );

    const handleValueChange = (key, value) => {
        setFormValues((prev) => ({ ...prev, [key]: value }));
        if (formErrors[key]) {
            setFormErrors((prev) => ({ ...prev, [key]: "" }));
        }
    };

    const renderFieldInput = (field, index) => {
        const key = String(index);
        const value = formValues[key];
        const options = Array.isArray(field.options) ? field.options : [];

        if (
            (field.dataType === "Dropdown" && options.length > 0) ||
            (options.length > 0 && field.dataType !== "Checkbox" && field.dataType !== "File")
        ) {
            return (
                <select value={value ?? ""} onChange={(e) => handleValueChange(key, e.target.value)} style={selectStyle}>
                    <option value="">Select an option</option>
                    {options.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            );
        }

        if (field.dataType === "Checkbox") {
            const selectedValues = Array.isArray(value) ? value : [];
            if (options.length === 0) {
                return (
                    <Text as="label" fontSize="sm" display="flex" alignItems="center" gap={2}>
                        <input type="checkbox" checked={value === true} onChange={(e) => handleValueChange(key, e.target.checked)} />
                        Yes
                    </Text>
                );
            }
            return (
                <Stack gap={2}>
                    {options.map((option) => (
                        <Text key={option} as="label" fontSize="sm" display="flex" alignItems="center" gap={2}>
                            <input
                                type="checkbox"
                                checked={selectedValues.includes(option)}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        handleValueChange(key, [...selectedValues, option]);
                                    } else {
                                        handleValueChange(key, selectedValues.filter((item) => item !== option));
                                    }
                                }}
                            />
                            {option}
                        </Text>
                    ))}
                </Stack>
            );
        }

        if (field.dataType === "Boolean") {
            return (
                <Text as="label" fontSize="sm" display="flex" alignItems="center" gap={2}>
                    <input type="checkbox" checked={value === true} onChange={(e) => handleValueChange(key, e.target.checked)} />
                    Yes
                </Text>
            );
        }

        if (field.dataType === "Date") {
            return <Input type="date" value={value ?? ""} onChange={(e) => handleValueChange(key, e.target.value)} />;
        }
        if (field.dataType === "Number") {
            return <Input type="number" value={value ?? ""} onChange={(e) => handleValueChange(key, e.target.value)} />;
        }
        if (field.dataType === "Email") {
            return <Input type="email" value={value ?? ""} onChange={(e) => handleValueChange(key, e.target.value)} />;
        }
        if (field.dataType === "Phone") {
            return <Input type="tel" value={value ?? ""} onChange={(e) => handleValueChange(key, e.target.value)} />;
        }
        if (field.dataType === "File") {
            return (
                <Input
                    type="file"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) {
                            handleValueChange(key, null);
                            return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                            handleValueChange(key, {
                                name: file.name,
                                type: file.type,
                                size: file.size,
                                contentBase64: typeof reader.result === "string" ? reader.result : "",
                            });
                        };
                        reader.onerror = () => handleValueChange(key, null);
                        reader.readAsDataURL(file);
                    }}
                />
            );
        }

        return <Textarea rows={2} value={value ?? ""} onChange={(e) => handleValueChange(key, e.target.value)} />;
    };

    const isRequiredFieldEmpty = (field, value) =>
        value === undefined ||
        value === null ||
        value === "" ||
        (typeof value === "string" && !value.trim()) ||
        (Array.isArray(value) && value.length === 0) ||
        (field.dataType === "File" && (!value || typeof value !== "object" || !value.name)) ||
        (field.dataType === "Checkbox" && isOptionsType(field.dataType) && Array.isArray(field.options) && field.options.length > 0 && (!Array.isArray(value) || value.length === 0));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError("");
        setSubmitSuccess("");

        if (!event || !isJoinableTeamEvent) {
            setSubmitError("Event is not available for team joining.");
            return;
        }

        const errors = {};
        memberFields.forEach((field, index) => {
            if (!field.required) return;
            const value = formValues[String(index)];
            if (isRequiredFieldEmpty(field, value)) {
                errors[String(index)] = "This field is required.";
            }
        });
        setFormErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setIsSubmitting(true);
        try {
            const response = await apiCall(`/events/${eventId}/team-registration/${teamCode}/join`, "POST", {
                formResponses: formValues,
            });
            if (!response?.success) {
                setSubmitError(response?.message || "Failed to join team.");
                return;
            }
            setSubmitSuccess(response?.message || "Joined team successfully.");
            if (response?.data?.requiresPayment) {
                navigate(`/participant/events/${eventId}/team/${teamCode}/payment`, {
                    state: {
                        paymentAmount: response?.data?.paymentAmount || event.registrationFee || 0,
                        eventName: event.eventName,
                        role: "member",
                    },
                });
                return;
            }
            setTimeout(() => navigate(`/participant/events/${eventId}`), 1200);
        } catch {
            setSubmitError("Something went wrong while joining team.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="720px">
                    <Text color="gray.600">Loading team join form...</Text>
                </Box>
            </Flex>
        );
    }

    if (error) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="720px">
                    <Text color="red.500">{error}</Text>
                </Box>
            </Flex>
        );
    }

    if (!event || !isJoinableTeamEvent) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="720px">
                    <Text color="gray.600">Team join link is not valid for an active team event.</Text>
                </Box>
            </Flex>
        );
    }

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="720px">
                <Heading size="lg" mb={2}>Join Team: {event.eventName}</Heading>
                <Text color="gray.600" mb={6}>
                    {event.customForm?.memberFormTitle || "Team Member Form"}
                </Text>

                <form onSubmit={handleSubmit}>
                    <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                        {memberFields.map((field, index) => (
                            <Box key={`${field.fieldLabel || "field"}-${index}`}>
                                <Text fontSize="sm" mb={1}>
                                    {field.fieldLabel}
                                    {field.required ? " *" : ""}
                                </Text>
                                {field.fieldDescription && (
                                    <Text fontSize="xs" color="gray.500" mb={1}>
                                        {field.fieldDescription}
                                    </Text>
                                )}
                                {renderFieldInput(field, index)}
                                {formErrors[String(index)] && (
                                    <Text color="red.500" fontSize="xs" mt={1}>
                                        {formErrors[String(index)]}
                                    </Text>
                                )}
                            </Box>
                        ))}

                        {submitError && <Text color="red.500" fontSize="sm">{submitError}</Text>}
                        {submitSuccess && <Text color="green.600" fontSize="sm">{submitSuccess}</Text>}

                        <Button type="submit" colorPalette="teal" loading={isSubmitting}>
                            Join Team
                        </Button>
                    </Stack>
                </form>
            </Box>
        </Flex>
    );
};

export default JoinTeamEvent;
