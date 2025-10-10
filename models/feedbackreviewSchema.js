
const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
    userId: { type: String, required: true }, // User ID
    rating: { type: Number, required: true },
    description: { type: String, },
    createdAt: { type: Date, default: Date.now },
});

const Feedback = mongoose.model("Feedback", feedbackSchema);

module.exports = Feedback;
