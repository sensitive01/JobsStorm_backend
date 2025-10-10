const mongoose = require('mongoose');

const otpschma = new mongoose.Schema({
  userEmail: { type: String, required: true,  },
  otp: { type: String },
otpExpires: { type: Date },
emailverifedstatus: { type: Boolean, default: false },

      
  createdAt: { type: Date, default: Date.now }
});




module.exports = mongoose.model('otp', otpschma);