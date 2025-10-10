const mongoose = require('mongoose');

const helpRequestSchema = new mongoose.Schema({
  issue: { type: String, required: true },
  description: { type: String, required: true },
  employerid: { type: String, required: true },
  employeractive: { type: Boolean, default: true },
  date: { type: Date, default: Date.now },
  status: { type: String, default: 'Pending' },
  chatbox: [{
    employerid: String,
    message: String,
    image: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('HelpRequest', helpRequestSchema);
