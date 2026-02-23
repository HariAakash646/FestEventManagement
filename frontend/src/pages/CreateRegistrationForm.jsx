import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Box,
    Button,
    Flex,
    Heading,
    HStack,
    Input,
    Stack,
    Text,
    Textarea,
} from "@chakra-ui/react";
import { apiCall } from "../utils/api.js";

const DATA_TYPE_OPTIONS = ["Text", "Number", "Boolean", "Date", "Email", "Phone", "Dropdown", "Checkbox", "File"];
const isOptionsType = (dataType) => dataType === "Dropdown" || dataType === "Checkbox";

const createEmptyField = () => ({
    fieldLabel: "",
    fieldDescription: "",
    dataType: "Text",
    required: false,
    optionsRaw: "",
});

const toDraftField = (field) => ({
    fieldLabel: field.fieldLabel || "",
    fieldDescription: field.fieldDescription || "",
    dataType: field.dataType || "Text",
    required: !!field.required,
    optionsRaw: Array.isArray(field.options) ? field.options.join(", ") : "",
});

const fromDraftField = (field) => ({
    fieldLabel: field.fieldLabel.trim(),
    fieldDescription: field.fieldDescription.trim(),
    dataType: field.dataType,
    required: field.required,
    options: isOptionsType(field.dataType)
        ? field.optionsRaw
            .split(",")
            .map((option) => option.trim())
            .filter(Boolean)
        : [],
});

