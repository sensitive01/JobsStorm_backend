const Resource = require("../models/resourceSchema");

exports.postResource = async (req, res) => {
    try {
        const { title, category, description, link, image } = req.body;

        const newResource = new Resource({
            title,
            category,
            description,
            link,
            image,
        });

        await newResource.save();

        res.status(201).json({
            success: true,
            message: "Resource published successfully",
            resource: newResource,
        });
    } catch (error) {
        console.error("Error publishing resource:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

exports.getAllResources = async (req, res) => {
    try {
        const resources = await Resource.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, resources });
    } catch (error) {
        console.error("Error fetching resources:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

exports.getResourceById = async (req, res) => {
    try {
        const { id } = req.params;
        const resource = await Resource.findById(id);

        if (!resource) {
            return res.status(404).json({ success: false, message: "Resource not found" });
        }

        res.status(200).json({ success: true, resource });
    } catch (error) {
        console.error("Error fetching resource details:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

exports.updateResource = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const updatedResource = await Resource.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });

        if (!updatedResource) {
            return res.status(404).json({ success: false, message: "Resource not found" });
        }

        res.status(200).json({
            success: true,
            message: "Resource updated successfully",
            resource: updatedResource,
        });
    } catch (error) {
        console.error("Error updating resource:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

exports.deleteResource = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedResource = await Resource.findByIdAndDelete(id);

        if (!deletedResource) {
            return res.status(404).json({ success: false, message: "Resource not found" });
        }

        res.status(200).json({ success: true, message: "Resource deleted successfully" });
    } catch (error) {
        console.error("Error deleting resource:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};
