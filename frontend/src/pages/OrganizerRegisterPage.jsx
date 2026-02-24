import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box,
    Flex,
    Heading,
    Input,
    Button,
    Stack,
    HStack,
    Link,
    Text,
    Textarea,
} from "@chakra-ui/react";
import { FaUserAlt, FaBuilding, FaAlignLeft, FaTag } from "react-icons/fa";
import { apiCall } from "../utils/api.js";

const CATEGORY_OPTIONS = ["Clubs", "Councils", "Fest Teams"];
const ORGANIZER_NAME_REGEX = /^[A-Za-z0-9 ]+$/;

const toGeneratedEmail = (organizerName) => {
    const normalized = String(organizerName || "").trim().replace(/\s+/g, " ");
    if (!normalized || !ORGANIZER_NAME_REGEX.test(normalized)) return "";
    return `${normalized.toLowerCase().replace(/ /g, ".")}@iiit.ac.in`;
};

const OrganizerRegisterPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        organizerName: "",
        organizerId: "",
        category: "",
        description: "",
    });
    const [errors, setErrors] = useState({});
    const [generatedCredentials, setGeneratedCredentials] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newErrors = {};

        if (!formData.organizerName.trim()) newErrors.organizerName = "Organizer Name is a compulsory field";
        if (
            formData.organizerName.trim() &&
            !ORGANIZER_NAME_REGEX.test(formData.organizerName.trim().replace(/\s+/g, " "))
        ) {
            newErrors.organizerName = "Organizer Name can only contain letters, numbers, and spaces";
        }
        if (!formData.organizerId.toString().trim()) newErrors.organizerId = "Organizer ID is a compulsory field";
        if (formData.organizerId.toString().trim() && !Number.isInteger(Number(formData.organizerId))) {
            newErrors.organizerId = "Organizer ID must be an integer";
        }
        if (!formData.category) newErrors.category = "Category is a compulsory field";
        if (!formData.description.trim()) newErrors.description = "Description is a compulsory field";

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        const payload = {
            role: "Organizer",
            organizerName: formData.organizerName.trim().replace(/\s+/g, " "),
            organizerId: Number(formData.organizerId),
            category: formData.category,
            description: formData.description.trim(),
        };

        try {
            const data = await apiCall("/users/admin/organizers", "POST", payload);
            if (data.success) {
                setGeneratedCredentials(data.generatedCredentials || null);
                setErrors({});
                setFormData({
                    organizerName: "",
                    organizerId: "",
                    category: "",
                    description: "",
                });
            } else {
                setErrors({ submit: data.message || "Registration failed" });
            }
        } catch (err) {
            setErrors({ submit: "Something went wrong. Please try again." });
        }
    };

    const RequiredStar = () => <Text as="span" color="red.500" ms="1">*</Text>;

    return (
        <Flex
            flexDirection="column"
            width="100vw"
            height="100vh"
            bg="gray.200"
            justifyContent="center"
            alignItems="center"
        >
            <Stack
                direction="column"
                mb="2"
                justifyContent="center"
                alignItems="center"
            >
                <Box
                    w="12"
                    h="12"
                    borderRadius="full"
                    bg="teal.500"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                >
                    <FaBuilding color="white" size="20" />
                </Box>
                <Heading color="teal.400">Organizer Registration</Heading>
                <Box minW={{ base: "90%", md: "468px" }}>
                    <form onSubmit={handleSubmit}>
                        <Stack
                            gap={4}
                            p="1rem"
                            bg="whiteAlpha.900"
                            boxShadow="md"
                        >
                            <Box>
                                <Text fontSize="xs" color="gray.600" mb="1">Organizer Name<RequiredStar /></Text>
                                <Box position="relative">
                                    <Box
                                        position="absolute"
                                        left="0"
                                        top="0"
                                        bottom="0"
                                        display="flex"
                                        alignItems="center"
                                        ps="3"
                                        zIndex="1"
                                        pointerEvents="none"
                                        color="gray.300"
                                    >
                                        <FaUserAlt />
                                    </Box>
                                    <Input type="text" name="organizerName" placeholder="Organizer Name" ps="10" value={formData.organizerName} onChange={handleChange} />
                                </Box>
                                {errors.organizerName && <Text color="red.500" fontSize="xs" mt="1">{errors.organizerName}</Text>}
                            </Box>
                            <Box>
                                <Text fontSize="xs" color="gray.600" mb="1">Organizer ID<RequiredStar /></Text>
                                <Box position="relative">
                                    <Box
                                        position="absolute"
                                        left="0"
                                        top="0"
                                        bottom="0"
                                        display="flex"
                                        alignItems="center"
                                        ps="3"
                                        zIndex="1"
                                        pointerEvents="none"
                                        color="gray.300"
                                    >
                                        <FaUserAlt />
                                    </Box>
                                    <Input
                                        type="number"
                                        step="1"
                                        name="organizerId"
                                        placeholder="Organizer ID"
                                        ps="10"
                                        value={formData.organizerId}
                                        onChange={handleChange}
                                    />
                                </Box>
                                {errors.organizerId && <Text color="red.500" fontSize="xs" mt="1">{errors.organizerId}</Text>}
                            </Box>
                            <Box>
                                <Text fontSize="xs" color="gray.600" mb="1">Generated Organizer Email</Text>
                                <Input
                                    value={toGeneratedEmail(formData.organizerName) || "Will be auto-generated after valid organizer name"}
                                    disabled
                                />
                                <Text fontSize="xs" color="gray.500" mt="1">
                                    Format: organizer.name@iiit.ac.in (spaces become dots)
                                </Text>
                            </Box>
                            <Box>
                                <Text fontSize="xs" color="gray.600" mb="1">Category<RequiredStar /></Text>
                                <Box position="relative">
                                    <Box
                                        position="absolute"
                                        left="0"
                                        top="0"
                                        bottom="0"
                                        display="flex"
                                        alignItems="center"
                                        ps="3"
                                        zIndex="1"
                                        pointerEvents="none"
                                        color="gray.300"
                                    >
                                        <FaTag />
                                    </Box>
                                    <select
                                        name="category"
                                        value={formData.category}
                                        onChange={handleChange}
                                        style={{
                                            width: "100%",
                                            paddingLeft: "2.5rem",
                                            paddingRight: "1rem",
                                            paddingTop: "0.5rem",
                                            paddingBottom: "0.5rem",
                                            borderRadius: "0.375rem",
                                            border: "1px solid #E2E8F0",
                                            fontSize: "1rem",
                                            outline: "none",
                                            backgroundColor: "white",
                                        }}
                                    >
                                        <option value="">Select Category</option>
                                        {CATEGORY_OPTIONS.map((cat) => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </Box>
                                {errors.category && <Text color="red.500" fontSize="xs" mt="1">{errors.category}</Text>}
                            </Box>
                            <Box>
                                <Text fontSize="xs" color="gray.600" mb="1">Description<RequiredStar /></Text>
                                <Box position="relative">
                                    <Box
                                        position="absolute"
                                        left="0"
                                        top="3"
                                        display="flex"
                                        alignItems="flex-start"
                                        ps="3"
                                        zIndex="1"
                                        pointerEvents="none"
                                        color="gray.300"
                                    >
                                        <FaAlignLeft />
                                    </Box>
                                    <Textarea
                                        name="description"
                                        placeholder="Describe your organization..."
                                        ps="10"
                                        rows={3}
                                        value={formData.description}
                                        onChange={handleChange}
                                    />
                                </Box>
                                {errors.description && <Text color="red.500" fontSize="xs" mt="1">{errors.description}</Text>}
                            </Box>
                            {errors.submit && <Text color="red.500" fontSize="sm" textAlign="center">{errors.submit}</Text>}
                            <Button
                                borderRadius="0"
                                type="submit"
                                colorPalette="teal"
                                width="full"
                            >
                                Register Organizer
                            </Button>
                            {generatedCredentials?.email && generatedCredentials?.password && (
                                <Box border="1px solid" borderColor="green.200" borderRadius="md" p={3} bg="green.50">
                                    <Text color="green.800" fontWeight="semibold" mb={2}>
                                        Organizer credentials generated
                                    </Text>
                                    <Stack gap={1}>
                                        <Text fontSize="sm" color="gray.800">Username: {generatedCredentials.email}</Text>
                                        <Text fontSize="sm" color="gray.800">Password: {generatedCredentials.password}</Text>
                                    </Stack>
                                    <HStack mt={3}>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                const text = `Username: ${generatedCredentials.email}\nPassword: ${generatedCredentials.password}`;
                                                navigator.clipboard?.writeText(text);
                                            }}
                                        >
                                            Copy Credentials
                                        </Button>
                                        <Button size="sm" colorPalette="teal" onClick={() => navigate("/admin")}>
                                            Back to Dashboard
                                        </Button>
                                    </HStack>
                                </Box>
                            )}
                        </Stack>
                    </form>
                </Box>
            </Stack>
            <Box>
                Already Registered?{" "}
                <Link color="teal.500" href="/login">
                    Log In
                </Link>
            </Box>
        </Flex>
    );
};

export default OrganizerRegisterPage;
