import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box,
    Button,
    Flex,
    Heading,
    Input,
    Stack,
    Text,
} from "@chakra-ui/react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiCall } from "../utils/api.js";

const ParticipantProfile = () => {
    const navigate = useNavigate();
    const { updateUser } = useAuth();
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        contactNumber: "",
        collegeOrOrgName: "",
        email: "",
        isIIIT: false,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [availableTags, setAvailableTags] = useState([]);
    const [availableClubs, setAvailableClubs] = useState([]);
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [selectedFollowedClubs, setSelectedFollowedClubs] = useState([]);

    useEffect(() => {
        const fetchProfileAndOptions = async () => {
            setIsLoading(true);
            setError("");
            try {
                const [profileResponse, tagsResponse, usersResponse] = await Promise.all([
                    apiCall("/users/me"),
                    apiCall("/tags"),
                    apiCall("/users"),
                ]);

                if (!profileResponse?.success) {
                    setError(profileResponse?.message || "Failed to fetch profile");
                    return;
                }

                const profile = profileResponse.data || {};
                setFormData({
                    firstName: profile.firstName || "",
                    lastName: profile.lastName || "",
                    contactNumber: profile.contactNumber || "",
                    collegeOrOrgName: profile.collegeOrOrgName || "",
                    email: profile.email || "",
                    isIIIT: !!profile.isIIIT,
                });
                setSelectedInterests(
                    Array.isArray(profile.interests) ? profile.interests.map((id) => String(id)) : []
                );
                setSelectedFollowedClubs(
                    Array.isArray(profile.followedClubs) ? profile.followedClubs : []
                );

                if (tagsResponse?.success) {
                    setAvailableTags(Array.isArray(tagsResponse.data) ? tagsResponse.data : []);
                }

                if (usersResponse?.success) {
                    const organizers = (Array.isArray(usersResponse.data) ? usersResponse.data : []).filter(
                        (u) => u.role === "Organizer"
                    );
                    setAvailableClubs(organizers);
                }

                if (updateUser) {
                    updateUser(profile);
                }
            } catch (err) {
                setError("Something went wrong while fetching profile.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfileAndOptions();
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
            firstName: formData.firstName,
            lastName: formData.lastName,
            contactNumber: formData.contactNumber,
            ...(formData.isIIIT ? {} : { collegeOrOrgName: formData.collegeOrOrgName }),
        };

        setIsSaving(true);
        try {
            const profileResponse = await apiCall("/users/me/profile", "PUT", payload);
            if (!profileResponse?.success) {
                setError(profileResponse?.message || "Failed to update profile");
                return;
            }

            const interestsResponse = await apiCall("/users/me/interests", "PUT", {
                interests: selectedInterests,
            });
            if (!interestsResponse?.success) {
                setError(interestsResponse?.message || "Failed to update interests");
                return;
            }

            const followedClubsResponse = await apiCall("/users/me/followed-clubs", "PUT", {
                followedClubs: selectedFollowedClubs,
            });
            if (!followedClubsResponse?.success) {
                setError(followedClubsResponse?.message || "Failed to update followed clubs");
                return;
            }

            const updated = followedClubsResponse.data || {};
            setFormData((prev) => ({
                ...prev,
                firstName: updated.firstName || "",
                lastName: updated.lastName || "",
                contactNumber: updated.contactNumber || "",
                collegeOrOrgName: updated.collegeOrOrgName || "",
                email: updated.email || prev.email,
                isIIIT: !!updated.isIIIT,
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

    const toggleInterest = (tagId) => {
        setSelectedInterests((prev) =>
            prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
        );
    };

    const toggleFollowedClub = (organizerId) => {
        setSelectedFollowedClubs((prev) =>
            prev.includes(organizerId)
                ? prev.filter((id) => id !== organizerId)
                : [...prev, organizerId]
        );
    };

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="720px">
                <Heading size="lg" mb={6}>Participant Profile</Heading>

                {isLoading ? (
                    <Text color="gray.600">Loading profile...</Text>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <Stack gap={4} p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white">
                            <Box>
                                <Text fontSize="sm" mb={1}>First Name</Text>
                                <Input name="firstName" value={formData.firstName} onChange={handleChange} />
                            </Box>

                            <Box>
                                <Text fontSize="sm" mb={1}>Last Name</Text>
                                <Input name="lastName" value={formData.lastName} onChange={handleChange} />
                            </Box>

                            <Box>
                                <Text fontSize="sm" mb={1}>Contact Number</Text>
                                <Input name="contactNumber" value={formData.contactNumber} onChange={handleChange} />
                            </Box>

                            {!formData.isIIIT && (
                                <Box>
                                    <Text fontSize="sm" mb={1}>College/Organization Name</Text>
                                    <Input
                                        name="collegeOrOrgName"
                                        value={formData.collegeOrOrgName}
                                        onChange={handleChange}
                                    />
                                </Box>
                            )}

                            <Box>
                                <Text fontSize="sm" mb={1}>Email Address</Text>
                                <Input value={formData.email} disabled />
                            </Box>

                            <Box>
                                <Text fontSize="sm" mb={1}>Participant Type</Text>
                                <Input value={formData.isIIIT ? "IIIT" : "Non-IIIT"} disabled />
                            </Box>

                            <Box>
                                <Text fontSize="sm" mb={2}>Interests</Text>
                                {availableTags.length === 0 ? (
                                    <Text fontSize="xs" color="gray.500">No tags available.</Text>
                                ) : (
                                    <Stack gap={2}>
                                        {availableTags.map((tag) => (
                                            <Text key={tag._id} as="label" fontSize="sm" display="flex" alignItems="center" gap={2}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedInterests.includes(String(tag._id))}
                                                    onChange={() => toggleInterest(String(tag._id))}
                                                />
                                                {tag.name}
                                            </Text>
                                        ))}
                                    </Stack>
                                )}
                            </Box>

                            <Box>
                                <Text fontSize="sm" mb={2}>Followed Clubs</Text>
                                {availableClubs.length === 0 ? (
                                    <Text fontSize="xs" color="gray.500">No organizations available.</Text>
                                ) : (
                                    <Stack gap={2}>
                                        {availableClubs.map((club) => (
                                            <Text key={club._id} as="label" fontSize="sm" display="flex" alignItems="center" gap={2}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFollowedClubs.includes(club.organizerId)}
                                                    onChange={() => toggleFollowedClub(club.organizerId)}
                                                />
                                                {club.organizerName}
                                            </Text>
                                        ))}
                                    </Stack>
                                )}
                            </Box>

                            {error && <Text color="red.500" fontSize="sm">{error}</Text>}
                            {success && <Text color="green.600" fontSize="sm">{success}</Text>}

                            <Button type="submit" colorPalette="teal" loading={isSaving}>
                                Save Changes
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                colorPalette="teal"
                                onClick={() => navigate("/participant/change-password")}
                            >
                                Change Password
                            </Button>
                        </Stack>
                    </form>
                )}
            </Box>
        </Flex>
    );
};

export default ParticipantProfile;
