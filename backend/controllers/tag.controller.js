import mongoose from "mongoose";
import Tag from "../models/tag.model.js";

export const getTags = async (req, res) => {
    try {
        const tags = await Tag.find({});
        return res.status(200).json({ success: true, data: tags });
    } catch (error) {
        console.log("error in fetching tags: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const createTag = async (req, res) => {
    try {
        const tag = req.body;
        const newTag = new Tag(tag);
        await newTag.save();
        return res.status(201).json({ success: true, data: newTag });
    } catch (error) {
        console.log("error in creating tag: ", error.message);
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const updateTag = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Tag Not Found" });
    }

    try {
        const updatedTag = await Tag.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
        if (!updatedTag) {
            return res.status(404).json({ success: false, message: "Tag Not Found" });
        }
        return res.status(200).json({ success: true, data: updatedTag });
    } catch (error) {
        console.log("error in updating tag: ", error.message);
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const deleteTag = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ success: false, message: "Tag Not Found" });
    }

    try {
        const deletedTag = await Tag.findByIdAndDelete(id);
        if (!deletedTag) {
            return res.status(404).json({ success: false, message: "Tag Not Found" });
        }
        return res.status(200).json({ success: true, message: "Tag deleted" });
    } catch (error) {
        console.log("error in deleting tag: ", error.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};
