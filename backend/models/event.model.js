import mongoose from "mongoose";

const customFormFieldSchema = new mongoose.Schema({
    fieldLabel: {
        type: String,
        required: true,
        trim: true,
    },
    fieldDescription: {
        type: String,
        trim: true,
    },
    dataType: {
        type: String,
        required: true,
        enum: {
            values: ["Text", "Number", "Boolean", "Date", "Email", "Phone", "Dropdown", "Checkbox", "File"],
            message: "{VALUE} is not a valid custom field datatype",
        },
    },
    required: {
        type: Boolean,
        default: false,
    },
    options: {
        type: [String],
        default: [],
    },
}, { _id: false });

const customFormSchema = new mongoose.Schema({
    formTitle: {
        type: String,
        trim: true,
    },
    leaderFormTitle: {
        type: String,
        trim: true,
    },
    memberFormTitle: {
        type: String,
        trim: true,
    },
    fields: {
        type: [customFormFieldSchema],
        default: [],
    },
    leaderFields: {
        type: [customFormFieldSchema],
        default: [],
    },
    memberFields: {
        type: [customFormFieldSchema],
        default: [],
    },
}, { _id: false });

const submittedFormFieldSchema = new mongoose.Schema({
    fieldLabel: {
        type: String,
        required: true,
        trim: true,
    },
    fieldDescription: {
        type: String,
        trim: true,
    },
    dataType: {
        type: String,
        required: true,
        enum: {
            values: ["Text", "Number", "Boolean", "Date", "Email", "Phone", "Dropdown", "Checkbox", "File"],
            message: "{VALUE} is not a valid custom field datatype",
        },
    },
    required: {
        type: Boolean,
        default: false,
    },
    options: {
        type: [String],
        default: [],
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: false,
    },
}, { _id: false });

