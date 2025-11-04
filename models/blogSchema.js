const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
    {
        title: { type: String },
        category: { type: String },
        description: { type: String },
        author: { type: String },
        authorRole: { type: String },
        image: { type: String, default: null },
        authorImage: { type: String, default: null },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Blog", blogSchema);
