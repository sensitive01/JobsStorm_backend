const mongoose = require("mongoose");

// const mongoose = require("mongoose");

const savedCandidateSchema = new mongoose.Schema({
  employerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employer", // make sure your Employer model is named "Employer"
    required: true,
  },
  employeeIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "employee", // match your actual Employee model
      required: true,
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("SavedCandidate", savedCandidateSchema);

// module.exports = mongoose.model("SavedCandidate", savedCandidateSchema);
