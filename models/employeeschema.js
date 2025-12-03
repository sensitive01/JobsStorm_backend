const mongoose = require("mongoose");

// 🔹 Education Subschema
const educationSchema = new mongoose.Schema({
  type: { type: String },
  degree: { type: String },
  institution: { type: String },
  startDate: { type: String },
  endDate: { type: String },
});

// 🔹 Work Experience Subschema
const workExperienceSchema = new mongoose.Schema({
  position: { type: String },
  company: { type: String },
  employmentType: { type: String },
  startDate: { type: String },
  endDate: { type: String },
  description: String,
});

// 🔹 Media Subschema
const mediaSchema = new mongoose.Schema({
  name: String,
  url: String,
  type: { type: String, enum: ["audio", "video", "image"] },
  duration: Number,
  thumbnail: String,
  createdAt: { type: Date, default: Date.now },
});

// 🔹 Main Employee Schema
const employeeSchema = new mongoose.Schema({

  // 🧾 Identifiers
  uuid: String,
  googleId: String,
  appleId: String,

  // 🔐 Authentication & Verification
  userPassword: String,
  otp: String,
  otpExpires: Date,
  emailverifedstatus: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  verificationstatus: { type: String, default: "pending" },
  blockstatus: { type: String, default: "unblock" },

  // 🔔 Notification Tokens
  employeefcmtoken: { type: [String], default: [] },

  // 👤 Personal Info
  userName: String,
  gender: { type: String, enum: ["Male", "Female", "Others"] },
  dob: String,
  maritalStatus: String,
  nationality: String,
  passportNumber: String,
  passportExpiryDate: Date,
  location: String,
  languages: [String],

  // 📍 Address & Location
  addressLine1: String,
  addressLine2: String,
  city: String,
  state: String,
  pincode: String,
  currentCity: String,
  preferredLocation: String,
  countryCode: String,

  // 📞 Contact
  userEmail: String,
  userMobile: String,

  // 🏢 Professional Details
  currentrole: String,
  specialization: String,
  gradeLevels: [String],
  totalExperience: mongoose.Schema.Types.Mixed,
  expectedSalary: Number,
  isAvailable: { type: Boolean, default: false },

  // 🎓 Education & Work
  education: [educationSchema],
  workExperience: [workExperienceSchema],

  // 🧠 Skills & Summary
  skills: [String],
  profilesummary: String,
  coverLetter: String,

  // 📁 Documents
  resume: { name: String, url: String },
  coverLetterFile: { name: String, url: String },
  passport: { name: String, url: String },
  educationCertificate: { name: String, url: String },
  policeClearance: { name: String, url: String },
  mofaAttestation: { name: String, url: String },

  // 🖼️ Media
  audioFiles: [mediaSchema],
  videoFiles: [mediaSchema],

  // 🎥 Profile Media
  profileVideo: {
    name: String,
    url: String,
    thumbnail: String,
    duration: Number,
  },
  introductionAudio: {
    name: String,
    url: String,
    duration: Number,
  },

  // 🌐 Online Presence
  github: String,
  linkedin: String,
  portfolio: String,

  // 🏅 Referral
  referralCode: { type: String, unique: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employer" },
  referralCount: { type: Number, default: 0 },
  referralRewards: { type: Number, default: 0 },

  // 📸 Profile Image
  userProfilePic: { name: String, url: String },
  profileImage: String,

  // 💾 Saved Jobs
  savedJobs: [{ type: String }],

  // 🎫 SUBSCRIPTION CARD (✅ ADDED)
  subscription: {
    cardNumber: { type: String, unique: true },
    expiryMonth: String,
    expiryYear: String,
    issuedAt: Date,
    status: { type: String, default: "active" } // active | expired | blocked
  },

  // 🕓 Meta
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// 🔹 Referral Code Generator
employeeSchema.methods.generateReferralCode = function () {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  if (this.userName) {
    result += this.userName.replace(/\s+/g, "").substring(0, 3).toUpperCase();
  } else {
    for (let i = 0; i < 3; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }

  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
};

module.exports = mongoose.model("Employee", employeeSchema);
