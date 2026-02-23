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
} from "@chakra-ui/react";
import { FaUserAlt, FaLock, FaEnvelope } from "react-icons/fa";
import { useAuth } from "../context/AuthContext.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
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

        if (!formData.email.trim()) newErrors.email = "Email Address is a compulsory field";
        if (!formData.password.trim()) newErrors.password = "Password is a compulsory field";

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        try {
            const res = await fetch(`${API_URL}/users/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: formData.email.trim(),
                    password: formData.password,
                }),
            });
            const data = await res.json();
            if (data.success) {
                login(data.data, data.token);
                const redirectPathByRole = {
                    Admin: "/admin",
                    Organizer: "/organizer",
                    Participant: "/",
                };
                navigate(redirectPathByRole[data.data?.role] || "/");
            } else {
                setErrors({ submit: data.message || "Login failed" });
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
                    <FaUserAlt color="white" size="20" />
                </Box>
                <Heading color="teal.400">Welcome Back</Heading>
                <Box minW={{ base: "90%", md: "468px" }}>
                    <form onSubmit={handleSubmit}>
                        <Stack
                            gap={4}
                            p="1rem"
                            bg="whiteAlpha.900"
                            boxShadow="md"
                        >
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
                                <Text textAlign="right" fontSize="sm" mt="1">
                                    <Link color="teal.500" href="#">forgot password?</Link>
                                </Text>
                            </Box>
                            {errors.submit && <Text color="red.500" fontSize="sm" textAlign="center">{errors.submit}</Text>}
                            <Button
                                borderRadius="0"
                                type="submit"
                                colorPalette="teal"
                                width="full"
                            >
                                Log In
                            </Button>
                        </Stack>
                    </form>
                </Box>
            </Stack>
            <Box>
                New to us?{" "}
                <Link color="teal.500" href="/register">
                    Sign Up
                </Link>
            </Box>
        </Flex>
    );
};

export default LoginPage;
