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
import { useAuth } from "../context/AuthContext.jsx";
import { apiCall } from "../utils/api.js";

const selectStyle = {
    width: "100%",
    padding: "0.5rem",
    borderRadius: "0.375rem",
    border: "1px solid #E2E8F0",
    backgroundColor: "white",
};

const isOptionsType = (dataType) => dataType === "Dropdown" || dataType === "Checkbox";

const RegisterEvent = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [formValues, setFormValues] = useState({});
    const [teamSize, setTeamSize] = useState("");
    const [formErrors, setFormErrors] = useState({});
    const [submitError, setSubmitError] = useState("");
    const [submitSuccess, setSubmitSuccess] = useState("");
    const [teamJoinLink, setTeamJoinLink] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchEvent = async () => {
            setIsLoading(true);
            setError("");
            try {
                const response = await apiCall("/events");
                if (!response?.success) {
                    setError(response?.message || "Failed to fetch event details");
                    setEvents([]);
                    return;
                }
                setEvents(Array.isArray(response.data) ? response.data : []);
            } catch {
                setError("Something went wrong while fetching event details.");
                setEvents([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEvent();
    }, []);

    const event = useMemo(() => {
        const found = events.find((item) => item._id === eventId);
        if (!found) return null;
        if (found.status !== "Published" && found.status !== "Ongoing") return null;
        return found;
    }, [events, eventId]);

    const isTeamEvent = !!event?.isTeamEvent;
    const fields = useMemo(() => {
        if (!event) return [];
        if (isTeamEvent) {
            return Array.isArray(event.customForm?.leaderFields) ? event.customForm.leaderFields : [];
        }
        return Array.isArray(event.customForm?.fields) ? event.customForm.fields : [];
    }, [event, isTeamEvent]);

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

    const alreadyRegistered = useMemo(() => {
        if (!event || !user?._id) return false;
        return Array.isArray(event.registeredFormList)
            ? event.registeredFormList.some((entry) => String(entry.participantId) === String(user._id))
            : false;
    }, [event, user?._id]);

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
                <select
                    value={value ?? ""}
                    onChange={(e) => handleValueChange(key, e.target.value)}
                    style={selectStyle}
                >
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
                        <input
                            type="checkbox"
                            checked={value === true}
                            onChange={(e) => handleValueChange(key, e.target.checked)}
                        />
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
                    <input
                        type="checkbox"
                        checked={value === true}
                        onChange={(e) => handleValueChange(key, e.target.checked)}
                    />
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
                        reader.onerror = () => {
                            handleValueChange(key, null);
                        };
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
        setTeamJoinLink("");

        if (!event) {
            setSubmitError("Event is not available for registration.");
            return;
        }
        if (alreadyRegistered) {
            setSubmitError("You are already registered for this event.");
            return;
        }
        if (hasPendingRegistrationApproval) {
            setSubmitError("Your registration request is pending organizer approval.");
            return;
        }
        if (event.registrationOpen === false) {
            setSubmitError("Registration is currently closed by the organizer.");
            return;
        }

        const errors = {};
        fields.forEach((field, index) => {
            if (!field.required) return;
            const value = formValues[String(index)];
            if (isRequiredFieldEmpty(field, value)) {
                errors[String(index)] = "This field is required.";
            }
        });

        if (isTeamEvent) {
            const minTeamSize = Number.isInteger(event.minTeamSize) ? event.minTeamSize : 1;
            const maxTeamSize = Number.isInteger(event.maxTeamSize) ? event.maxTeamSize : minTeamSize;
            const parsedTeamSize = Number(teamSize);
            if (!Number.isInteger(parsedTeamSize) || parsedTeamSize < minTeamSize || parsedTeamSize > maxTeamSize) {
                errors.teamSize = `Team size must be between ${minTeamSize} and ${maxTeamSize}.`;
            }
        }

        setFormErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setIsSubmitting(true);
        try {
            if (isTeamEvent) {
                const response = await apiCall(`/events/${eventId}/team-registration`, "POST", {
                    formResponses: formValues,
                    targetTeamSize: Number(teamSize),
                });
                if (!response?.success) {
                    setSubmitError(response?.message || "Team leader registration failed.");
                    return;
                }

                setSubmitSuccess("Team registration is pending. Share the join link with your team.");
                setTeamJoinLink(response?.data?.teamJoinLink || "");
                if (response?.data?.requiresPayment) {
                    navigate(`/participant/events/${eventId}/team/${response?.data?.teamJoinCode || ""}/payment`, {
                        state: {
                            paymentAmount: response?.data?.paymentAmount || event.registrationFee || 0,
                            eventName: event.eventName,
                            teamJoinLink: response?.data?.teamJoinLink || "",
                            role: "leader",
                        },
                    });
                }
                return;
            }

            const hasRegistrationFee = typeof event.registrationFee === "number" && event.registrationFee > 0;
            if (hasRegistrationFee) {
                navigate(`/participant/registerEvent/${eventId}/payment`, {
                    state: {
                        paymentAmount: event.registrationFee,
                        formResponses: formValues,
                        eventName: event.eventName,
                    },
                });
                return;
            }

            const response = await apiCall(`/events/${eventId}/register`, "PUT", { formResponses: formValues });
            if (!response?.success) {
                setSubmitError(response?.message || "Registration failed.");
                return;
            }

            setSubmitSuccess("Registration successful.");
            setTimeout(() => navigate(`/participant/events/${eventId}`), 800);
        } catch {
            setSubmitError("Something went wrong while registering.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="720px">
                    <Text color="gray.600">Loading registration form...</Text>
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

    if (!event) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="720px">
                    <Text color="gray.600">Event not available for registration.</Text>
                </Box>
            </Flex>
        );
    }

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="720px">
                <Heading size="lg" mb={2}>Register: {event.eventName}</Heading>
                <Text color="gray.600" mb={6}>
                    {isTeamEvent
                        ? (event.customForm?.leaderFormTitle || "Team Leader Form")
                        : (event.customForm?.formTitle || "Registration Form")}
                </Text>
                {!isTeamEvent && typeof event.registrationFee === "number" && event.registrationFee > 0 && (
                    <Text color="orange.700" mb={4} fontWeight="semibold">
                        Registration Cost: Rs. {event.registrationFee}
                    </Text>
                )}

                <form onSubmit={handleSubmit}>
                    <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                        {isTeamEvent && (
                            <Box>
                                <Text fontSize="sm" mb={1}>Team Size</Text>
                                <Input
                                    type="number"
                                    min={Number.isInteger(event.minTeamSize) ? event.minTeamSize : 1}
                                    max={Number.isInteger(event.maxTeamSize) ? event.maxTeamSize : undefined}
                                    value={teamSize}
                                    onChange={(e) => {
                                        setTeamSize(e.target.value);
                                        if (formErrors.teamSize) {
                                            setFormErrors((prev) => ({ ...prev, teamSize: "" }));
                                        }
                                    }}
                                />
                                <Text fontSize="xs" color="gray.500" mt={1}>
                                    Allowed: {event.minTeamSize || 1} to {event.maxTeamSize || event.minTeamSize || 1}
                                </Text>
                                {formErrors.teamSize && (
                                    <Text color="red.500" fontSize="xs" mt={1}>
                                        {formErrors.teamSize}
                                    </Text>
                                )}
                            </Box>
                        )}

                        {fields.map((field, index) => (
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

                        {teamJoinLink && (
                            <Box border="1px solid" borderColor="teal.200" borderRadius="md" p={3} bg="teal.50">
                                <Text fontSize="sm" fontWeight="semibold" color="teal.800" mb={1}>
                                    Team Join Link
                                </Text>
                                <Text fontSize="xs" color="teal.900" wordBreak="break-all">
                                    {teamJoinLink}
                                </Text>
                            </Box>
                        )}

                        {submitError && <Text color="red.500" fontSize="sm">{submitError}</Text>}
                        {submitSuccess && <Text color="green.600" fontSize="sm">{submitSuccess}</Text>}

                        <Button
                            type="submit"
                            colorPalette="teal"
                            loading={isSubmitting}
                            disabled={alreadyRegistered || hasPendingRegistrationApproval}
                        >
                            {alreadyRegistered
                                ? "Already Registered"
                                : hasPendingRegistrationApproval
                                    ? "Pending Approval"
                                    : isTeamEvent
                                        ? "Register as Team Leader"
                                        : (typeof event.registrationFee === "number" && event.registrationFee > 0
                                            ? "Make Payment"
                                            : "Complete Registration")}
                        </Button>
                    </Stack>
                </form>
            </Box>
        </Flex>
    );
};

export default RegisterEvent;
