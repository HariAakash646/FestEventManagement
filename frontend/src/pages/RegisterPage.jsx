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
import { FaUserAlt, FaLock, FaPhoneAlt, FaEnvelope, FaBuilding } from "react-icons/fa";
import { useAuth } from "../context/AuthContext.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const IIIT_EMAIL_SUFFIX = "iiit.ac.in";


const RegisterPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [isIIIT, setIsIIIT] = useState("");
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        password: "",
        collegeName: "",
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

        if (!formData.firstName.trim()) newErrors.firstName = "First Name is a compulsory field";
        if (!formData.lastName.trim()) newErrors.lastName = "Last Name is a compulsory field";
        if (!formData.email.trim()) newErrors.email = "Email Address is a compulsory field";
        if (
            isIIIT === "yes" &&
            formData.email.trim() &&
            !formData.email.trim().toLowerCase().endsWith(IIIT_EMAIL_SUFFIX)
        ) {
            newErrors.email = `IIIT participants must use an email ending with ${IIIT_EMAIL_SUFFIX}`;
        }
        if (!formData.phone.trim()) newErrors.phone = "Phone Number is a compulsory field";
        if (!formData.password.trim()) newErrors.password = "Password is a compulsory field";
        if (!isIIIT) newErrors.isIIIT = "Is IIIT? is a compulsory field";
        if (isIIIT === "no" && !formData.collegeName.trim()) newErrors.collegeName = "College/Organization Name is a compulsory field";

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        // Build payload matching backend user model
        const payload = {
            role: "Participant",
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim(),
            contactNumber: formData.phone.trim(),
            password: formData.password,
            isIIIT: isIIIT === "yes",
        };
        if (isIIIT === "no") {
            payload.collegeOrOrgName = formData.collegeName.trim();
        }

        try {
            const res = await fetch(`${API_URL}/users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                const loginRes = await fetch(`${API_URL}/users/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: formData.email.trim(),
                        password: formData.password,
                    }),
                });
                const loginData = await loginRes.json();

                if (loginData?.success) {
                    login(loginData.data, loginData.token);
                    navigate("/participant/select-interests");
                    return;
                }

                navigate("/login");
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
                    <FaUserAlt color="white" size="20" />
                </Box>
                <Heading color="teal.400">Welcome</Heading>
                <Box minW={{ base: "90%", md: "468px" }}>
                    <form onSubmit={handleSubmit}>
                        <Stack
                            gap={4}
                            p="1rem"
                            bg="whiteAlpha.900"
                            boxShadow="md"
                        >
                            <Box>
                                <Text fontSize="xs" color="gray.600" mb="1">First Name<RequiredStar /></Text>
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
                                    <Input type="text" name="firstName" placeholder="First Name" ps="10" value={formData.firstName} onChange={handleChange} />
                                </Box>
                                {errors.firstName && <Text color="red.500" fontSize="xs" mt="1">{errors.firstName}</Text>}
                            </Box>
                            <Box>
                                <Text fontSize="xs" color="gray.600" mb="1">Last Name<RequiredStar /></Text>
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
                                    <Input type="text" name="lastName" placeholder="Last Name" ps="10" value={formData.lastName} onChange={handleChange} />
                                </Box>
                                {errors.lastName && <Text color="red.500" fontSize="xs" mt="1">{errors.lastName}</Text>}
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
                                <Text fontSize="xs" color="gray.600" mb="1">Phone Number<RequiredStar /></Text>
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
                                        <FaPhoneAlt />
                                    </Box>
                                    <Input type="tel" name="phone" placeholder="Phone Number" ps="10" value={formData.phone} onChange={handleChange} />
                                </Box>
                                {errors.phone && <Text color="red.500" fontSize="xs" mt="1">{errors.phone}</Text>}
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
                            <Box>
                                <Flex alignItems="center" justifyContent="center" gap={4}>
                                    <Text fontSize="sm" color="gray.600">Is IIIT?<RequiredStar /></Text>
                                    <Flex gap={4}>
                                        <Text as="label" fontSize="sm" color="gray.600" display="flex" alignItems="center" gap="1">
                                            <input type="radio" name="isIIIT" value="yes" checked={isIIIT === "yes"} onChange={(e) => { setIsIIIT(e.target.value); if (errors.isIIIT) setErrors((prev) => ({ ...prev, isIIIT: "" })); }} /> Yes
                                        </Text>
                                        <Text as="label" fontSize="sm" color="gray.600" display="flex" alignItems="center" gap="1">
                                            <input type="radio" name="isIIIT" value="no" checked={isIIIT === "no"} onChange={(e) => { setIsIIIT(e.target.value); if (errors.isIIIT) setErrors((prev) => ({ ...prev, isIIIT: "" })); }} /> No
                                        </Text>
                                    </Flex>
                                </Flex>
                                {errors.isIIIT && <Text color="red.500" fontSize="xs" mt="1" textAlign="center">{errors.isIIIT}</Text>}
                            </Box>
                            {isIIIT === "no" && (
                                <Box>
                                    <Text fontSize="xs" color="gray.600" mb="1">College/Organization Name<RequiredStar /></Text>
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
                                            <FaBuilding />
                                        </Box>
                                        <Input type="text" name="collegeName" placeholder="College/Organization Name" ps="10" value={formData.collegeName} onChange={handleChange} />
                                    </Box>
                                    {errors.collegeName && <Text color="red.500" fontSize="xs" mt="1">{errors.collegeName}</Text>}
                                </Box>
                            )}
                            {errors.submit && <Text color="red.500" fontSize="sm" textAlign="center">{errors.submit}</Text>}
                            <Button
                                borderRadius="0"
                                type="submit"
                                colorPalette="teal"
                                width="full"
                            >
                                Sign Up
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

export default RegisterPage;
