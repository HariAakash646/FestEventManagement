import mongoose from "mongoose";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;
const IIIT_EMAIL_SUFFIX = "iiit.ac.in";

const userSchema = new mongoose.Schema({
    role: {
        type: String,
        required: true,
        enum: {
            values: ['Participant', 'Organizer', 'Admin'],
            message: '{VALUE} is not a valid role'
        }
    },
    firstName: {
        type: String,
        trim: true,
        required: function () {
            return this.role === 'Participant';
        }
    },
    lastName: {
        type: String,
        trim: true,
        required: function () {
            return this.role === 'Participant';
        }
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
        sparse: true,
        required: true,
        validate: {
            validator: function (value) {
                if (this.role === "Participant" && this.isIIIT === true) {
                    return String(value || "").toLowerCase().endsWith(IIIT_EMAIL_SUFFIX);
                }
                return true;
            },
            message: `IIIT participants must use an email ending with ${IIIT_EMAIL_SUFFIX}`,
        },
    },
    isIIIT: {
        type: Boolean,
        required: function () {
            return this.role === 'Participant';
        }
    },
    collegeOrOrgName: {
        type: String,
        trim: true,
        required: function () {
            return this.role === 'Participant' && this.isIIIT === false;
        }
    },
    contactNumber: {
        type: String,
        trim: true,
        required: function () {
            return this.role === 'Participant';
        }
    },
    organizerName: {
        type: String,
        trim: true,
        required: function () {
            return this.role === 'Organizer';
        }
    },
    organizerId: {
        type: Number,
        unique: true,
        required: function () {
            return this.role === 'Organizer';
        },
        validate: {
            validator: Number.isInteger,
            message: "{VALUE} must be an integer"
        }
    },
    category: {
        type: String,
        enum: {
            values: ['Clubs', 'Councils', 'Fest Teams'],
            message: '{VALUE} is not a valid organizer category'
        },
        required: function () {
            return this.role === 'Organizer';
        }
    },
    description: {
        type: String,
        trim: true,
        required: function () {
            return this.role === 'Organizer';
        }
    },
    organizerContactEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: function () {
            if (this.role === "Organizer") {
                return this.email || "";
            }
            return "";
        },
    },
    discordWebhookUrl: {
        type: String,
        trim: true,
        default: "",
        validate: {
            validator: function (value) {
                if (!value) return true;
                return /^https?:\/\/.+/i.test(value);
            },
            message: "discordWebhookUrl must be a valid URL",
        },
    },
    active: {
        type: Boolean,
        default: true
    },
    isOnline: {
        type: Boolean,
        default: false,
    },
    interests: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tag",
        }],
        default: [],
    },
    followedClubs: {
        type: [Number],
        default: [],
        validate: {
            validator: function (value) {
                return Array.isArray(value) && value.every(Number.isInteger);
            },
            message: "followedClubs must contain only integer organizer IDs",
        },
    },
    registeredEvents: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
        }],
        default: [],
    },
    purchasedItems: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Item",
        }],
        default: [],
    },
    password: {
        type: String,
        required: true,
        minlength: 8
    }
}, {
    timestamps: true // createdAt, updatedAt
});

userSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }

    try {
        this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    } catch (error) {
        throw error;
    }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        return false;
    }
};

const User = mongoose.model('User', userSchema);

export default User;
