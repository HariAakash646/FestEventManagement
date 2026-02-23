import express from "express";

import {
    getEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    registerForEvent,
    recordEventVisit,
    createRegistrationPaymentRequest,
    reviewRegistrationPaymentRequest,
    createTeamRegistrationRequest,
    joinTeamRegistrationRequest,
    submitTeamRegistrationPaymentProof,
    reviewTeamMemberPaymentProof,
    getTeamChatMessages,
    sendTeamChatMessage,
    updateTeamTypingStatus,
    submitEventFeedback,
    getMyEventFeedback,
} from "../controllers/event.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getEvents);
router.post("/", authMiddleware, createEvent);
router.put("/:id", authMiddleware, updateEvent);
router.put("/:id/register", authMiddleware, registerForEvent);
router.post("/:id/team-registration", authMiddleware, createTeamRegistrationRequest);
router.post("/:id/team-registration/:teamCode/join", authMiddleware, joinTeamRegistrationRequest);
router.post("/:id/team-registration/:teamCode/payment-proof", authMiddleware, submitTeamRegistrationPaymentProof);
router.put("/:id/team-registration/:requestId/payments/:participantId", authMiddleware, reviewTeamMemberPaymentProof);
router.get("/:id/team-registration/:teamCode/chat", authMiddleware, getTeamChatMessages);
router.post("/:id/team-registration/:teamCode/chat", authMiddleware, sendTeamChatMessage);
router.put("/:id/team-registration/:teamCode/chat/typing", authMiddleware, updateTeamTypingStatus);
router.get("/:id/feedback/me", authMiddleware, getMyEventFeedback);
router.post("/:id/feedback", authMiddleware, submitEventFeedback);
router.post("/:id/registration-requests", authMiddleware, createRegistrationPaymentRequest);
router.put("/:id/registration-requests/:requestId", authMiddleware, reviewRegistrationPaymentRequest);
router.put("/:id/visit", authMiddleware, recordEventVisit);
router.delete("/:id", authMiddleware, deleteEvent);

export default router;
