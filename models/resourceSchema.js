const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        category: { type: String, required: true },
        description: { type: String, required: true },
        link: { type: String }, // e.g. https://...
        image: { type: String, default: null }, // Optional cover image
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Resource", resourceSchema);
