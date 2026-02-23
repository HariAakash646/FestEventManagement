import mongoose from "mongoose";

const tagSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        createdBy: {
            type: Number,
            required: false,
            validate: {
                validator: function (value) {
                    return value === undefined || Number.isInteger(value);
                },
                message: "{VALUE} must be an integer",
            },
        },
    },
    {
        timestamps: true,
    }
);

const Tag = mongoose.model("Tag", tagSchema);

export default Tag;
