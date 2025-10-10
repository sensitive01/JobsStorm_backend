const mongoose = require('mongoose');

const employerSchema = new mongoose.Schema({
  uuid: { type: String, unique: true },
  googleId: String,
  appleId: String,
  schoolName: String,
  firstName: String,
  lastName: String,
  address: String, 
  organizationid:String,
  city: String, 
  state: String, 
  pincode: String, 
  otp: { type: String },
otpExpires: { type: Date },
emailverifedstatus: { type: Boolean, default: true },
  viewedEmployees: [{
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    viewedAt: { type: Date, default: Date.now }
  }],
  resumedownload: [{
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'employee' },
  viewedAt: { type: Date, default: Date.now }
}],
      employerfcmtoken: { type: [String], default: [] },
  institutionName: String, 
  board: String,
  institutionType: String, 
  website: String, 
  userEmail: { type: String, unique: true, sparse: true },
  userMobile: { type: String, unique: true, sparse: true },
  userPassword: String,
  userProfilePic: String,
  employerType: String,
  verificationstatus: { type: String, default: 'pending' },
 blockstatus: { type: String, default: 'unblock' },
  // Referral system fields
  referralCode: { type: String, unique: true, uppercase: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer' },
  referralCount: { type: Number, default: 0 },
  referralRewards: { type: Number, default: 0 },
  totalperdaylimit: { type: Number, default: 0 },
  totalprofileviews: { type: Number, default: 0 },
  totaldownloadresume: { type: Number, default: 0 },
  totaljobpostinglimit: { type: Number, default: 1 },
     subscriptions: {
    type: [{
      planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
      planDetails: { type: Object }, // Stores the full plan snapshot
      isTrial: Boolean,
      startDate: Date,
      endDate: Date,
      status: { type: String, enum: ['active', 'expired'], default: 'active' }
    }],
    default: []
  },
  currentSubscription: {
    type: {
      planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
      planDetails: { type: Object },
      isTrial: Boolean,
      startDate: Date,
      endDate: Date
    },
    default: null
  },
  isVerified: { type: Boolean, default: false },
    subscriptionleft: { type: Number, default: 0 },
   subscription: { type: String, default: "false" },
    trial : { type: String, default: "false" },
    subscriptionenddate: { type: String, },
  createdAt: { type: Date, default: Date.now }
});

// Generate referral code before saving
employerSchema.pre('save', function(next) {
  if (!this.referralCode) {
    this.referralCode = this.generateReferralCode();
  }
  next();
});

// Method to generate referral code
employerSchema.methods.generateReferralCode = function() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous characters
  let result = '';
  
  // First 3 characters from school name (if exists)
  if (this.schoolName) {
    result += this.schoolName.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  } else {
    for (let i = 0; i < 3; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  
  // Add random characters
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

module.exports = mongoose.model('Employer', employerSchema);
