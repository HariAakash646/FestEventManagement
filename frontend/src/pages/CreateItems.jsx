import { useState } from "react";
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
} from "@chakra-ui/react";
import { apiCall } from "../utils/api.js";

const CreateItems = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();

    const [items, setItems] = useState([
        {
            itemName: "",
            price: "",
            stockAvailable: "",
            purchaseLimitPerParticipant: "",
        },
    ]);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const addItem = () => {
        setItems((prev) => [
            ...prev,
            {
                itemName: "",
                price: "",
                stockAvailable: "",
                purchaseLimitPerParticipant: "",
            },
        ]);
    };

    const removeItem = (index) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const handleItemChange = (index, key, value) => {
        setItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, [key]: value } : item))
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newErrors = {};

        if (!eventId) {
            newErrors.submit = "Event ID missing.";
        }

        if (items.length === 0) {
            newErrors.submit = "At least one item is required.";
        }

        items.forEach((item, index) => {
            if (!item.itemName.trim()) {
                newErrors[`itemName-${index}`] = "Item name is required";
            }
            if (item.stockAvailable === "") {
                newErrors[`stockAvailable-${index}`] = "Stock is required";
            } else if (!Number.isInteger(Number(item.stockAvailable)) || Number(item.stockAvailable) < 0) {
                newErrors[`stockAvailable-${index}`] = "Stock must be an integer >= 0";
            }
            if (item.price === "") {
                newErrors[`price-${index}`] = "Cost is required";
            } else if (!Number.isInteger(Number(item.price)) || Number(item.price) < 1) {
                newErrors[`price-${index}`] = "Cost must be an integer >= 1";
            }
            if (item.purchaseLimitPerParticipant !== "") {
                if (
                    !Number.isInteger(Number(item.purchaseLimitPerParticipant)) ||
                    Number(item.purchaseLimitPerParticipant) < 1
                ) {
                    newErrors[`purchaseLimit-${index}`] = "Purchase limit must be an integer >= 1";
                }
            }
        });

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        const payloadItems = items.map((item) => ({
            itemName: item.itemName.trim(),
            cost: Number(item.price),
            stockAvailable: Number(item.stockAvailable),
            ...(item.purchaseLimitPerParticipant !== ""
                ? { purchaseLimitPerParticipant: Number(item.purchaseLimitPerParticipant) }
                : {}),
        }));

        setIsSubmitting(true);
        try {
            const data = await apiCall(`/items/bulk`, "POST", {
                eventId,
                items: payloadItems,
            });
            if (!data.success) {
                setErrors({ submit: data.message || "Failed to save items" });
                return;
            }
            navigate("/organizer");
        } catch (err) {
            setErrors({ submit: "Something went wrong. Please try again." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="720px">
                <Heading size="lg" mb={6}>Create Merchandise Items</Heading>

                <form onSubmit={handleSubmit}>
                    <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                        {items.map((item, index) => (
                            <Box key={index} border="1px solid" borderColor="gray.200" borderRadius="md" p={4}>
                                <HStack justify="space-between" mb={3}>
                                    <Text fontWeight="semibold">Item {index + 1}</Text>
                                    {items.length > 1 && (
                                        <Button
                                            size="xs"
                                            colorPalette="red"
                                            variant="outline"
                                            onClick={() => removeItem(index)}
                                        >
                                            Remove Item
                                        </Button>
                                    )}
                                </HStack>

                                <Stack gap={3}>
                                    <Box>
                                        <Text fontSize="sm" mb={1}>Item Name</Text>
                                        <Input
                                            value={item.itemName}
                                            onChange={(e) => handleItemChange(index, "itemName", e.target.value)}
                                        />
                                        {errors[`itemName-${index}`] && (
                                            <Text color="red.500" fontSize="xs" mt={1}>
                                                {errors[`itemName-${index}`]}
                                            </Text>
                                        )}
                                    </Box>

                                    <Box>
                                        <Text fontSize="sm" mb={1}>Price (INR)</Text>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={item.price}
                                            onChange={(e) => handleItemChange(index, "price", e.target.value)}
                                        />
                                        {errors[`price-${index}`] && (
                                            <Text color="red.500" fontSize="xs" mt={1}>
                                                {errors[`price-${index}`]}
                                            </Text>
                                        )}
                                    </Box>

                                    <Box>
                                        <Text fontSize="sm" mb={1}>Stock Available</Text>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={item.stockAvailable}
                                            onChange={(e) => handleItemChange(index, "stockAvailable", e.target.value)}
                                        />
                                        {errors[`stockAvailable-${index}`] && (
                                            <Text color="red.500" fontSize="xs" mt={1}>
                                                {errors[`stockAvailable-${index}`]}
                                            </Text>
                                        )}
                                    </Box>

                                    <Box>
                                        <Text fontSize="sm" mb={1}>Purchase Limit Per Participant (Optional)</Text>
                                        <Input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={item.purchaseLimitPerParticipant}
                                            onChange={(e) => handleItemChange(index, "purchaseLimitPerParticipant", e.target.value)}
                                        />
                                        {errors[`purchaseLimit-${index}`] && (
                                            <Text color="red.500" fontSize="xs" mt={1}>
                                                {errors[`purchaseLimit-${index}`]}
                                            </Text>
                                        )}
                                    </Box>
                                </Stack>
                            </Box>
                        ))}

                        <Button type="button" variant="outline" colorPalette="teal" onClick={addItem}>
                            Add Item
                        </Button>

                        {errors.submit && <Text color="red.500" fontSize="sm">{errors.submit}</Text>}

                        <Button type="submit" colorPalette="teal" loading={isSubmitting}>
                            Save Items
                        </Button>
                    </Stack>
                </form>
            </Box>
        </Flex>
    );
};

export default CreateItems;
