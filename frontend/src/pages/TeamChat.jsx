import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { apiCall } from "../utils/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const formatDateTime = (value) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleString();
};

const TeamChat = () => {
    const { eventId, teamCode } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [messages, setMessages] = useState([]);
    const [eventName, setEventName] = useState("Team Event");
    const [typingUsers, setTypingUsers] = useState([]);
    const [messageDraft, setMessageDraft] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState("");

    const loadMessages = async ({ silent = false } = {}) => {
        if (!silent) setIsLoading(true);
        try {
            const response = await apiCall(`/events/${eventId}/team-registration/${teamCode}/chat`);
            if (!response?.success) {
                setError(response?.message || "Failed to load team chat.");
                return;
            }
            const payload = response.data || {};
            setEventName(payload.eventName || "Team Event");
            setMessages(Array.isArray(payload.messages) ? payload.messages : []);
            setTypingUsers(Array.isArray(payload.typingUsers) ? payload.typingUsers : []);
            setError("");
        } catch {
            if (!silent) {
                setError("Something went wrong while loading team chat.");
            }
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    useEffect(() => {
        loadMessages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId, teamCode]);

    useEffect(() => {
        const poll = setInterval(() => {
            loadMessages({ silent: true });
        }, 5000);
        return () => clearInterval(poll);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId, teamCode]);

    const sendTypingStatus = async (isTyping) => {
        try {
            const response = await apiCall(`/events/${eventId}/team-registration/${teamCode}/chat/typing`, "PUT", { isTyping });
            if (!response?.success) return;
            const payload = response.data || {};
            setTypingUsers(Array.isArray(payload.typingUsers) ? payload.typingUsers : []);
        } catch {
            // ignore typing failures
        }
    };

    useEffect(() => {
        if (!messageDraft.trim()) {
            sendTypingStatus(false);
            return;
        }

        sendTypingStatus(true);
        const timeout = setTimeout(() => {
            sendTypingStatus(false);
        }, 1200);

        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messageDraft, eventId, teamCode]);

    useEffect(() => {
        return () => {
            sendTypingStatus(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId, teamCode]);

    const canSend = useMemo(() => messageDraft.trim().length > 0 && messageDraft.trim().length <= 1000, [messageDraft]);

    const handleSend = async () => {
        if (!canSend) return;
        setIsSending(true);
        try {
            const response = await apiCall(`/events/${eventId}/team-registration/${teamCode}/chat`, "POST", {
                message: messageDraft.trim(),
            });
            if (!response?.success) {
                setError(response?.message || "Failed to send message.");
                return;
            }
            const payload = response.data || {};
            setMessages(Array.isArray(payload.messages) ? payload.messages : []);
            setTypingUsers(Array.isArray(payload.typingUsers) ? payload.typingUsers : []);
            setMessageDraft("");
            setError("");
        } catch {
            setError("Something went wrong while sending message.");
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="860px">
                    <Text color="gray.600">Loading team chat...</Text>
                </Box>
            </Flex>
        );
    }

    if (error && messages.length === 0) {
        return (
            <Flex justifyContent="center" px={4} py={8}>
                <Box w="full" maxW="860px">
                    <Text color="red.500">{error}</Text>
                    <Button mt={4} variant="outline" onClick={() => navigate(`/participant/team-events/${eventId}`)}>
                        Back to Team Event
                    </Button>
                </Box>
            </Flex>
        );
    }

    const visibleTypingNames = (Array.isArray(typingUsers) ? typingUsers : [])
        .filter((entry) => String(entry.participantId) !== String(user?._id))
        .map((entry) => entry.participantName || "Participant");

    return (
        <Flex justifyContent="center" px={4} py={8}>
            <Box w="full" maxW="860px">
                <Stack gap={4}>
                    <Heading size="lg">Team Chat: {eventName}</Heading>
                    {visibleTypingNames.length > 0 && (
                        <Text fontSize="sm" color="gray.600">
                            {visibleTypingNames.join(", ")} {visibleTypingNames.length === 1 ? "is" : "are"} typing...
                        </Text>
                    )}

                    <Box border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" p={4}>
                        <Stack gap={3} maxH="480px" overflowY="auto">
                            {messages.length === 0 ? (
                                <Text color="gray.600">No messages yet.</Text>
                            ) : (
                                messages.map((msg, index) => (
                                    <Box key={`${msg.senderId || "sender"}-${msg.sentAt || ""}-${index}`} border="1px solid" borderColor="gray.100" borderRadius="md" p={3}>
                                        <Text fontSize="sm" fontWeight="semibold" color="teal.700">{msg.senderName || "Participant"}</Text>
                                        <Text fontSize="sm" color="gray.800" mt={1}>{msg.message || ""}</Text>
                                        <Text fontSize="xs" color="gray.500" mt={1}>{formatDateTime(msg.sentAt)}</Text>
                                    </Box>
                                ))
                            )}
                        </Stack>
                    </Box>

                    <Box border="1px solid" borderColor="gray.200" borderRadius="lg" bg="white" p={4}>
                        <Stack gap={3}>
                            <Text fontSize="sm" color="gray.600">Send a message to your team</Text>
                            <Textarea
                                rows={3}
                                maxLength={1000}
                                value={messageDraft}
                                onChange={(e) => setMessageDraft(e.target.value)}
                                onBlur={() => sendTypingStatus(false)}
                                placeholder="Type your message..."
                            />
                            <Text fontSize="xs" color="gray.500">{messageDraft.length}/1000</Text>
                            {error && <Text color="red.500" fontSize="sm">{error}</Text>}
                            <Stack direction="row" gap={2}>
                                <Button colorPalette="teal" onClick={handleSend} loading={isSending} disabled={!canSend}>
                                    Send
                                </Button>
                                <Button variant="outline" onClick={() => navigate(`/participant/team-events/${eventId}`)}>
                                    Back
                                </Button>
                            </Stack>
                        </Stack>
                    </Box>
                </Stack>
            </Box>
        </Flex>
    );
};

export default TeamChat;
