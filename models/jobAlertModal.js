const mongoose = require("mongoose");

const JobFilterSchema = new mongoose.Schema(
  {
    salaryFrom: {
      type: Number,
      required: false,
    },
    salaryTo: {
      type: Number,
      required: false,
    },
    location: {
      type: String,
      required: false,
      trim: true,
    },
    workType: {
      type: String,
      enum: ["work_from_home", "on_site", "hybrid"],
      default: "work_from_home",
    },
    experience: {
      type: String,
      required: false,
      trim: true,
    },
    jobCategories: {
      type: [String],
      default: [],
    },
    userId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("JobFilter", JobFilterSchema);
