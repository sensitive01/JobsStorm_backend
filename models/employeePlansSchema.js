const mongoose = require('mongoose');

const employeePlanSchema = new mongoose.Schema({
  planId: {
    type: String,
    required: true,
    unique: true,
    enum: ["silver", "gold", "platinum"]
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    default: 0
  },
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  gst: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0
  },
  priceText: {
    type: String,
    required: true
  },
  displayPrice: {
    type: String,
    required: true
  },
  validity: {
    type: String,
    default: null
  },
  validityMonths: {
    type: Number,
    required: true,
    default: 0
  },
  color: {
    type: String,
    default: "#9E9E9E"
  },
  features: {
    applyToJobs: { type: Boolean, default: true },
    priorityToRecruiters: { 
      type: String, 
      enum: ["none", "medium", "highest"],
      default: "none"
    },
    immediateInterviewCall: { type: Boolean, default: false },
    profileBoosted: { type: Boolean, default: false },
    dedicatedAccountManager: { type: Boolean, default: false },
    resumeReview: { type: Number, default: 0 },
    emailSmsConfirmation: { type: Boolean, default: true },
    subscriptionCard: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt before saving
employeePlanSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const EmployeePlan = mongoose.model('EmployeePlan', employeePlanSchema);

module.exports = EmployeePlan;

