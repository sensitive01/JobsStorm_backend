const mongoose = require("mongoose");

const employerSchema = new mongoose.Schema({
  // 🔹 Basic Identifiers
  uuid: { type: String, unique: true },
  googleId: String,
  appleId: String,


  
  // 🔹 Contact Details
  contactPerson: String,
  contactEmail: String,
  mobileNumber: String,
  password: String,
  userProfilePic: String,

  // 🔹 Organization / Institution Details
  companyName: String,
  organizationid: String,
  website: String,
  address: String,
  city: String,
  state: String,
  pincode: String,

  // 🔹 Authentication & Verification
  otp: String,
  otpExpires: Date,
  emailverifedstatus: { type: Boolean, default: true },
  verificationstatus: { type: String, default: "pending" },
  isVerified: { type: Boolean, default: false },
  blockstatus: { type: String, default: "unblock" },

  // 🔹 FCM / Notifications
  employerfcmtoken: { type: [String], default: [] },

  // 🔹 Activity Tracking
  viewedEmployees: [
    {
      employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
      viewedAt: { type: Date, default: Date.now },
    },
  ],
  resumedownload: [
    {
      employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
      viewedAt: { type: Date, default: Date.now },
    },
  ],

  // 🔹 Referral System
  referralCode: { type: String, unique: true, uppercase: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employer" },
  referralCount: { type: Number, default: 0 },
  referralRewards: { type: Number, default: 0 },

  // 🔹 Usage & Limits
  totalperdaylimit: { type: Number, default: 0 },
  totalprofileviews: { type: Number, default: 0 },
  totaldownloadresume: { type: Number, default: 0 },
  totaljobpostinglimit: { type: Number, default: 1 },

  // 🔹 Subscription System
  subscriptions: {
    type: [
      {
        planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
        planDetails: { type: Object }, // Snapshot of plan details
        isTrial: Boolean,
        startDate: Date,
        endDate: Date,
        status: {
          type: String,
          enum: ["active", "expired"],
          default: "active",
        },
      },
    ],
    default: [],
  },

  currentSubscription: {
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
    planDetails: { type: Object },
    isTrial: Boolean,
    startDate: Date,
    endDate: Date,
  },

  subscriptionleft: { type: Number, default: 0 },
  subscription: { type: String, default: "false" },
  trial: { type: String, default: "false" },
  subscriptionenddate: String,

  // 🔹 Timestamps
  createdAt: { type: Date, default: Date.now },
});

// 🔹 Generate referral code before saving
employerSchema.pre("save", function (next) {
  if (!this.referralCode) {
    this.referralCode = this.generateReferralCode();
  }
  next();
});

// 🔹 Method to generate referral code
employerSchema.methods.generateReferralCode = function () {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid ambiguous chars
  let result = "";

  // First 3 chars from school name (if exists)
  if (this.schoolName) {
    result += this.schoolName.replace(/\s+/g, "").substring(0, 3).toUpperCase();
  } else {
    for (let i = 0; i < 3; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }

  // Add 5 random chars
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
};

module.exports = mongoose.model("Employer", employerSchema);
