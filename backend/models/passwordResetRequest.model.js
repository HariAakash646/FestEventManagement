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
    status: {
        type: String,
        enum: {
            values: ["Pending", "Approved", "Rejected"],
            message: "{VALUE} is not a valid request status",
        },
        default: "Pending",
    },
    reviewedAt: {
        type: Date,
        default: null,
    },
    reviewComment: {
        type: String,
        trim: true,
        default: "",
    },
    reviewHistory: {
        type: [{
            action: {
                type: String,
                enum: {
                    values: ["Approved", "Rejected"],
                    message: "{VALUE} is not a valid review action",
                },
                required: true,
            },
            comment: {
                type: String,
                trim: true,
                default: "",
            },
            reviewedAt: {
                type: Date,
                required: true,
                default: Date.now,
            },
        }],
        default: [],
    },
}, {
    timestamps: true,
});

const PasswordResetRequest = mongoose.model("PasswordResetRequest", passwordResetRequestSchema);

export default PasswordResetRequest;
