import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiCall } from "../utils/api.js";
import { Box, Stack, Text } from "@chakra-ui/react";

const POLL_INTERVAL_MS = 8000;

const TeamChatNotifier = () => {
    const { user } = useAuth();
    const lastSeenByTeamRef = useRef(new Map());
    const isPrimedRef = useRef(false);
    const [fallbackNotices, setFallbackNotices] = useState([]);

    useEffect(() => {
        if (!user || user.role !== "Participant") {
            lastSeenByTeamRef.current = new Map();
            isPrimedRef.current = false;
            return;
        }

        const requestPermissionFromGesture = () => {
            if (typeof window === "undefined" || !("Notification" in window)) return;
            if (Notification.permission !== "default") return;
            Notification.requestPermission().catch(() => {});
        };

        requestPermissionFromGesture();

        let cancelled = false;

        const pushFallbackNotice = ({ title, body }) => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            setFallbackNotices((prev) => [...prev, { id, title, body }].slice(-4));
            setTimeout(() => {
                setFallbackNotices((prev) => prev.filter((item) => item.id !== id));
            }, 6000);
        };

        const showMessageNotification = ({ title, body }) => {
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                try {
                    new Notification(title, { body });
                    return;
                } catch {
                    // fall through to in-app fallback
                }
            }
            pushFallbackNotice({ title, body });
        };

        const isCurrentTeamChatPath = (eventId, teamCode) => {
            if (typeof window === "undefined") return false;
            const currentPath = window.location.pathname || "";
            return currentPath === `/participant/team-events/${eventId}/chat/${teamCode}`;
        };

        const pollTeamChats = async () => {
            try {
                const eventsResponse = await apiCall("/events");
                if (!eventsResponse?.success) return;

                const events = Array.isArray(eventsResponse.data) ? eventsResponse.data : [];
                const teamRefs = events
                    .filter((event) => event?.isTeamEvent === true)
                    .flatMap((event) => {
                        const requests = Array.isArray(event.pendingRegistrationRequests)
                            ? event.pendingRegistrationRequests
                            : [];
                        return requests
                            .filter((request) => {
                                if (!request || request.isTeamRegistration !== true) return false;
                                if (String(request.participantId) === String(user._id)) return true;
                                return Array.isArray(request.teamMembers) &&
                                    request.teamMembers.some((member) => String(member.participantId) === String(user._id));
                            })
                            .map((request) => ({
                                eventId: String(event._id),
                                eventName: event.eventName || "Team Event",
                                teamCode: request.teamJoinCode || "",
                            }))
                            .filter((entry) => entry.teamCode);
                    });

                const activeKeys = new Set(teamRefs.map((entry) => `${entry.eventId}:${entry.teamCode}`));
                const oldKeys = Array.from(lastSeenByTeamRef.current.keys());
                oldKeys.forEach((key) => {
                    if (!activeKeys.has(key)) {
                        lastSeenByTeamRef.current.delete(key);
                    }
                });

                const chatResponses = await Promise.all(
                    teamRefs.map(async (ref) => {
                        const response = await apiCall(`/events/${ref.eventId}/team-registration/${ref.teamCode}/chat`);
                        return { ref, response };
                    })
                );

                for (const { ref, response } of chatResponses) {
                    if (cancelled || !response?.success) continue;
                    const messages = Array.isArray(response.data?.messages) ? response.data.messages : [];
                    const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
                    const key = `${ref.eventId}:${ref.teamCode}`;

                    if (!latestMessage?.sentAt) {
                        if (!lastSeenByTeamRef.current.has(key)) {
                            lastSeenByTeamRef.current.set(key, 0);
                        }
                        continue;
                    }

                    const latestTs = new Date(latestMessage.sentAt).getTime();
                    const prevTs = lastSeenByTeamRef.current.get(key);
                    const normalizedSenderId = (() => {
                        const raw = latestMessage.senderId;
                        if (!raw) return "";
                        if (typeof raw === "string") return raw;
                        if (typeof raw === "object") {
                            return String(raw._id || raw.id || raw);
                        }
                        return String(raw);
                    })();
                    if (prevTs === undefined) {
                        lastSeenByTeamRef.current.set(key, latestTs);
                        continue;
                    }

                    if (
                        latestTs > prevTs &&
                        String(normalizedSenderId) !== String(user._id) &&
                        !isCurrentTeamChatPath(ref.eventId, ref.teamCode)
                    ) {
                        showMessageNotification({
                            title: `${ref.eventName} - Team Chat`,
                            body: `${latestMessage.senderName || "Team Member"}: ${latestMessage.message || ""}`,
                        });
                    }

                    lastSeenByTeamRef.current.set(key, latestTs);
                }

                if (!isPrimedRef.current) {
                    isPrimedRef.current = true;
                }
            } catch {
                // ignore polling errors
            }
        };

        pollTeamChats();
        const interval = setInterval(pollTeamChats, POLL_INTERVAL_MS);
        window.addEventListener("click", requestPermissionFromGesture);
        window.addEventListener("keydown", requestPermissionFromGesture);

        return () => {
            cancelled = true;
            clearInterval(interval);
            window.removeEventListener("click", requestPermissionFromGesture);
            window.removeEventListener("keydown", requestPermissionFromGesture);
        };
    }, [user]);

    return (
        <Box position="fixed" top="72px" right="16px" zIndex={2000} pointerEvents="none">
            <Stack gap={2} maxW="320px">
                {fallbackNotices.map((notice) => (
                    <Box
                        key={notice.id}
                        p={3}
                        border="1px solid"
                        borderColor="teal.200"
                        borderRadius="md"
                        bg="teal.50"
                        boxShadow="md"
                    >
                        <Text fontSize="sm" fontWeight="semibold" color="teal.800">
                            {notice.title}
                        </Text>
                        <Text fontSize="xs" color="teal.900" mt={1}>
                            {notice.body}
                        </Text>
                    </Box>
                ))}
            </Stack>
        </Box>
    );
};

export default TeamChatNotifier;
