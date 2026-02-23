import mongoose from "mongoose";

const purchaseRecordSchema = new mongoose.Schema({
    participantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        validate: {
            validator: Number.isInteger,
            message: "{VALUE} must be an integer",
        },
    },
    purchasedAt: {
        type: Date,
        default: Date.now,
    },
    qrPayload: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    qrCodeDataUrl: {
        type: String,
        default: "",
    },
}, { _id: false });

const paymentProofSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
    },
    type: {
        type: String,
        trim: true,
    },
    size: {
        type: Number,
        min: 0,
    },
    contentBase64: {
        type: String,
        default: "",
    },
}, { _id: false });

const pendingPurchaseRequestSchema = new mongoose.Schema({
    participantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    participantName: {
        type: String,
        trim: true,
        default: "",
    },
    participantEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
    paymentAmount: {
        type: Number,
        required: true,
        min: 1,
    },
    paymentProof: {
        type: paymentProofSchema,
        default: null,
    },
    requestedAt: {
        type: Date,
        default: Date.now,
    },
    reviewedAt: {
        type: Date,
        default: null,
    },
    status: {
        type: String,
        enum: {
            values: ["Pending", "Approved", "Rejected"],
            message: "{VALUE} is not a valid request status",
        },
        default: "Pending",
    },
}, { _id: true });

const itemSchema = new mongoose.Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
        required: true,
    },
    organizerId: {
        type: Number,
        required: true,
        validate: {
            validator: Number.isInteger,
            message: "{VALUE} must be an integer",
        },
    },
    itemName: {
        type: String,
        required: true,
        trim: true,
    },
    stockAvailable: {
        type: Number,
        required: true,
        min: 0,
        validate: {
            validator: Number.isInteger,
            message: "{VALUE} must be an integer",
        },
    },
    cost: {
        type: Number,
        required: true,
        min: 1,
        validate: {
            validator: Number.isInteger,
            message: "{VALUE} must be an integer",
        },
    },
    purchaseLimitPerParticipant: {
        type: Number,
        min: 1,
        validate: {
            validator: function (value) {
                return value === undefined || Number.isInteger(value);
            },
            message: "{VALUE} must be an integer",
        },
    },
    purchasedQuantity: {
        type: Number,
        default: 0,
        min: 0,
        validate: {
            validator: Number.isInteger,
            message: "{VALUE} must be an integer",
        },
    },
    purchasedBy: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],
        default: [],
    },
    purchaseRecords: {
        type: [purchaseRecordSchema],
        default: [],
    },
    pendingPurchaseRequests: {
        type: [pendingPurchaseRequestSchema],
        default: [],
    },
}, {
    timestamps: true,
});

const Item = mongoose.model("Item", itemSchema);

export default Item;
