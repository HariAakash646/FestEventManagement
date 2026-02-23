import express from "express";

import {
    createPasswordResetRequest,
    getPasswordResetRequests,
    reviewPasswordResetRequest,
} from "../controllers/passwordResetRequest.controller.js";
import { adminOnly, authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, adminOnly, getPasswordResetRequests);
router.post("/", authMiddleware, createPasswordResetRequest);
router.put("/:id", authMiddleware, adminOnly, reviewPasswordResetRequest);

export default router;
