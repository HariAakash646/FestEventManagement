import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Badge,
    Box,
    Button,
    Flex,
    Heading,
    SimpleGrid,
    Stack,
    Text,
} from "@chakra-ui/react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiCall } from "../utils/api.js";

const formatDateTime = (value) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleString();
};

const formatSubmittedFieldValue = (field) => {
    const value = field?.value;
    if (value === undefined || value === null || value === "") return "N/A";
    if (Array.isArray(value)) return value.join(", ");
    if (field?.dataType === "Boolean") return value ? "Yes" : "No";
    if (field?.dataType === "Date") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString();
    }
    if (field?.dataType === "File" && typeof value === "object") return value?.name || "Uploaded file";
    return String(value);
};

const InfoRow = ({ label, value }) => (
    <Box>
        <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">
            {label}
        </Text>
        <Text fontSize="sm" color="gray.800" fontWeight="medium">
            {value}
        </Text>
    </Box>
);

const ParticipantTeamEventDetail = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [event, setEvent] = useState(null);
    const [organizerName, setOrganizerName] = useState("Unknown Organizer");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError("");
            try {
                const eventResponse = await apiCall(`/events/${eventId}?scope=participant-team-detail`);
                if (!eventResponse?.success) {
                    setError(eventResponse?.message || "Failed to fetch event details.");
                    return;
                }

                const foundEvent = eventResponse?.data?.event || null;
                if (!foundEvent || foundEvent.isTeamEvent !== true) {
                    setError("Team event not found.");
                    return;
                }

                setEvent(foundEvent);
                setOrganizerName(eventResponse?.data?.organizer?.organizerName || "Unknown Organizer");
            } catch {
                setError("Something went wrong while loading team event details.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [eventId]);

    const teamRequest = useMemo(() => {
        if (!event || !user?._id) return null;
        const requests = Array.isArray(event.pendingRegistrationRequests) ? event.pendingRegistrationRequests : [];
        return requests
            .filter((request) => request?.isTeamRegistration === true)
            .find((request) => {
                if (String(request.participantId) === String(user._id)) return true;
                return Array.isArray(request.teamMembers) &&
                    request.teamMembers.some((member) => String(member.participantId) === String(user._id));
            }) || null;
    }, [event, user?._id]);

    const userRegistration = useMemo(() => {
        if (!event || !user?._id) return null;
        const list = Array.isArray(event.registeredFormList) ? event.registeredFormList : [];
        return list.find((entry) => String(entry.participantId) === String(user._id)) || null;
    }, [event, user?._id]);

    const registrationStatus = teamRequest?.status || (userRegistration ? "Approved" : "Not Found");
    const isLeader = teamRequest ? String(teamRequest.participantId) === String(user?._id) : false;

    const teamMembersInfo = useMemo(() => {
        if (!teamRequest) return [];
        const leader = {
            key: `leader-${String(teamRequest.participantId)}`,
            role: "Leader",
            participantId: String(teamRequest.participantId),
            participantName: teamRequest.participantName || "Unknown Participant",
            participantEmail: teamRequest.participantEmail || "N/A",
            joinedAt: teamRequest.requestedAt || null,
            isOnline: false,
        };
        const members = Array.isArray(teamRequest.teamMembers)
            ? teamRequest.teamMembers.map((member, index) => ({
                key: `member-${String(member.participantId)}-${index}`,
                role: "Member",
                participantId: String(member.participantId),
                participantName: member.participantName || "Unknown Participant",
                participantEmail: member.participantEmail || "N/A",
                joinedAt: member.joinedAt || null,
                isOnline: false,
            }))
            : [];
        return [leader, ...members];
    }, [teamRequest]);

    const currentUserFormSnapshot = useMemo(() => {
        if (!user?._id) return [];
        if (teamRequest) {
            if (String(teamRequest.participantId) === String(user._id)) {
                return Array.isArray(teamRequest.formSnapshot) ? teamRequest.formSnapshot : [];
            }
            const matchedMember = Array.isArray(teamRequest.teamMembers)
                ? teamRequest.teamMembers.find((member) => String(member.participantId) === String(user._id))
                : null;
            return Array.isArray(matchedMember?.formSnapshot) ? matchedMember.formSnapshot : [];
        }
        return Array.isArray(userRegistration?.formSnapshot) ? userRegistration.formSnapshot : [];
    }, [teamRequest, user?._id, userRegistration]);

    if (isLoading) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="980px">
                    <Text color="gray.600">Loading team event details...</Text>
                </Box>
            </Flex>
        );
    }

    if (error || !event) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="980px">
                    <Text color="red.500">{error || "Team event not found."}</Text>
                    <Button mt={4} variant="outline" onClick={() => navigate("/")}>Back to Home</Button>
                </Box>
            </Flex>
        );
    }

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="980px">
                <Stack gap={6}>
                    <Box p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" boxShadow="sm">
                        <Stack gap={3}>
                            <Heading size="lg">{event.eventName}</Heading>
                            <Text color="gray.700">{event.eventDescription || "No description"}</Text>
                            <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                                <InfoRow label="Organizer" value={organizerName} />
                                <InfoRow label="Event Type" value={event.eventType || "N/A"} />
                                <InfoRow label="Status" value={event.status || "N/A"} />
                                <InfoRow label="Registration Status" value={registrationStatus} />
                                <InfoRow label="Team Size Range" value={`${event.minTeamSize || 1} - ${event.maxTeamSize || event.minTeamSize || 1}`} />
                                <InfoRow label="Role in Team" value={teamRequest ? (isLeader ? "Leader" : "Member") : "N/A"} />
                                <InfoRow label="Registration Deadline" value={formatDateTime(event.registrationDeadline)} />
                                <InfoRow label="Event Start" value={formatDateTime(event.eventStartDate)} />
                                <InfoRow label="Event End" value={formatDateTime(event.eventEndDate)} />
                                <InfoRow label="Target Team Size" value={teamRequest?.targetTeamSize ?? "N/A"} />
                                <InfoRow
                                    label="Current Team Size"
                                    value={teamRequest ? 1 + (Array.isArray(teamRequest.teamMembers) ? teamRequest.teamMembers.length : 0) : "N/A"}
                                />
                            </SimpleGrid>
                            {teamRequest?.teamJoinLink && isLeader && teamRequest.status === "Pending" && (
                                <Box border="1px solid" borderColor="teal.200" borderRadius="md" p={3} bg="teal.50">
                                    <Text fontSize="sm" fontWeight="semibold" color="teal.800" mb={1}>Team Join Link</Text>
                                    <Text fontSize="xs" color="teal.900" wordBreak="break-all">{teamRequest.teamJoinLink}</Text>
                                </Box>
                            )}
                            {teamRequest?.teamJoinCode && (
                                <Button
                                    alignSelf="start"
                                    colorPalette="teal"
                                    variant="outline"
                                    onClick={() => navigate(`/participant/team-events/${event._id}/chat/${teamRequest.teamJoinCode}`)}
                                >
                                    Open Team Chat
                                </Button>
                            )}
                        </Stack>
                    </Box>

                    <Box p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" boxShadow="sm">
                        <Stack gap={3}>
                            <Heading size="md">Registration Details</Heading>
                            {currentUserFormSnapshot.length === 0 ? (
                                <Text color="gray.600">No registration form submission found for your account yet.</Text>
                            ) : (
                                <Stack gap={2}>
                                    {currentUserFormSnapshot.map((field, index) => (
                                        <Box key={`${field.fieldLabel || "field"}-${index}`} border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                                            <Text fontWeight="semibold" color="gray.800">
                                                {field.fieldLabel || `Field ${index + 1}`}
                                            </Text>
                                            {field.fieldDescription && (
                                                <Text fontSize="xs" color="gray.500" mt={1}>
                                                    {field.fieldDescription}
                                                </Text>
                                            )}
                                            <Text fontSize="sm" color="teal.700" mt={1}>Type: {field.dataType || "N/A"}</Text>
                                            <Text fontSize="sm" color="gray.800" mt={1}>Response: {formatSubmittedFieldValue(field)}</Text>
                                        </Box>
                                    ))}
                                </Stack>
                            )}
                        </Stack>
                    </Box>

                    <Box p={5} border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" boxShadow="sm">
                        <Stack gap={3}>
                            <Heading size="md">Team Members</Heading>
                            {teamMembersInfo.length === 0 ? (
                                <Text color="gray.600">No team information available yet.</Text>
                            ) : (
                                <Box border="1px solid" borderColor="gray.200" borderRadius="md" overflowX="auto">
                                    <Box px={4} py={2} bg="gray.50" borderBottom="1px solid" borderColor="gray.200" minW="760px">
                                        <SimpleGrid columns={6} gap={3}>
                                            <Text fontSize="xs" color="gray.500" fontWeight="bold">Role</Text>
                                            <Text fontSize="xs" color="gray.500" fontWeight="bold">Name</Text>
                                            <Text fontSize="xs" color="gray.500" fontWeight="bold">Email</Text>
                                            <Text fontSize="xs" color="gray.500" fontWeight="bold">Participant ID</Text>
                                            <Text fontSize="xs" color="gray.500" fontWeight="bold">Online</Text>
                                            <Text fontSize="xs" color="gray.500" fontWeight="bold">Joined At</Text>
                                        </SimpleGrid>
                                    </Box>
                                    <Stack gap={0}>
                                        {teamMembersInfo.map((member, index) => (
                                            <Box key={member.key} px={4} py={2.5} minW="760px" borderTop={index === 0 ? "none" : "1px solid"} borderColor="gray.100">
                                                <SimpleGrid columns={6} gap={3}>
                                                    <Text fontSize="sm" color="teal.700" fontWeight="semibold">{member.role}</Text>
                                                    <Text fontSize="sm" color="gray.800">{member.participantName}</Text>
                                                    <Text fontSize="sm" color="gray.700">{member.participantEmail}</Text>
                                                    <Text fontSize="sm" color="gray.700">{member.participantId}</Text>
                                                    <Badge
                                                        alignSelf="start"
                                                        borderRadius="full"
                                                        px={2}
                                                        py={0.5}
                                                        textTransform="none"
                                                        bg={member.isOnline ? "green.100" : "gray.200"}
                                                        color={member.isOnline ? "green.800" : "gray.700"}
                                                    >
                                                        {member.isOnline ? "Online" : "Offline"}
                                                    </Badge>
                                                    <Text fontSize="sm" color="gray.700">{formatDateTime(member.joinedAt)}</Text>
                                                </SimpleGrid>
                                            </Box>
                                        ))}
                                    </Stack>
                                </Box>
                            )}
                        </Stack>
                    </Box>
                </Stack>
            </Box>
        </Flex>
    );
};

export default ParticipantTeamEventDetail;
