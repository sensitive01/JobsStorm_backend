const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  message: String,
  sender: { type: String },
  isRead: { type: Boolean, default: false },
  employeeImage: String,
  mediaUrl: String,
  mediaType: { type: String, enum: ["image", "audio", null], default: null },
  createdAt: { type: Date, default: Date.now },
});

const chatSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true },

    // 🔹 Members (2 participants)
    employeeId: { type: String, required: true },
    employerId: { type: String, required: true },

    // Optional display fields
    employeeImage: String,
    employerImage: String,
    employerName: String,
    position: String,

    // Messages array
    messages: [messageSchema],
  },
  {
    timestamps: true,
  }
);

chatSchema.index({ employeeId: 1, employerId: 1, jobId: 1 });

module.exports = mongoose.model("Chats", chatSchema);
