const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, required: true },
  recipientType: { type: String, required: true, enum: ['employee', 'employer'] },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  senderType: { type: String, required: true, enum: ['employee', 'employer'] },
  title: { type: String, required: true },
  body: { type: String, required: true },
  image: { type: String },
  data: { type: mongoose.Schema.Types.Mixed }, // Additional data payload
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  readAt: { type: Date }
});

module.exports = mongoose.model('Notification', notificationSchema);