const FormSectionBuilder = ({
    title,
    fields,
    setFields,
    errors,
    errorPrefix,
    isFormLocked,
}) => {
    const addField = () => {
        if (isFormLocked) return;
        setFields((prev) => [...prev, createEmptyField()]);
    };

    const removeField = (index) => {
        if (isFormLocked) return;
        setFields((prev) => prev.filter((_, i) => i !== index));
    };

    const handleFieldChange = (index, key, value) => {
        if (isFormLocked) return;
        setFields((prev) =>
            prev.map((field, i) => (i === index ? { ...field, [key]: value } : field))
        );
    };

    const moveField = (index, direction) => {
        if (isFormLocked) return;
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= fields.length) return;
        setFields((prev) => {
            const next = [...prev];
            [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
            return next;
        });
    };

    return (
        <Box border="1px solid" borderColor="gray.200" borderRadius="md" p={4}>
            <Stack gap={4}>
                <Heading size="sm">{title}</Heading>
                {fields.map((field, index) => (
                    <Box key={`${title}-${index}`} border="1px solid" borderColor="gray.200" borderRadius="md" p={4}>
                        <HStack justify="space-between" mb={3}>
                            <Text fontWeight="semibold">Field {index + 1}</Text>
                            {fields.length > 1 && (
                                <Button
                                    size="xs"
                                    colorPalette="red"
                                    variant="outline"
                                    onClick={() => removeField(index)}
                                    disabled={isFormLocked}
                                >
                                    Remove Field
                                </Button>
                            )}
                        </HStack>
                        <HStack mb={3}>
                            <Button
                                size="xs"
                                variant="outline"
                                onClick={() => moveField(index, "up")}
                                disabled={index === 0 || isFormLocked}
                            >
                                Move Up
                            </Button>
                            <Button
                                size="xs"
                                variant="outline"
                                onClick={() => moveField(index, "down")}
                                disabled={index === fields.length - 1 || isFormLocked}
                            >
                                Move Down
                            </Button>
                        </HStack>

                        <Stack gap={3}>
                            <Box>
                                <Text fontSize="sm" mb={1}>Field Label</Text>
                                <Input
                                    value={field.fieldLabel}
                                    onChange={(e) => handleFieldChange(index, "fieldLabel", e.target.value)}
                                    disabled={isFormLocked}
                                />
                                {errors[`${errorPrefix}-fieldLabel-${index}`] && (
                                    <Text color="red.500" fontSize="xs" mt={1}>
                                        {errors[`${errorPrefix}-fieldLabel-${index}`]}
                                    </Text>
                                )}
                            </Box>

                            <Box>
                                <Text fontSize="sm" mb={1}>Field Description</Text>
                                <Textarea
                                    rows={2}
                                    value={field.fieldDescription}
                                    onChange={(e) => handleFieldChange(index, "fieldDescription", e.target.value)}
                                    disabled={isFormLocked}
                                />
                            </Box>

                            <Box>
                                <Text fontSize="sm" mb={1}>Datatype</Text>
                                <select
                                    value={field.dataType}
                                    onChange={(e) => handleFieldChange(index, "dataType", e.target.value)}
                                    disabled={isFormLocked}
                                    style={{
                                        width: "100%",
                                        padding: "0.5rem",
                                        borderRadius: "0.375rem",
                                        border: "1px solid #E2E8F0",
                                        backgroundColor: "white",
                                    }}
                                >
                                    {DATA_TYPE_OPTIONS.map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                                {errors[`${errorPrefix}-dataType-${index}`] && (
                                    <Text color="red.500" fontSize="xs" mt={1}>
                                        {errors[`${errorPrefix}-dataType-${index}`]}
                                    </Text>
                                )}
                            </Box>

                            <Box>
                                <Text as="label" fontSize="sm" display="flex" alignItems="center" gap={2}>
                                    <input
                                        type="checkbox"
                                        checked={field.required}
                                        onChange={(e) => handleFieldChange(index, "required", e.target.checked)}
                                        disabled={isFormLocked}
                                    />
                                    {field.required ? "Required" : "Flexible"}
                                </Text>
                            </Box>

                            {isOptionsType(field.dataType) && (
                                <Box>
                                    <Text fontSize="sm" mb={1}>Options (comma-separated)</Text>
                                    <Input
                                        placeholder="Option 1, Option 2"
                                        value={field.optionsRaw}
                                        onChange={(e) => handleFieldChange(index, "optionsRaw", e.target.value)}
                                        disabled={isFormLocked}
                                    />
                                    {errors[`${errorPrefix}-optionsRaw-${index}`] && (
                                        <Text color="red.500" fontSize="xs" mt={1}>
                                            {errors[`${errorPrefix}-optionsRaw-${index}`]}
                                        </Text>
                                    )}
                                </Box>
                            )}
                        </Stack>
                    </Box>
                ))}

                <Button type="button" variant="outline" colorPalette="teal" onClick={addField} disabled={isFormLocked}>
                    Add Field
                </Button>
            </Stack>
        </Box>
    );
};

const CreateRegistrationForm = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();

    const [formTitle, setFormTitle] = useState("Registration Form");
    const [leaderFormTitle, setLeaderFormTitle] = useState("Team Leader Form");
    const [memberFormTitle, setMemberFormTitle] = useState("Team Member Form");
    const [fields, setFields] = useState([createEmptyField()]);
    const [leaderFields, setLeaderFields] = useState([createEmptyField()]);
    const [memberFields, setMemberFields] = useState([createEmptyField()]);
    const [errors, setErrors] = useState({});
    const [eventData, setEventData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchEvent = async () => {
            setIsLoading(true);
            try {
                const response = await apiCall("/events");
                if (!response?.success) {
                    setErrors({ submit: response?.message || "Failed to fetch event details." });
                    return;
                }

                const event = (response.data || []).find((item) => item._id === eventId);
                if (!event) {
                    setErrors({ submit: "Event not found." });
                    return;
                }

                setEventData(event);
                if (event.customForm) {
                    setFormTitle(event.customForm.formTitle || "Registration Form");
                    setLeaderFormTitle(event.customForm.leaderFormTitle || "Team Leader Form");
                    setMemberFormTitle(event.customForm.memberFormTitle || "Team Member Form");

                    const existingFields = Array.isArray(event.customForm.fields) ? event.customForm.fields : [];
                    if (existingFields.length > 0) {
                        setFields(existingFields.map(toDraftField));
                    }

                    const existingLeaderFields = Array.isArray(event.customForm.leaderFields) ? event.customForm.leaderFields : [];
                    if (existingLeaderFields.length > 0) {
                        setLeaderFields(existingLeaderFields.map(toDraftField));
                    }

                    const existingMemberFields = Array.isArray(event.customForm.memberFields) ? event.customForm.memberFields : [];
                    if (existingMemberFields.length > 0) {
                        setMemberFields(existingMemberFields.map(toDraftField));
                    }
                }
            } catch {
                setErrors({ submit: "Something went wrong while loading event data." });
            } finally {
                setIsLoading(false);
            }
        };

        fetchEvent();
    }, [eventId]);

    const isFormLocked = useMemo(() => {
        if (!eventData) return false;
        return Array.isArray(eventData.registeredFormList) && eventData.registeredFormList.length > 0;
    }, [eventData]);

    const isTeamEvent = !!eventData?.isTeamEvent;

    const validateFieldList = (list, prefix, nextErrors) => {
        list.forEach((field, index) => {
            if (!field.fieldLabel.trim()) {
                nextErrors[`${prefix}-fieldLabel-${index}`] = "Field label is required";
            }
            if (!field.dataType) {
                nextErrors[`${prefix}-dataType-${index}`] = "Datatype is required";
            }
            if (isOptionsType(field.dataType)) {
                const optionCount = field.optionsRaw
                    .split(",")
                    .map((option) => option.trim())
                    .filter(Boolean).length;
                if (optionCount < 2) {
                    nextErrors[`${prefix}-optionsRaw-${index}`] = "At least two options are required for this field type";
                }
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newErrors = {};

        if (!eventId) {
            newErrors.submit = "Event ID missing.";
        }
        if (isFormLocked) {
            newErrors.submit = "Registration form is locked after first registration.";
        }

        if (isTeamEvent) {
            if (!leaderFields.length) newErrors.submit = "Team leader form must have at least one field.";
            if (!memberFields.length) newErrors.submit = "Team member form must have at least one field.";
            validateFieldList(leaderFields, "leader", newErrors);
            validateFieldList(memberFields, "member", newErrors);
        } else {
            validateFieldList(fields, "single", newErrors);
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        const customForm = isTeamEvent
            ? {
                formTitle: formTitle.trim() || "Registration Form",
                leaderFormTitle: leaderFormTitle.trim() || "Team Leader Form",
                memberFormTitle: memberFormTitle.trim() || "Team Member Form",
                fields: [],
                leaderFields: leaderFields.map(fromDraftField),
                memberFields: memberFields.map(fromDraftField),
            }
            : {
                formTitle: formTitle.trim(),
                fields: fields.map(fromDraftField),
                leaderFields: [],
                memberFields: [],
            };

        setIsSubmitting(true);
        try {
            const data = await apiCall(`/events/${eventId}`, "PUT", { customForm });
            if (!data.success) {
                setErrors({ submit: data.message || "Failed to save registration form" });
                return;
            }

            navigate("/organizer");
        } catch {
            setErrors({ submit: "Something went wrong. Please try again." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="820px">
                <Heading size="lg" mb={6}>Create Registration Form</Heading>
                {isLoading && <Text color="gray.600" mb={4}>Loading event...</Text>}
                {!isLoading && isFormLocked && (
                    <Text color="orange.600" mb={4}>
                        This form is locked because at least one participant has already registered.
                    </Text>
                )}

                <form onSubmit={handleSubmit}>
                    <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                        <Box>
                            <Text fontSize="sm" mb={1}>Form Title</Text>
                            <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} disabled={isFormLocked} />
                        </Box>

                        {isTeamEvent ? (
                            <>
                                <Box>
                                    <Text fontSize="sm" mb={1}>Team Leader Form Title</Text>
                                    <Input
                                        value={leaderFormTitle}
                                        onChange={(e) => setLeaderFormTitle(e.target.value)}
                                        disabled={isFormLocked}
                                    />
                                </Box>
                                <FormSectionBuilder
                                    title="Team Leader Form Fields"
                                    fields={leaderFields}
                                    setFields={setLeaderFields}
                                    errors={errors}
                                    errorPrefix="leader"
                                    isFormLocked={isFormLocked}
                                />

                                <Box>
                                    <Text fontSize="sm" mb={1}>Team Member Form Title</Text>
                                    <Input
                                        value={memberFormTitle}
                                        onChange={(e) => setMemberFormTitle(e.target.value)}
                                        disabled={isFormLocked}
                                    />
                                </Box>
                                <FormSectionBuilder
                                    title="Team Member Form Fields"
                                    fields={memberFields}
                                    setFields={setMemberFields}
                                    errors={errors}
                                    errorPrefix="member"
                                    isFormLocked={isFormLocked}
                                />
                            </>
                        ) : (
                            <FormSectionBuilder
                                title="Registration Form Fields"
                                fields={fields}
                                setFields={setFields}
                                errors={errors}
                                errorPrefix="single"
                                isFormLocked={isFormLocked}
                            />
                        )}

                        {errors.submit && <Text color="red.500" fontSize="sm">{errors.submit}</Text>}

                        <Button type="submit" colorPalette="teal" loading={isSubmitting} disabled={isFormLocked}>
                            Save Registration Form
                        </Button>
                    </Stack>
                </form>
            </Box>
        </Flex>
    );
};

export default CreateRegistrationForm;