const registeredFormEntrySchema = new mongoose.Schema({
    participantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    formSnapshot: {
        type: [submittedFormFieldSchema],
        default: [],
    },
    registeredAt: {
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

const eventFeedbackSchema = new mongoose.Schema({
    participantHash: {
        type: String,
        required: true,
        trim: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
        required: true,
        trim: true,
        maxlength: 3000,
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    },
}, { _id: true });

const pendingRegistrationRequestSchema = new mongoose.Schema({
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
    formSnapshot: {
        type: [submittedFormFieldSchema],
        default: [],
    },
    paymentAmount: {
        type: Number,
        min: 0,
        default: 0,
    },
    paymentProof: {
        type: paymentProofSchema,
        default: null,
    },
    requestedAt: {
        type: Date,
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
    isTeamRegistration: {
        type: Boolean,
        default: false,
    },
    targetTeamSize: {
        type: Number,
        min: 1,
        default: null,
    },
    teamJoinCode: {
        type: String,
        trim: true,
        default: "",
    },
    teamJoinLink: {
        type: String,
        trim: true,
        default: "",
    },
    teamMembers: {
        type: [{
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
            formSnapshot: {
                type: [submittedFormFieldSchema],
                default: [],
            },
            paymentAmount: {
                type: Number,
                min: 0,
                default: 0,
            },
            paymentProof: {
                type: paymentProofSchema,
                default: null,
            },
            paymentStatus: {
                type: String,
                enum: {
                    values: ["PendingSubmission", "Pending", "Approved", "Rejected"],
                    message: "{VALUE} is not a valid member payment status",
                },
                default: "PendingSubmission",
            },
            paymentReviewedAt: {
                type: Date,
                default: null,
            },
            joinedAt: {
                type: Date,
                default: Date.now,
            },
        }],
        default: [],
    },
    leaderPaymentAmount: {
        type: Number,
        min: 0,
        default: 0,
    },
    leaderPaymentProof: {
        type: paymentProofSchema,
        default: null,
    },
    leaderPaymentStatus: {
        type: String,
        enum: {
            values: ["PendingSubmission", "Pending", "Approved", "Rejected"],
            message: "{VALUE} is not a valid leader payment status",
        },
        default: "PendingSubmission",
    },
    leaderPaymentReviewedAt: {
        type: Date,
        default: null,
    },
    teamChatMessages: {
        type: [{
            senderId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
            senderName: {
                type: String,
                trim: true,
                default: "",
            },
            message: {
                type: String,
                trim: true,
                default: "",
            },
            fileUrl: {
                type: String,
                trim: true,
                default: "",
            },
            fileName: {
                type: String,
                trim: true,
                default: "",
            },
            fileType: {
                type: String,
                trim: true,
                default: "",
            },
            sentAt: {
                type: Date,
                default: Date.now,
            },
        }],
        default: [],
    },
    teamTypingUsers: {
        type: [{
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
            updatedAt: {
                type: Date,
                default: Date.now,
            },
        }],
        default: [],
    },
}, { _id: true });

const eventSchema = new mongoose.Schema({
    eventName: {
        type: String,
        required: true,
        trim: true
    },
    eventDescription: {
        type: String,
        required: true,
        trim: true
    },
    eventType: {
        type: String,
        required: true,
        enum: {
            values: ["Normal Event", "Merchandise Event"],
            message: "{VALUE} is not a valid event type"
        }
    },
    status: {
        type: String,
        enum: {
            values: ["Draft", "Published", "Ongoing", "Completed", "Cancelled", "Closed"],
            message: "{VALUE} is not a valid status"
        },
        default: "Draft"
    },
    registrationOpen: {
        type: Boolean,
        default: true,
    },
    eligibility: {
        type: String,
        enum: {
            values: ["Must be a IIIT Student", "Open to all"],
            message: "{VALUE} is not a valid eligibility option",
        },
        default: "Open to all",
    },
    registrationDeadline: {
        type: Date,
        required: false
    },
    eventStartDate: {
        type: Date,
        required: true
    },
    eventEndDate: {
        type: Date,
        required: true,
        validate: {
            validator: function (value) {
                return !this.eventStartDate || value >= this.eventStartDate;
            },
            message: "Event End Date must be on or after Event Start Date"
        }
    },
    registrationLimit: {
        type: Number,
        required: false,
        min: 1
    },
    registrationFee: {
        type: Number,
        required: false,
        min: 0
    },
    isTeamEvent: {
        type: Boolean,
        default: false,
    },
    minTeamSize: {
        type: Number,
        required: false,
        min: 1,
        validate: {
            validator: function (value) {
                if (!this.isTeamEvent) {
                    return value === undefined || value === null;
                }
                if (!Number.isInteger(value)) {
                    return false;
                }
                if (value < 1) {
                    return false;
                }
                if (Number.isInteger(this.maxTeamSize) && value > this.maxTeamSize) {
                    return false;
                }
                return true;
            },
            message: "For team events, minTeamSize must be a positive integer and <= maxTeamSize.",
        },
    },
    maxTeamSize: {
        type: Number,
        required: false,
        min: 1,
        validate: {
            validator: function (value) {
                if (!this.isTeamEvent) {
                    return value === undefined || value === null;
                }
                if (!Number.isInteger(value)) {
                    return false;
                }
                if (value < 1) {
                    return false;
                }
                if (Number.isInteger(this.minTeamSize) && value < this.minTeamSize) {
                    return false;
                }
                return true;
            },
            message: "For team events, maxTeamSize must be a positive integer and >= minTeamSize.",
        },
    },
    organizerId: {
        type: Number,
        required: true,
        validate: {
            validator: Number.isInteger,
            message: "{VALUE} must be an integer",
        },
    },
    eventTags: {
        type: [String],
        default: []
    },
    customForm: {
        type: customFormSchema,
        required: false,
        validate: {
            validator: function (value) {
                if (this.eventType === "Normal Event") {
                    return true; // optional even for normal events
                }
                // For non-normal events, custom form must be absent or empty
                return !value || !value.fields || value.fields.length === 0;
            },
            message: "Custom form is allowed only for Normal Event",
        },
    },
    itemIds: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Item",
        }],
        default: [],
        validate: {
            validator: function (value) {
                if (this.eventType === "Merchandise Event") {
                    return Array.isArray(value);
                }
                return !value || value.length === 0;
            },
            message: "itemIds are allowed only for Merchandise Event",
        },
    },
    registeredFormList: {
        type: [registeredFormEntrySchema],
        default: [],
    },
    pendingRegistrationRequests: {
        type: [pendingRegistrationRequestSchema],
        default: [],
    },
    visitsTimeStamps: {
        type: [Date],
        default: [],
    },
    feedbackList: {
        type: [eventFeedbackSchema],
        default: [],
    },
}, {
    timestamps: true // createdAt, updatedAt
});

const Event = mongoose.model('Event', eventSchema);

export default Event;
