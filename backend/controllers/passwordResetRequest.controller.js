import PasswordResetRequest from "../models/passwordResetRequest.model.js";
import User from "../models/user.model.js";
import { randomInt } from "crypto";
import { sendOrganizerPasswordResetEmail } from "../utils/email.js";

const getRequesterOrganizerId = async (req) => {
    if (!req.user?.id || req.user?.role !== "Organizer") return null;

    if (Number.isInteger(req.user.organizerId)) {
        return req.user.organizerId;
    }

    const requester = await User.findById(req.user.id).select("organizerId role");
    if (!requester || requester.role !== "Organizer" || !Number.isInteger(requester.organizerId)) {
        return null;
    }

    return requester.organizerId;
};

export const createPasswordResetRequest = async (req, res) => {
    try {
        const organizerId = await getRequesterOrganizerId(req);
        if (!Number.isInteger(organizerId)) {
            return res.status(403).json({ success: false, message: "Organizer access required" });
        }

        const reasonForPasswordChangeRequest =
            typeof req.body?.reasonForPasswordChangeRequest === "string"
                ? req.body.reasonForPasswordChangeRequest.trim()
                : "";
        if (!reasonForPasswordChangeRequest) {
            return res.status(400).json({ success: false, message: "reasonForPasswordChangeRequest is required" });
        }

        const requestDate = req.body?.requestDate ? new Date(req.body.requestDate) : new Date();
        if (Number.isNaN(requestDate.getTime())) {
            return res.status(400).json({ success: false, message: "requestDate must be a valid date" });
        }

        const request = new PasswordResetRequest({
            organizerId,
            reasonForPasswordChangeRequest,
            requestDate,
        });

        await request.save();
        return res.status(201).json({ success: true, data: request });
    } catch (error) {
        console.log("error in creating password reset request: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const getPasswordResetRequests = async (req, res) => {
    try {
        const requests = await PasswordResetRequest.find({}).sort({ requestDate: -1, createdAt: -1 });

        const organizerIds = [...new Set(requests.map((request) => request.organizerId))];
        const organizers = await User.find({
            role: "Organizer",
            organizerId: { $in: organizerIds },
        }).select("organizerId organizerName email");

        const organizerMap = new Map(
            organizers.map((organizer) => [organizer.organizerId, organizer])
        );

        const responseData = requests.map((request) => {
            const organizer = organizerMap.get(request.organizerId);
            return {
                ...request.toObject(),
                organizerName: organizer?.organizerName || "Unknown Organizer",
                organizerEmail: organizer?.email || "",
            };
        });

        return res.status(200).json({ success: true, data: responseData });
    } catch (error) {
        console.log("error in fetching password reset requests: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const generateRandomPassword = (length = 8) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";

    for (let i = 0; i < length; i += 1) {
        result += chars[randomInt(chars.length)];
    }

    return result;
};

export const reviewPasswordResetRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body || {};

        if (!["Approved", "Rejected"].includes(action)) {
            return res.status(400).json({ success: false, message: "action must be Approved or Rejected" });
        }

        const request = await PasswordResetRequest.findById(id);
        if (!request) {
            return res.status(404).json({ success: false, message: "Password reset request not found" });
        }

        if (action === "Rejected") {
            await PasswordResetRequest.findByIdAndDelete(id);
            return res.status(200).json({ success: true, message: "Request rejected and removed" });
        }

        const organizer = await User.findOne({
            role: "Organizer",
            organizerId: request.organizerId,
        });

        if (!organizer) {
            return res.status(404).json({ success: false, message: "Organizer not found for this request" });
        }

        const temporaryPassword = generateRandomPassword(8);

        // Update organizer password first (same behavior as a PUT-based user update through persistence layer).
        organizer.password = temporaryPassword;
        await organizer.save();

        try {
            await sendOrganizerPasswordResetEmail({
                recipientEmail: organizer.email,
                organizerName: organizer.organizerName || organizer.email,
                organizerId: organizer.organizerId,
                temporaryPassword,
                requestDate: request.requestDate,
            });
        } catch (emailError) {
            console.error("Failed to send organizer password reset email:", emailError.message);
            return res.status(500).json({
                success: false,
                message: "Password updated, but reset email could not be sent. Please retry approval.",
            });
        }

        await PasswordResetRequest.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Request approved, password reset completed, and request removed.",
        });
    } catch (error) {
        console.log("error in reviewing password reset request: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};
