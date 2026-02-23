import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box,
    Flex,
    Heading,
    Input,
    Button,
    Stack,
    Link,
    Text,
    Textarea,
} from "@chakra-ui/react";
import { FaUserAlt, FaLock, FaEnvelope, FaBuilding, FaAlignLeft, FaTag } from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const CATEGORY_OPTIONS = ["Clubs", "Councils", "Fest Teams"];

const OrganizerRegisterPage = () => {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        organizerName: "",
        organizerId: "",
        email: "",
        password: "",
        category: "",
        description: "",
    });
    const [errors, setErrors] = useState({});

    const handleShowClick = () => setShowPassword(!showPassword);

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
        if (!formData.organizerId.toString().trim()) newErrors.organizerId = "Organizer ID is a compulsory field";
        if (formData.organizerId.toString().trim() && !Number.isInteger(Number(formData.organizerId))) {
            newErrors.organizerId = "Organizer ID must be an integer";
        }
        if (!formData.email.trim()) newErrors.email = "Email Address is a compulsory field";
        if (!formData.password.trim()) newErrors.password = "Password is a compulsory field";
        if (!formData.category) newErrors.category = "Category is a compulsory field";
        if (!formData.description.trim()) newErrors.description = "Description is a compulsory field";

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        const payload = {
            role: "Organizer",
            organizerName: formData.organizerName.trim(),
            organizerId: Number(formData.organizerId),
            email: formData.email.trim(),
            password: formData.password,
            category: formData.category,
            description: formData.description.trim(),
        };

        try {
            const res = await fetch(`${API_URL}/users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                navigate("/");
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
                                <Text fontSize="xs" color="gray.600" mb="1">Email Address<RequiredStar /></Text>
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
                                        <FaEnvelope />
                                    </Box>
                                    <Input type="email" name="email" placeholder="Email Address" ps="10" value={formData.email} onChange={handleChange} />
                                </Box>
                                {errors.email && <Text color="red.500" fontSize="xs" mt="1">{errors.email}</Text>}
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
                                <Text fontSize="xs" color="gray.600" mb="1">Password<RequiredStar /></Text>
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
                                        <FaLock />
                                    </Box>
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        placeholder="Password"
                                        ps="10"
                                        pe="4.5rem"
                                        value={formData.password}
                                        onChange={handleChange}
                                    />
                                    <Box
                                        position="absolute"
                                        right="0"
                                        top="0"
                                        bottom="0"
                                        display="flex"
                                        alignItems="center"
                                        pe="2"
                                    >
                                        <Button size="sm" h="1.75rem" onClick={handleShowClick}>
                                            {showPassword ? "Hide" : "Show"}
                                        </Button>
                                    </Box>
                                </Box>
                                {errors.password && <Text color="red.500" fontSize="xs" mt="1">{errors.password}</Text>}
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
                                Register as Organizer
                            </Button>
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
