import mongoose from "mongoose";

const passwordResetRequestSchema = new mongoose.Schema({
    organizerId: {
        type: Number,
        required: true,
        validate: {
            validator: Number.isInteger,
            message: "{VALUE} must be an integer",
        },
    },
    reasonForPasswordChangeRequest: {
        type: String,
        required: true,
        trim: true,
    },
    requestDate: {
        type: Date,
        required: true,
        default: Date.now,
    },
}, {
    timestamps: true,
});

const PasswordResetRequest = mongoose.model("PasswordResetRequest", passwordResetRequestSchema);

export default PasswordResetRequest;
