import { useEffect, useState } from "react";
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

const CATEGORY_OPTIONS = ["Clubs", "Councils", "Fest Teams"];

const OrganizerProfile = () => {
    const { updateUser } = useAuth();
    const [formData, setFormData] = useState({
        organizerName: "",
        category: "",
        description: "",
        email: "",
        organizerContactEmail: "",
        organizerContactNumber: "",
        organizerUpiId: "",
        discordWebhookUrl: "",
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [resetReason, setResetReason] = useState("");
    const [isSendingResetRequest, setIsSendingResetRequest] = useState(false);
    const [resetError, setResetError] = useState("");
    const [resetSuccess, setResetSuccess] = useState("");

    useEffect(() => {
        const fetchProfile = async () => {
            setIsLoading(true);
            setError("");
            try {
                const response = await apiCall("/users/me");
                if (!response?.success) {
                    setError(response?.message || "Failed to fetch profile");
                    return;
                }

                const profile = response.data || {};
                setFormData({
                    organizerName: profile.organizerName || "",
                    category: profile.category || "",
                    description: profile.description || "",
                    email: profile.email || "",
                    organizerContactEmail:
                        typeof profile.organizerContactEmail === "string"
                            ? profile.organizerContactEmail
                            : (profile.email || ""),
                    organizerContactNumber: profile.organizerContactNumber || "",
                    organizerUpiId: profile.organizerUpiId || "",
                    discordWebhookUrl: profile.discordWebhookUrl || "",
                });

                if (updateUser) {
                    updateUser(profile);
                }
            } catch (err) {
                setError("Something went wrong while fetching profile.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [updateUser]);

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

        const payload = {
            organizerName: formData.organizerName,
            category: formData.category,
            description: formData.description,
            organizerContactEmail: formData.organizerContactEmail,
            organizerContactNumber: formData.organizerContactNumber,
            organizerUpiId: formData.organizerUpiId,
            discordWebhookUrl: formData.discordWebhookUrl,
        };

        setIsSaving(true);
        try {
            const response = await apiCall("/users/me/profile", "PUT", payload);
            if (!response?.success) {
                setError(response?.message || "Failed to update profile");
                return;
            }

            const updated = response.data || {};
            setFormData((prev) => ({
                ...prev,
                organizerName: updated.organizerName || "",
                category: updated.category || "",
                description: updated.description || "",
                email: updated.email || prev.email,
                organizerContactEmail:
                    typeof updated.organizerContactEmail === "string"
                        ? updated.organizerContactEmail
                        : (updated.email || prev.email),
                organizerContactNumber: updated.organizerContactNumber || "",
                organizerUpiId: updated.organizerUpiId || "",
                discordWebhookUrl: updated.discordWebhookUrl || "",
            }));

            if (updateUser) {
                updateUser(updated);
            }

            setSuccess("Profile updated successfully.");
        } catch (err) {
            setError("Something went wrong while updating profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordResetRequest = async (e) => {
        e.preventDefault();
        setResetError("");
        setResetSuccess("");

        const reason = resetReason.trim();
        if (!reason) {
            setResetError("Please enter a reason for the password reset request.");
            return;
        }

        setIsSendingResetRequest(true);
        try {
            const response = await apiCall("/password-reset-requests", "POST", {
                reasonForPasswordChangeRequest: reason,
            });

            if (!response?.success) {
                setResetError(response?.message || "Failed to send password reset request.");
                return;
            }

            setResetReason("");
            setResetSuccess("Password reset request sent successfully.");
        } catch (err) {
            setResetError("Something went wrong while sending password reset request.");
        } finally {
            setIsSendingResetRequest(false);
        }
    };

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="720px">
                <Heading size="lg" mb={6}>Organizer Profile</Heading>

                {isLoading ? (
                    <Text color="gray.600">Loading profile...</Text>
                ) : (
                    <Stack gap={6}>
                        <form onSubmit={handleSubmit}>
                            <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                                <Box>
                                    <Text fontSize="sm" mb={1}>Name</Text>
                                    <Input name="organizerName" value={formData.organizerName} onChange={handleChange} />
                                </Box>

                                <Box>
                                    <Text fontSize="sm" mb={1}>Category</Text>
                                    <select
                                        name="category"
                                        value={formData.category}
                                        onChange={handleChange}
                                        style={{
                                            width: "100%",
                                            border: "1px solid #E2E8F0",
                                            borderRadius: "6px",
                                            minHeight: "40px",
                                            padding: "0 12px",
                                            backgroundColor: "white",
                                        }}
                                    >
                                        <option value="">Select Category</option>
                                        {CATEGORY_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </Box>

                                <Box>
                                    <Text fontSize="sm" mb={1}>Description</Text>
                                    <Textarea name="description" value={formData.description} onChange={handleChange} />
                                </Box>

                                <Box>
                                    <Text fontSize="sm" mb={1}>Login Email</Text>
                                    <Input value={formData.email} disabled />
                                </Box>

                                <Box>
                                    <Text fontSize="sm" mb={1}>Contact Email</Text>
                                    <Input
                                        name="organizerContactEmail"
                                        placeholder="Optional public contact email"
                                        value={formData.organizerContactEmail}
                                        onChange={handleChange}
                                    />
                                    <Text fontSize="xs" color="gray.500" mt={1}>
                                        Defaults to login email. You can clear this field if you do not want to show a contact email.
                                    </Text>
                                </Box>

                                <Box>
                                    <Text fontSize="sm" mb={1}>UPI ID</Text>
                                    <Input
                                        name="organizerUpiId"
                                        placeholder="yourname@bank"
                                        value={formData.organizerUpiId}
                                        onChange={handleChange}
                                    />
                                    <Text fontSize="xs" color="gray.500" mt={1}>
                                        This UPI ID will be shown on participant payment proof pages.
                                    </Text>
                                </Box>

                                <Box>
                                    <Text fontSize="sm" mb={1}>Contact Number</Text>
                                    <Input
                                        name="organizerContactNumber"
                                        placeholder="Optional contact number"
                                        value={formData.organizerContactNumber}
                                        onChange={handleChange}
                                    />
                                </Box>

                                <Box>
                                    <Text fontSize="sm" mb={1}>Discord Webhook URL</Text>
                                    <Input
                                        name="discordWebhookUrl"
                                        placeholder="https://discord.com/api/webhooks/..."
                                        value={formData.discordWebhookUrl}
                                        onChange={handleChange}
                                    />
                                    <Text fontSize="xs" color="gray.500" mt={1}>
                                        Event publish notifications will be posted to this webhook.
                                    </Text>
                                </Box>

                                {error && <Text color="red.500" fontSize="sm">{error}</Text>}
                                {success && <Text color="green.600" fontSize="sm">{success}</Text>}

                                <Button type="submit" colorPalette="teal" loading={isSaving}>
                                    Save Changes
                                </Button>
                            </Stack>
                        </form>

                        <form onSubmit={handlePasswordResetRequest}>
                            <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                                <Heading size="sm">Request Password Reset</Heading>

                                <Box>
                                    <Text fontSize="sm" mb={1}>Reason for Password Reset Request</Text>
                                    <Textarea
                                        placeholder="Enter the reason for requesting a password reset"
                                        value={resetReason}
                                        onChange={(e) => {
                                            setResetReason(e.target.value);
                                            setResetError("");
                                            setResetSuccess("");
                                        }}
                                    />
                                </Box>

                                {resetError && <Text color="red.500" fontSize="sm">{resetError}</Text>}
                                {resetSuccess && <Text color="green.600" fontSize="sm">{resetSuccess}</Text>}

                                <Button type="submit" colorPalette="orange" loading={isSendingResetRequest}>
                                    Send Password Reset Request
                                </Button>
                            </Stack>
                        </form>
                    </Stack>
                )}
            </Box>
        </Flex>
    );
};

export default OrganizerProfile;
