const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  employerid: {
    type: String,

  },
  name: {
    type: String,
    required: true,

  },
  price: {
    type: Number,
    required: true
  },
  gstPercentage: {
    type: Number,
    default: 18
  },
  perDayLimit: {
    type: Number,
    required: true
  },
  profileViews: {
    type: Number,
    required: true
  },
  downloadResume: {
    type: Number,
    required: true
  },
  verifiedCandidateAccess: {
    type: Boolean,
    default: false
  },
  jobPostingLimit: {
    type: Number,
    required: true
  },
  candidatesLiveChat: {
    type: Boolean,
    default: false
  },
  hasAds: {
    type: Boolean,
    default: true
  },
  validityDays: {
    type: Number,
    required: true
  },
  hasDRM: {
    type: Boolean,
    default: false
  },
  accessToWebinars: {
    type: Boolean,
    default: false
  },
  interviewType: {
    type: String,

    required: true
  },
  accessToRecruitmentFair: {
    type: Boolean,
    default: true
  },
  customerSupport: {
    type: Boolean,
    default: true
  },
  fastTrackSupport: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tagline: {
    type: String,
    trim: true
  },
  iconType: {
    type: String,
    enum: ["bolt", "star", "shield"],
    default: "bolt"
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  buttonText: {
    type: String,
    default: "Current Plan"
  },
  billingCycle: {
    type: String,
    enum: ["monthly", "yearly", "custom"],
    default: "monthly"
  },
  featuresList: [{
    text: { type: String, required: true },
    included: { type: Boolean, default: true }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate total price with GST
planSchema.virtual('totalPrice').get(function () {
  return this.price + (this.price * this.gstPercentage / 100);
});

const Plan = mongoose.model('Plan', planSchema);

module.exports = Plan;