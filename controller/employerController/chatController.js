const mongoose = require("mongoose");
const Chat = require("../../models/chatSchema");
const { cloudinary } = require("../../config/cloudinary");

/**
 * Send a message in a chat
 * POST /employer/sendchats
 */
exports.sendMessage = async (req, res) => {
  try {
    const {
      employeeId,
      employerId,
      jobId,
      message,
      sender,
      position,
      employerName,
      employerImage,
      employeeName,
      employeeImage,
    } = req.body;

    // Validation
    if (!employeeId || !employerId || !jobId || !sender) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: employeeId, employerId, jobId, sender",
      });
    }

    if (sender !== "employer" && sender !== "employee") {
      return res.status(400).json({
        success: false,
        message: "Invalid sender. Must be 'employer' or 'employee'",
      });
    }

    // Handle file upload if present
    let mediaUrl = null;
    let mediaType = null;

    if (req.file) {
      try {
        const mimetype = req.file.mimetype;
        let resourceType = "auto";

        if (mimetype.startsWith("image/")) {
          resourceType = "image";
          mediaType = "image";
        } else if (mimetype.startsWith("audio/")) {
          resourceType = "video";
          mediaType = "audio";
        } else if (mimetype.startsWith("video/")) {
          resourceType = "video";
          mediaType = "video";
        } else {
          resourceType = "raw";
          mediaType = "document";
        }

        const base64Data = `data:${mimetype};base64,${req.file.buffer.toString(
          "base64"
        )}`;

        const result = await cloudinary.uploader.upload(base64Data, {
          resource_type: resourceType,
          folder:
            resourceType === "image"
              ? "chat_images"
              : resourceType === "video"
              ? "chat_media"
              : "chat_documents",
        });

        mediaUrl = result.secure_url;
        console.log("✅ File uploaded to Cloudinary:", mediaUrl);
      } catch (uploadError) {
        console.error("❌ Cloudinary upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "File upload failed",
          error: uploadError.message,
        });
      }
    }

    // Create message object
    const newMessage = {
      message: message || (mediaType ? `[${mediaType}]` : ""),
      sender,
      isRead: false,
      createdAt: new Date(),
      ...(mediaUrl && { mediaUrl }),
      ...(mediaType && { mediaType }),
    };

    // Find or create chat
    const chat = await Chat.findOneAndUpdate(
      { employeeId, employerId, jobId },
      {
        $setOnInsert: {
          employeeName: employeeName || "",
          employeeImage: employeeImage || "",
          employerName: employerName || "",
          employerImage: employerImage || "",
          position: position || "",
          unreadCountEmployer: 0,
          unreadCountEmployee: 0,
        },
        $push: { messages: newMessage },
        $set: {
          lastMessage: newMessage.message,
          lastMessageTime: new Date(),
          updatedAt: new Date(),
        },
        $inc: {
          ...(sender === "employer"
            ? { unreadCountEmployee: 1 }
            : { unreadCountEmployer: 1 }),
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
      data: {
        chatId: chat._id,
        message: newMessage,
        unreadCountEmployer: chat.unreadCountEmployer,
        unreadCountEmployee: chat.unreadCountEmployee,
      },
    });
  } catch (error) {
    console.error("❌ Error in sendMessage:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Get chat messages by jobId, employeeId, and employerId
 * GET /employer/chat/messages?employeeId=xxx&employerId=xxx&jobId=xxx
 */
exports.getChatMessages = async (req, res) => {
  try {
    const { employeeId, employerId, jobId } = req.query;

    if (!employeeId || !employerId || !jobId) {
      return res.status(400).json({
        success: false,
        message: "employeeId, employerId, and jobId are required",
      });
    }

    const chat = await Chat.findOne({ employeeId, employerId, jobId })
      .populate("jobId", "jobTitle")
      .sort({ "messages.createdAt": 1 });

    if (!chat) {
      return res.status(200).json({
        success: true,
        data: {
          chatId: null,
          messages: [],
          employeeName: "",
          employeeImage: "",
          employerName: "",
          employerImage: "",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        chatId: chat._id,
        messages: chat.messages,
        employeeName: chat.employeeName,
        employeeImage: chat.employeeImage,
        employerName: chat.employerName,
        employerImage: chat.employerImage,
        unreadCountEmployer: chat.unreadCountEmployer,
        unreadCountEmployee: chat.unreadCountEmployee,
      },
    });
  } catch (error) {
    console.error("❌ Error in getChatMessages:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Get chat messages by jobId only
 * GET /employer/chats/:jobId
 */
exports.getChatMessagesByJobId = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { employeeId, employerId } = req.query;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "Job ID is required",
      });
    }

    let query = { jobId };
    if (employeeId && employerId) {
      query.employeeId = employeeId;
      query.employerId = employerId;
    }

    const chat = await Chat.findOne(query).sort({ "messages.createdAt": 1 });

    if (!chat) {
      return res.status(200).json({
        success: true,
        data: {
          chatId: null,
          messages: [],
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        chatId: chat._id,
        messages: chat.messages,
        employeeName: chat.employeeName,
        employeeImage: chat.employeeImage,
        employerName: chat.employerName,
        employerImage: chat.employerImage,
      },
    });
  } catch (error) {
    console.error("❌ Error in getChatMessagesByJobId:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Get all chats for an employer
 * GET /employer/chat/employer/:employerId
 */
exports.getChatsByEmployerId = async (req, res) => {
  try {
    const { employerId } = req.params;

    if (!employerId) {
      return res.status(400).json({
        success: false,
        message: "Employer ID is required",
      });
    }

    // Find chats and transform
    const chats = await Chat.find({ employerId })
      .sort({ updatedAt: -1 })
      .lean();

    const formattedChats = chats.map((chat) => ({
      _id: chat._id,
      employeeId: chat.employeeId,
      employeeName: chat.employeeName,
      employeeImage: chat.employeeImage,
      employerName: chat.employerName,
      employerImage: chat.employerImage,
      position: chat.position,
      jobId: chat.jobId,
      lastMessage: chat.lastMessage,
      lastMessageTime: chat.lastMessageTime,
      updatedAt: chat.updatedAt,
      unreadCountEmployer: chat.unreadCountEmployer,
      unreadCountEmployee: chat.unreadCountEmployee,
      latestMessage: chat.messages && chat.messages.length > 0
        ? chat.messages[chat.messages.length - 1]
        : null,
    }));

    return res.status(200).json({
      success: true,
      data: formattedChats,
      count: formattedChats.length,
    });
  } catch (error) {
    console.error("❌ Error in getChatsByEmployerId:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Get all chats for an employee
 * GET /employer/chat/employee/:employeeId
 */
exports.getChatsByEmployeeId = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    // Find chats and transform
    const chats = await Chat.find({ employeeId })
      .sort({ updatedAt: -1 })
      .lean();

    const formattedChats = chats.map((chat) => ({
      _id: chat._id,
      employerId: chat.employerId,
      employerName: chat.employerName,
      employerImage: chat.employerImage,
      employeeName: chat.employeeName,
      employeeImage: chat.employeeImage,
      position: chat.position,
      jobId: chat.jobId,
      lastMessage: chat.lastMessage,
      lastMessageTime: chat.lastMessageTime,
      updatedAt: chat.updatedAt,
      unreadCountEmployer: chat.unreadCountEmployer,
      unreadCountEmployee: chat.unreadCountEmployee,
      latestMessage: chat.messages && chat.messages.length > 0
        ? chat.messages[chat.messages.length - 1]
        : null,
    }));

    return res.status(200).json({
      success: true,
      data: formattedChats,
      count: formattedChats.length,
    });
  } catch (error) {
    console.error("❌ Error in getChatsByEmployeeId:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Mark messages as read
 * POST /employer/chat/mark-read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { employeeId, employerId, jobId, viewerType } = req.body;

    if (!employeeId || !employerId || !jobId || !viewerType) {
      return res.status(400).json({
        success: false,
        message:
          "employeeId, employerId, jobId, and viewerType are required",
      });
    }

    if (viewerType !== "employer" && viewerType !== "employee") {
      return res.status(400).json({
        success: false,
        message: "viewerType must be 'employer' or 'employee'",
      });
    }

    const chat = await Chat.findOne({ employeeId, employerId, jobId });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Mark messages as read
    const updateField =
      viewerType === "employer" ? "unreadCountEmployer" : "unreadCountEmployee";

    await Chat.updateOne(
      { _id: chat._id },
      {
        $set: {
          "messages.$[].isRead": true,
          [updateField]: 0,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (error) {
    console.error("❌ Error in markAsRead:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Get unread message count
 * GET /employer/chat/unread-count?employeeId=xxx&employerId=xxx&jobId=xxx&viewerType=employer
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const { employeeId, employerId, jobId, viewerType } = req.query;

    if (!employeeId || !employerId || !jobId || !viewerType) {
      return res.status(400).json({
        success: false,
        message:
          "employeeId, employerId, jobId, and viewerType are required",
      });
    }

    const chat = await Chat.findOne({ employeeId, employerId, jobId });

    if (!chat) {
      return res.status(200).json({
        success: true,
        unreadCount: 0,
      });
    }

    const unreadCount =
      viewerType === "employer"
        ? chat.unreadCountEmployer
        : chat.unreadCountEmployee;

    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error("❌ Error in getUnreadCount:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Delete a chat
 * DELETE /employer/chat/:chatId
 */
exports.deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findByIdAndDelete(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Chat deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error in deleteChat:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
