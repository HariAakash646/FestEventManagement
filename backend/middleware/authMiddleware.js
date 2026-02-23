import { verifyToken } from "../config/jwt.js";

export const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    req.user = decoded;
    next();
};

export const adminOnly = (req, res, next) => {
    if (req.user?.role !== "Admin") {
        return res.status(403).json({ success: false, message: "Admin access required" });
    }
    next();
};