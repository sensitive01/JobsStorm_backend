const mongoose = require("mongoose");

// 🔹 Education Subschema
const educationSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g., "Degree", "Diploma"
  degree: { type: String, required: true }, // e.g., "B.Sc", "B.Ed"
  institution: { type: String, required: true },
  startDate: { type: String, required: true }, // MM/YYYY
  endDate: { type: String }, // MM/YYYY (optional)
});

// 🔹 Work Experience Subschema
const workExperienceSchema = new mongoose.Schema({
  position: { type: String, required: true },
  company: { type: String, required: true },
  employmentType: { type: String, required: true }, // "Full-time", "Part-time"
  startDate: { type: String, required: true }, // MM/YYYY
  endDate: { type: String }, // MM/YYYY (optional)
  description: String,
});

// 🔹 Media Subschema (Audio / Video / Image)
const mediaSchema = new mongoose.Schema({
  name: String,
  url: String,
  type: { type: String, enum: ["audio", "video", "image"] },
  duration: Number, // in seconds (for audio/video)
  thumbnail: String, // video thumbnail
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
  dob: String, // DD/MM/YYYY
  maritalStatus: String,
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
  totalExperience: mongoose.Schema.Types.Mixed, // flexible format
  expectedSalary: Number,
  isAvailable: { type: Boolean, default: false },

  // 🎓 Education & Work Experience
  education: [educationSchema],
  workExperience: [workExperienceSchema],

  // 🧠 Skills & Summary
  skills: [String],
  profilesummary: String,
  coverLetter: String,

  // 📁 Uploaded Files
  resume: {
    name: String,
    url: String,
  },
  coverLetterFile: {
    name: String,
    url: String,
  },

  // 🖼️ Media (Audio / Video / Image)
  audioFiles: [mediaSchema],
  videoFiles: [mediaSchema],

  // 🎥 Profile Media (Intro)
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

  // 🏅 Referral System
  referralCode: { type: String, unique: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employer" },
  referralCount: { type: Number, default: 0 },
  referralRewards: { type: Number, default: 0 },

  // 📸 Profile
  userProfilePic: String,
  profileImage: String,

  // 🕓 Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// 🔹 Referral Code Generator
employeeSchema.methods.generateReferralCode = function () {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid ambiguous chars
  let result = "";

  // Use first 3 letters of userName if available
  if (this.userName) {
    result += this.userName.replace(/\s+/g, "").substring(0, 3).toUpperCase();
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

module.exports = mongoose.model("Employee", employeeSchema);
