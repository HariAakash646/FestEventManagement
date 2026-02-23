import mongoose from "mongoose";

import User from "../models/user.model.js";

import { generateToken } from "../config/jwt.js";


export const getUsers = async (req, res) => {
    try {
        const { role, lite } = req.query || {};
        const query = {};
        if (role && ["Participant", "Organizer", "Admin"].includes(role)) {
            query.role = role;
        }

        const shouldUseLite = String(lite || "").toLowerCase() === "true";
        const projection = shouldUseLite
            ? "role firstName lastName email isIIIT organizerName organizerId category description organizerContactEmail active isOnline followedClubs interests createdAt updatedAt"
            : "-password";

        const users = await User.find(query).select(projection);
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.log("error in fetching users: ", error.message);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const getMyProfile = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User Not Found" });
        }

        return res.status(200).json({ success: true, data: user });
    } catch (error) {
        console.log("error in fetching profile: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const createUser = async (req, res) => {
    const user = req.body;

    try {
        const newUser = new User(user);
        await newUser.save();
        res.status(201).json({ success: true, data: newUser });
    } catch (error) {
        console.log("error in creating user: ", error.message);
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Email already exists" });
        }
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const updateUser = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "User Not Found" });
    }

    try {
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User Not Found" });
        }

        Object.assign(user, updates);
        const updatedUser = await user.save();
        res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        console.log("error in updating user: ", error.message);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const updateMyProfile = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User Not Found" });
        }

        if (user.role === "Participant") {
            const editableFields = [
                "firstName",
                "lastName",
                "contactNumber",
                "collegeOrOrgName",
            ];

            editableFields.forEach((field) => {
                if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                    const value = req.body[field];
                    user[field] = typeof value === "string" ? value.trim() : value;
                }
            });

            if (user.isIIIT === false && !user.collegeOrOrgName) {
                return res.status(400).json({
                    success: false,
                    message: "College/Organization Name is required for non-IIIT participants",
                });
            }
        } else if (user.role === "Organizer") {
            const editableFields = ["organizerName", "category", "description", "discordWebhookUrl", "organizerContactEmail"];

            editableFields.forEach((field) => {
                if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                    const value = req.body[field];
                    if (field === "discordWebhookUrl" || field === "organizerContactEmail") {
                        user[field] = typeof value === "string" ? value.trim() : "";
                    } else {
                        user[field] = typeof value === "string" ? value.trim() : value;
                    }
                }
            });
        } else {
            return res.status(403).json({ success: false, message: "Profile updates are not enabled for this role" });
        }

        const updatedUser = await user.save();
        return res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        console.log("error in updating profile: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const changeMyPassword = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ success: false, message: "Old and new passwords are required" });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User Not Found" });
        }

        const isOldPasswordValid = await user.comparePassword(oldPassword);
        if (!isOldPasswordValid) {
            return res.status(400).json({ success: false, message: "Old password is incorrect" });
        }

        user.password = newPassword;
        await user.save();

        return res.status(200).json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        console.log("error in changing password: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const updateMyInterests = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User Not Found" });
        }

        if (user.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const { interests } = req.body;
        if (interests !== undefined && !Array.isArray(interests)) {
            return res.status(400).json({ success: false, message: "interests must be an array" });
        }

        user.interests = Array.isArray(interests) ? interests : [];
        const updatedUser = await user.save();

        return res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        console.log("error in updating interests: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const updateMyFollowedClubs = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User Not Found" });
        }

        if (user.role !== "Participant") {
            return res.status(403).json({ success: false, message: "Participant access required" });
        }

        const { followedClubs } = req.body;
        if (followedClubs !== undefined && !Array.isArray(followedClubs)) {
            return res.status(400).json({ success: false, message: "followedClubs must be an array" });
        }

        if (Array.isArray(followedClubs) && followedClubs.some((clubId) => !Number.isInteger(clubId))) {
            return res.status(400).json({ success: false, message: "followedClubs must contain integer organizer IDs" });
        }

        user.followedClubs = Array.isArray(followedClubs) ? followedClubs : [];
        const updatedUser = await user.save();

        return res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        console.log("error in updating followed clubs: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const updateMyPresence = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { isOnline } = req.body || {};
        if (typeof isOnline !== "boolean") {
            return res.status(400).json({ success: false, message: "isOnline must be a boolean" });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User Not Found" });
        }

        user.isOnline = isOnline;
        const updatedUser = await user.save();
        return res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        console.log("error in updating presence: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const deleteUser = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "User Not Found" });
    }

    try {
        await User.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "User deleted" });
    } catch (error) {
        console.error("Error in Delete User: ", error.message);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const unarchiveOrganizer = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "User Not Found" });
    }

    try {
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User Not Found" });
        }

        if (user.role !== "Organizer") {
            return res.status(400).json({ success: false, message: "Only organizers can be unarchived" });
        }

        user.active = true;
        const updatedUser = await user.save();
        res.status(200).json({ success: true, data: updatedUser, message: "Organizer unarchived" });
    } catch (error) {
        console.error("Error in Unarchive Organizer: ", error.message);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        if (user.role === "Organizer" && user.active === false) {
            return res.status(403).json({ success: false, message: "Organizer is inactive" });
        }

        const token = generateToken(user._id, user.role, user.organizerId);

        res.status(200).json({ 
            success: true, 
            data: user,
            token: token
        });
    } catch (error) {
        console.log("error in logging in user: ", error.message);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
