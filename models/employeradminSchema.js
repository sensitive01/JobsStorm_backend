const mongoose = require('mongoose');

const employeradminSchema = new mongoose.Schema({
  uuid: { type: String, },
  employeradminUsername: { type: String, },
  employeradminEmail: { type: String,   },
  employeradminMobile: { type: String,  },
  employeradminPassword: { type: String,  }, // hash before saving!
  employeradminProfilePic: { type: String },
otp: { type: String },
otpExpiry: { type: Date },
 verificationstatus: { type: String, default: 'pending' },
  blockstatus: { type: String, default: 'unblock' },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Exporting the model
module.exports = mongoose.model('employerAdmin', employeradminSchema);
