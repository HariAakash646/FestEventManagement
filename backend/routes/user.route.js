import express from "express";

import {
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    unarchiveOrganizer,
    loginUser,
    getMyProfile,
    createOrganizerByAdmin,
    updateMyProfile,
    changeMyPassword,
    updateMyInterests,
    updateMyFollowedClubs,
    updateMyPresence,
} from "../controllers/user.controller.js";
import { authMiddleware, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getUsers);
router.get("/me", authMiddleware, getMyProfile);
router.post("/admin/organizers", authMiddleware, adminOnly, createOrganizerByAdmin);
router.post("/", createUser);
router.post("/login", loginUser);
router.put("/me/profile", authMiddleware, updateMyProfile);
router.put("/me/password", authMiddleware, changeMyPassword);
router.put("/me/interests", authMiddleware, updateMyInterests);
router.put("/me/followed-clubs", authMiddleware, updateMyFollowedClubs);
router.put("/me/presence", authMiddleware, updateMyPresence);
router.post("/:id/unarchive", authMiddleware, adminOnly, unarchiveOrganizer);
router.put("/:id", authMiddleware, adminOnly, updateUser);
router.delete("/:id", authMiddleware, adminOnly, deleteUser);

export default router;
