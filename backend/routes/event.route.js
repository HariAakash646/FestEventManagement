import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import {
    getEvents,
    getEventById,
    getParticipantDashboardData,
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "..", "uploads", "chat");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const chatStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    },
});

const chatUpload = multer({
    storage: chatStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter: (_req, file, cb) => {
        const allowedTypes = [
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "application/pdf",
            "text/plain",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("File type not allowed. Accepted: images, PDF, TXT, DOC, DOCX, XLS, XLSX"), false);
        }
    },
});

const router = express.Router();

router.get("/", getEvents);
router.get("/participant/dashboard", authMiddleware, getParticipantDashboardData);
router.get("/:id", authMiddleware, getEventById);
router.post("/", authMiddleware, createEvent);
router.put("/:id", authMiddleware, updateEvent);
router.put("/:id/register", authMiddleware, registerForEvent);
router.post("/:id/team-registration", authMiddleware, createTeamRegistrationRequest);
router.post("/:id/team-registration/:teamCode/join", authMiddleware, joinTeamRegistrationRequest);
router.post("/:id/team-registration/:teamCode/payment-proof", authMiddleware, submitTeamRegistrationPaymentProof);
router.put("/:id/team-registration/:requestId/payments/:participantId", authMiddleware, reviewTeamMemberPaymentProof);
router.get("/:id/team-registration/:teamCode/chat", authMiddleware, getTeamChatMessages);
router.post("/:id/team-registration/:teamCode/chat", authMiddleware, chatUpload.single("file"), sendTeamChatMessage);
router.put("/:id/team-registration/:teamCode/chat/typing", authMiddleware, updateTeamTypingStatus);
router.get("/:id/feedback/me", authMiddleware, getMyEventFeedback);
router.post("/:id/feedback", authMiddleware, submitEventFeedback);
router.post("/:id/registration-requests", authMiddleware, createRegistrationPaymentRequest);
router.put("/:id/registration-requests/:requestId", authMiddleware, reviewRegistrationPaymentRequest);
router.put("/:id/visit", authMiddleware, recordEventVisit);
router.delete("/:id", authMiddleware, deleteEvent);

export default router;
