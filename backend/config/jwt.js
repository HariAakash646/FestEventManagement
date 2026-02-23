import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_change_this";
const JWT_EXPIRE = "7d";

export const generateToken = (userId, role, organizerId = null) => {
    const payload = { id: userId, role };
    if (organizerId !== null && organizerId !== undefined) {
        payload.organizerId = organizerId;
    }

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};
