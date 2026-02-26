const mongoose = require("mongoose");

// Message Schema
const messageSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      default: "",
    },
    sender: {
      type: String,
      required: true,
      enum: ["employer", "employee"],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    mediaType: {
      type: String,
      enum: ["image", "audio", "video", "document", null],
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// Chat Schema
const chatSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      // required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employer",
      required: true,
    },
    // Display information
    employeeName: {
      type: String,
      default: "",
    },
    employeeImage: {
      type: String,
      default: "",
    },
    employerName: {
      type: String,
      default: "",
    },
    employerImage: {
      type: String,
      default: "",
    },
    position: {
      type: String,
      default: "",
    },
    // Messages array
    messages: [messageSchema],
    // Unread counts for both parties
    unreadCountEmployer: {
      type: Number,
      default: 0,
    },
    unreadCountEmployee: {
      type: Number,
      default: 0,
    },
    // Last activity
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageTime: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
chatSchema.index({ employeeId: 1, employerId: 1, jobId: 1 }, { unique: true });
chatSchema.index({ employerId: 1, updatedAt: -1 });
chatSchema.index({ employeeId: 1, updatedAt: -1 });
chatSchema.index({ jobId: 1 });

// Virtual for getting unread count based on viewer
chatSchema.methods.getUnreadCount = function (viewerId, viewerType) {
  if (viewerType === "employer") {
    return this.messages.filter(
      (msg) => msg.sender === "employee" && !msg.isRead
    ).length;
  } else {
    return this.messages.filter(
      (msg) => msg.sender === "employer" && !msg.isRead
    ).length;
  }
};

// Method to mark messages as read
chatSchema.methods.markAsRead = function (viewerType) {
  this.messages.forEach((msg) => {
    if (
      (viewerType === "employer" && msg.sender === "employee") ||
      (viewerType === "employee" && msg.sender === "employer")
    ) {
      msg.isRead = true;
    }
  });
  if (viewerType === "employer") {
    this.unreadCountEmployer = 0;
  } else {
    this.unreadCountEmployee = 0;
  }
  return this.save();
};

module.exports = mongoose.model("Chat", chatSchema);
