import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box,
    Button,
    Flex,
    Heading,
    Stack,
    Text,
} from "@chakra-ui/react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiCall } from "../utils/api.js";

const SelectInterests = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const [tags, setTags] = useState([]);
    const [selectedTagIds, setSelectedTagIds] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchTags = async () => {
            setIsLoading(true);
            setError("");
            try {
                const response = await apiCall("/tags");
                if (!response?.success) {
                    setError(response?.message || "Failed to fetch tags");
                    setTags([]);
                    return;
                }

                const list = Array.isArray(response.data) ? response.data : [];
                setTags(list);

                const existing = Array.isArray(user?.interests)
                    ? user.interests.map((id) => String(id))
                    : [];
                setSelectedTagIds(existing);
            } catch {
                setError("Something went wrong while fetching tags.");
                setTags([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTags();
    }, [user?.interests]);

    const toggleInterest = (tagId) => {
        setSelectedTagIds((prev) =>
            prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
        );
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError("");
        try {
            const response = await apiCall("/users/me/interests", "PUT", {
                interests: selectedTagIds,
            });

            if (!response?.success) {
                setError(response?.message || "Failed to update interests");
                return;
            }

            if (updateUser) {
                updateUser(response.data);
            }

            navigate("/participant/follow-organizations");
        } catch {
            setError("Something went wrong while updating interests.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="720px">
                <Heading size="lg" mb={6}>Select Interests</Heading>

                {isLoading ? (
                    <Text color="gray.600">Loading tags...</Text>
                ) : (
                    <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                        <Text fontSize="sm" color="gray.600">
                            Select zero or more tags you are interested in.
                        </Text>

                        {tags.length === 0 ? (
                            <Text fontSize="sm" color="gray.600">No tags available.</Text>
                        ) : (
                            <Stack gap={2}>
                                {tags.map((tag) => (
                                    <Text key={tag._id} as="label" fontSize="sm" display="flex" alignItems="center" gap={2}>
                                        <input
                                            type="checkbox"
                                            checked={selectedTagIds.includes(String(tag._id))}
                                            onChange={() => toggleInterest(String(tag._id))}
                                        />
                                        {tag.name}
                                    </Text>
                                ))}
                            </Stack>
                        )}

                        {error && <Text color="red.500" fontSize="sm">{error}</Text>}

                        <Button colorPalette="teal" onClick={handleSubmit} loading={isSubmitting}>
                            Save and Continue
                        </Button>
                    </Stack>
                )}
            </Box>
        </Flex>
    );
};

export default SelectInterests;
