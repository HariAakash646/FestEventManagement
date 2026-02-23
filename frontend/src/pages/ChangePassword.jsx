import { useState } from "react";
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
} from "@chakra-ui/react";
import { apiCall } from "../utils/api.js";

const ChangePassword = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        oldPassword: "",
        newPassword: "",
    });
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setError("");
        setSuccess("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!formData.oldPassword || !formData.newPassword) {
            setError("Both old and new passwords are required.");
            return;
        }

        if (formData.newPassword.length < 8) {
            setError("New password must be at least 8 characters.");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await apiCall("/users/me/password", "PUT", {
                oldPassword: formData.oldPassword,
                newPassword: formData.newPassword,
            });

            if (!response?.success) {
                setError(response?.message || "Failed to update password.");
                return;
            }

            setSuccess("Password updated successfully.");
            setFormData({ oldPassword: "", newPassword: "" });
            setTimeout(() => navigate("/participant/profile"), 800);
        } catch (err) {
            setError("Something went wrong while updating password.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="520px">
                <Heading size="lg" mb={6}>Change Password</Heading>

                <form onSubmit={handleSubmit}>
                    <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                        <Box>
                            <Text fontSize="sm" mb={1}>Old Password</Text>
                            <Input
                                type="password"
                                name="oldPassword"
                                value={formData.oldPassword}
                                onChange={handleChange}
                            />
                        </Box>

                        <Box>
                            <Text fontSize="sm" mb={1}>New Password</Text>
                            <HStack gap={2}>
                                <Input
                                    type={showNewPassword ? "text" : "password"}
                                    name="newPassword"
                                    value={formData.newPassword}
                                    onChange={handleChange}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowNewPassword((prev) => !prev)}
                                >
                                    {showNewPassword ? "Hide" : "Show"}
                                </Button>
                            </HStack>
                        </Box>

                        {error && <Text color="red.500" fontSize="sm">{error}</Text>}
                        {success && <Text color="green.600" fontSize="sm">{success}</Text>}

                        <Button type="submit" colorPalette="teal" loading={isSubmitting}>
                            Update Password
                        </Button>
                    </Stack>
                </form>
            </Box>
        </Flex>
    );
};

export default ChangePassword;
