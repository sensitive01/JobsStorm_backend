const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g., "Degree", "Diploma"
  degree: { type: String, required: true }, // e.g., "Bachelor of Science"
  institution: { type: String, required: true },
  startDate: { type: String, required: true }, // MM/YYYY format
  endDate: { type: String }, // MM/YYYY format (optional)
});

const workExperienceSchema = new mongoose.Schema({
  position: { type: String, required: true },
  company: { type: String, required: true },
  employmentType: { type: String, required: true }, // "Full-time", "Part-time", etc.
  startDate: { type: String, required: true }, // MM/YYYY format
  endDate: { type: String }, // MM/YYYY format (optional)
  description: { type: String },
});
const mediaSchema = new mongoose.Schema({
  name: { type: String },
  url: { type: String },
  type: { type: String, enum: ['audio', 'video', 'image'] },
  duration: { type: Number }, // in seconds for audio/video
  thumbnail: { type: String }, // for videos
  createdAt: { type: Date, default: Date.now }
});

const employeeschema = new mongoose.Schema({
  uuid: String,
  googleId: String,
    otp: { type: String },
otpExpires: { type: Date },
emailverifedstatus: { type: Boolean, default: true },

   employeefcmtoken: { type: [String], default: [] },
  appleId: String,
  userName: String,
  userEmail: String,
  userMobile: String,  
    audioFiles: [mediaSchema], // Array of audio files
  videoFiles: [mediaSchema], 
    profileVideo: { // Optional profile video
    name: { type: String },
    url: { type: String },
    thumbnail: { type: String },
    duration: { type: Number }
  },
  introductionAudio: { // Optional audio introduction
    name: { type: String },
    url: { type: String },
    duration: { type: Number }
  },            // <-- Add this
  userPassword: String,            // <-- Add this
  userProfilePic: String,
  currentrole: { type: String,  }, // Default role is 'employee'
  isVerified: { type: Boolean, default: false },
   gender: { type: String, enum: ['Male', 'Female', 'Others'] },
  dob: { type: String }, // DD/MM/YYYY format
  addressLine1: { type: String },
  addressLine2: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
  preferredLocation: { type: String },
  specialization: { type: String },
  gradeLevels: { type: [String] }, // Array of grade levels
  coverLetter: { type: String },
  skills: { type: [String] }, // Array of skills
  education: [educationSchema],
  workExperience: [workExperienceSchema],
resume: {
    name: { type: String },
    url: { type: String },
  },
  coverLetterFile: {
    name: { type: String },
    url: { type: String },
  },
  referralCode: { type: String, unique: true }, 
  profilesummary: { type: String },
  profileImage: { type: String }, // URL to profile image
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
   languages: [String],
    maritalStatus:  String,
    isAvailable: { type: Boolean, default: false },
  github: String ,
  linkedin:   String ,
  portfolio:  String ,
  expectedSalary: Number ,
  currentCity:  String ,
totalExperience: mongoose.Schema.Types.Mixed,
  referredBy: { type: mongoose.Schema.Types.ObjectId, },
  referralCount: { type: Number, default: 0 },
  referralRewards: { type: Number, default: 0 },
    verificationstatus: { type: String, default: 'pending' },
  blockstatus: { type: String, default: 'unblock' },
});
employeeschema.methods.generateReferralCode = function () {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';

  // Example using first letters of userName (since there's no schoolName in this schema)
  if (this.userName) {
    result += this.userName.replace(/\s+/g, '').substring(0, 3).toUpperCase();
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

module.exports = mongoose.model('employee', employeeschema);
