import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useAuth } from "../context/AuthContext.jsx";
import { apiCall } from "../utils/api.js";

const CreateEvent = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [formData, setFormData] = useState({
        eventName: "",
        eventDescription: "",
        eventType: "Normal Event",
        isTeamEvent: false,
        minTeamSize: "",
        maxTeamSize: "",
        eligibility: "Open to all",
        registrationDeadline: "",
        registrationDeadlineTime: "",
        eventStartDate: "",
        eventStartDateTime: "",
        eventEndDate: "",
        eventEndDateTime: "",
        registrationLimit: "",
        registrationFee: "",
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [availableTags, setAvailableTags] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);
    const [newTagName, setNewTagName] = useState("");
    const [isCreatingTag, setIsCreatingTag] = useState(false);
    const [tagError, setTagError] = useState("");

    useEffect(() => {
        const fetchTags = async () => {
            try {
                const data = await apiCall("/tags");
                if (!data?.success) return;
                setAvailableTags(Array.isArray(data.data) ? data.data : []);
            } catch {
                // Keep page usable even if tag fetch fails.
            }
        };

        fetchTags();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const nextValue = type === "checkbox" ? checked : value;
        setFormData((prev) => ({
            ...prev,
            [name]: nextValue,
            ...(name === "isTeamEvent" && !checked
                ? { minTeamSize: "", maxTeamSize: "" }
                : {}),
        }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    const combineDateAndOptionalTime = (dateValue, timeValue) => {
        if (!dateValue) return "";
        return timeValue ? `${dateValue}T${timeValue}` : dateValue;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newErrors = {};

        if (!formData.eventName.trim()) newErrors.eventName = "Event Name is required";
        if (!formData.eventDescription.trim()) newErrors.eventDescription = "Event Description is required";
        if (!formData.eventType) newErrors.eventType = "Event Type is required";
        if (!formData.eventStartDate) newErrors.eventStartDate = "Event Start Date is required";
        if (!formData.eventEndDate) newErrors.eventEndDate = "Event End Date is required";
        if (!user?.organizerId) newErrors.submit = "Organizer is not logged in";
        if (formData.isTeamEvent) {
            const minTeam = Number(formData.minTeamSize);
            const maxTeam = Number(formData.maxTeamSize);
            if (!formData.minTeamSize || !Number.isInteger(minTeam) || minTeam < 1) {
                newErrors.minTeamSize = "Min team size must be a positive integer";
            }
            if (!formData.maxTeamSize || !Number.isInteger(maxTeam) || maxTeam < 1) {
                newErrors.maxTeamSize = "Max team size must be a positive integer";
            }
            if (
                Number.isInteger(minTeam) &&
                Number.isInteger(maxTeam) &&
                maxTeam < minTeam
            ) {
                newErrors.maxTeamSize = "Max team size must be greater than or equal to min team size";
            }
        }

        const startDateTime = combineDateAndOptionalTime(formData.eventStartDate, formData.eventStartDateTime);
        const endDateTime = combineDateAndOptionalTime(formData.eventEndDate, formData.eventEndDateTime);

        if (formData.eventStartDate && formData.eventEndDate) {
            const startDateOnly = new Date(`${formData.eventStartDate}T00:00:00`);
            const endDateOnly = new Date(`${formData.eventEndDate}T00:00:00`);
            if (endDateOnly < startDateOnly) {
                newErrors.eventEndDate = "Event End Date cannot be before Start Date";
            }
        }

        if (
            startDateTime &&
            endDateTime &&
            new Date(endDateTime) < new Date(startDateTime)
        ) {
            newErrors.eventEndDate = "Event End Date must be after Start Date";
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        const payload = {
            eventName: formData.eventName.trim(),
            eventDescription: formData.eventDescription.trim(),
            eventType: formData.eventType,
            eligibility: formData.eligibility.trim(),
            registrationDeadline: combineDateAndOptionalTime(formData.registrationDeadline, formData.registrationDeadlineTime),
            eventStartDate: startDateTime,
            eventEndDate: endDateTime,
            registrationLimit: formData.registrationLimit,
            registrationFee: formData.registrationFee,
            isTeamEvent: formData.isTeamEvent,
            minTeamSize: formData.isTeamEvent ? Number(formData.minTeamSize) : null,
            maxTeamSize: formData.isTeamEvent ? Number(formData.maxTeamSize) : null,
            organizerId: user.organizerId,
            eventTags: selectedTags,
        };

        setIsSubmitting(true);
        try {
            const data = await apiCall("/events", "POST", payload);
            if (!data.success) {
                setErrors({ submit: data.message || "Failed to create event" });
                return;
            }
            if (formData.eventType === "Normal Event" && data.data?._id) {
                navigate(`/organizer/events/${data.data._id}/registration-form`);
                return;
            }
            if (formData.eventType === "Merchandise Event" && data.data?._id) {
                navigate(`/organizer/events/${data.data._id}/items`);
                return;
            }
            navigate("/organizer");
        } catch (err) {
            setErrors({ submit: "Something went wrong. Please try again." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleTag = (tagName) => {
        setSelectedTags((prev) =>
            prev.includes(tagName)
                ? prev.filter((t) => t !== tagName)
                : [...prev, tagName]
        );
    };

    const handleCreateTag = async () => {
        setTagError("");
        const normalizedName = newTagName.trim();

        if (!normalizedName) {
            setTagError("Tag name is required.");
            return;
        }

        if (!user?.organizerId) {
            setTagError("Organizer is not logged in.");
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
            const data = await apiCall("/tags", "POST", {
                name: normalizedName,
                createdBy: user.organizerId,
            });

            if (!data?.success) {
                setTagError(data?.message || "Failed to create tag.");
                return;
            }

            setAvailableTags((prev) => [...prev, data.data]);
            setSelectedTags((prev) => [...prev, normalizedName]);
            setNewTagName("");
        } catch {
            setTagError("Something went wrong while creating tag.");
        } finally {
            setIsCreatingTag(false);
        }
    };

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="720px">
                <Heading size="lg" mb={6}>Create Event</Heading>

                <form onSubmit={handleSubmit}>
                    <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                        <Box>
                            <Text fontSize="sm" mb={1}>Event Name</Text>
                            <Input name="eventName" value={formData.eventName} onChange={handleChange} />
                            {errors.eventName && <Text color="red.500" fontSize="xs" mt={1}>{errors.eventName}</Text>}
                        </Box>

                        <Box>
                            <Text fontSize="sm" mb={1}>Event Description</Text>
                            <Textarea name="eventDescription" value={formData.eventDescription} onChange={handleChange} rows={4} />
                            {errors.eventDescription && <Text color="red.500" fontSize="xs" mt={1}>{errors.eventDescription}</Text>}
                        </Box>

                        <Box>
                            <Text fontSize="sm" mb={1}>Event Type</Text>
                            <select
                                name="eventType"
                                value={formData.eventType}
                                onChange={handleChange}
                                style={{
                                    width: "100%",
                                    padding: "0.5rem",
                                    borderRadius: "0.375rem",
                                    border: "1px solid #E2E8F0",
                                    backgroundColor: "white",
                                }}
                            >
                                <option value="Normal Event">Normal Event</option>
                                <option value="Merchandise Event">Merchandise Event</option>
                            </select>
                            {errors.eventType && <Text color="red.500" fontSize="xs" mt={1}>{errors.eventType}</Text>}
                        </Box>

                        <Box>
                            <Text fontSize="sm" mb={1}>Eligibility</Text>
                            <select
                                name="eligibility"
                                value={formData.eligibility}
                                onChange={handleChange}
                                style={{
                                    width: "100%",
                                    padding: "0.5rem",
                                    borderRadius: "0.375rem",
                                    border: "1px solid #E2E8F0",
                                    backgroundColor: "white",
                                }}
                            >
                                <option value="Must be a IIIT Student">Must be a IIIT Student</option>
                                <option value="Open to all">Open to all</option>
                            </select>
                            {errors.eligibility && <Text color="red.500" fontSize="xs" mt={1}>{errors.eligibility}</Text>}
                        </Box>

                        <Box>
                            <Text as="label" display="flex" alignItems="center" gap={2} fontSize="sm">
                                <input
                                    type="checkbox"
                                    name="isTeamEvent"
                                    checked={formData.isTeamEvent}
                                    onChange={handleChange}
                                />
                                Team Event
                            </Text>
                        </Box>

                        {formData.isTeamEvent && (
                            <>
                                <Box>
                                    <Text fontSize="sm" mb={1}>Min Team Size</Text>
                                    <Input
                                        type="number"
                                        min="1"
                                        step="1"
                                        name="minTeamSize"
                                        value={formData.minTeamSize}
                                        onChange={handleChange}
                                    />
                                    {errors.minTeamSize && <Text color="red.500" fontSize="xs" mt={1}>{errors.minTeamSize}</Text>}
                                </Box>

                                <Box>
                                    <Text fontSize="sm" mb={1}>Max Team Size</Text>
                                    <Input
                                        type="number"
                                        min="1"
                                        step="1"
                                        name="maxTeamSize"
                                        value={formData.maxTeamSize}
                                        onChange={handleChange}
                                    />
                                    {errors.maxTeamSize && <Text color="red.500" fontSize="xs" mt={1}>{errors.maxTeamSize}</Text>}
                                </Box>
                            </>
                        )}

                        <Box>
                            <Text fontSize="sm" mb={1}>Registration Deadline</Text>
                            <HStack gap={2}>
                                <Input type="date" name="registrationDeadline" value={formData.registrationDeadline} onChange={handleChange} />
                                <Input type="time" name="registrationDeadlineTime" value={formData.registrationDeadlineTime} onChange={handleChange} />
                            </HStack>
                            <Text fontSize="xs" color="gray.500" mt={1}>Time is optional.</Text>
                            {errors.registrationDeadline && <Text color="red.500" fontSize="xs" mt={1}>{errors.registrationDeadline}</Text>}
                        </Box>

                        <Box>
                            <Text fontSize="sm" mb={1}>Event Start Date</Text>
                            <HStack gap={2}>
                                <Input type="date" name="eventStartDate" value={formData.eventStartDate} onChange={handleChange} />
                                <Input type="time" name="eventStartDateTime" value={formData.eventStartDateTime} onChange={handleChange} />
                            </HStack>
                            <Text fontSize="xs" color="gray.500" mt={1}>Time is optional.</Text>
                            {errors.eventStartDate && <Text color="red.500" fontSize="xs" mt={1}>{errors.eventStartDate}</Text>}
                        </Box>

                        <Box>
                            <Text fontSize="sm" mb={1}>Event End Date</Text>
                            <HStack gap={2}>
                                <Input type="date" name="eventEndDate" value={formData.eventEndDate} onChange={handleChange} />
                                <Input type="time" name="eventEndDateTime" value={formData.eventEndDateTime} onChange={handleChange} />
                            </HStack>
                            <Text fontSize="xs" color="gray.500" mt={1}>Time is optional.</Text>
                            {errors.eventEndDate && <Text color="red.500" fontSize="xs" mt={1}>{errors.eventEndDate}</Text>}
                        </Box>

                        <Box>
                            <Text fontSize="sm" mb={1}>Registration Limit</Text>
                            <Input type="number" min="1" step="1" name="registrationLimit" value={formData.registrationLimit} onChange={handleChange} />
                            {errors.registrationLimit && <Text color="red.500" fontSize="xs" mt={1}>{errors.registrationLimit}</Text>}
                        </Box>

                        <Box>
                            <Text fontSize="sm" mb={1}>Registration Fee</Text>
                            <Input type="number" min="0" step="0.01" name="registrationFee" value={formData.registrationFee} onChange={handleChange} />
                            {errors.registrationFee && <Text color="red.500" fontSize="xs" mt={1}>{errors.registrationFee}</Text>}
                        </Box>

                        <Box>
                            <Text fontSize="sm" mb={2}>Event Tags (Optional)</Text>
                            <Stack gap={2}>
                                {availableTags.length === 0 && (
                                    <Text fontSize="xs" color="gray.500">No tags available yet.</Text>
                                )}
                                {availableTags.map((tag) => (
                                    <Text as="label" key={tag._id || tag.name} display="flex" alignItems="center" gap={2} fontSize="sm">
                                        <input
                                            type="checkbox"
                                            checked={selectedTags.includes(tag.name)}
                                            onChange={() => toggleTag(tag.name)}
                                        />
                                        {tag.name}
                                    </Text>
                                ))}
                            </Stack>

                            <Text fontSize="sm" mt={3} mb={1}>Create New Tag</Text>
                            <Stack direction={{ base: "column", sm: "row" }} gap={2}>
                                <Input
                                    placeholder="Enter new tag name"
                                    value={newTagName}
                                    onChange={(e) => {
                                        setNewTagName(e.target.value);
                                        setTagError("");
                                    }}
                                />
                                <Button type="button" variant="outline" colorPalette="teal" onClick={handleCreateTag} loading={isCreatingTag}>
                                    Add Tag
                                </Button>
                            </Stack>
                            {tagError && <Text color="red.500" fontSize="xs" mt={1}>{tagError}</Text>}
                        </Box>

                        {errors.submit && <Text color="red.500" fontSize="sm">{errors.submit}</Text>}

                        <Button type="submit" colorPalette="teal" loading={isSubmitting}>
                            Create Event Draft
                        </Button>
                    </Stack>
                </form>
            </Box>
        </Flex>
    );
};

export default CreateEvent;
