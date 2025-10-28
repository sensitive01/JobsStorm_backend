const mongoose = require("mongoose");

// Application schema for job applicants
const applicationSchema = new mongoose.Schema({
  applicantId: { type: String },
  firstName: { type: String },
  email: { type: String },
  phone: { type: String },
  experience: { type: String },
  notes: { type: String },
  interviewType: { type: String },
  interviewDate: { type: Date },
  interviewTime: { type: String },
  interviewLink: { type: String },
  interviewVenue: { type: String },
  lastUpdateStatusDate: { type: Date },
  statusHistory: [
    {
      interviewType: { type: String },
      interviewDate: { type: Date },
      interviewTime: { type: String },
      interviewLink: { type: String },
      interviewVenue: { type: String },
      status: { type: String },
      notes: { type: String },
      updatedAt: { type: Date, default: Date.now },
    },
  ],
  currentCity: { type: String },
  jobRole: { type: String },
  resume: {
    name: { type: String },
    url: { type: String },
  },
  favourite: { type: Boolean, default: false },
  status: { type: String },
  profileUrl: { type: String },
  employApplicantStatus: { type: String, default: "Pending" },
  appliedDate: { type: Date, default: Date.now },
  notes: { type: String },
  coverLetter:{ type: String }
});

// Saved jobs schema
const savedJobsSchema = new mongoose.Schema({
  applicantId: { type: String },
  saved: { type: Boolean, default: false },
});

// Main Job schema
const jobSchema = new mongoose.Schema(
  {
    jobId:{type:String},
    // Basic Info
    companyName: { type: String, },
    employId: { type: String }, 
    jobTitle: { type: String, },
    description: { type: String, },
    category: { type: String, },
    position: { type: String }, // Junior, Senior, etc
    vacancy: { type: Number }, // vacancy
    jobType: { type: String }, // Full-time, Part-time
    experienceLevel: { type: String },
    educationLevel: { type: String },
    responsibilities:[],
    qualifications:[],
    locationTypes:[],
    isRemote:{type:Boolean},
    jobDescription:{type: String},
    companyWebsite:{type:String},

    // Salary
    salaryFrom: { type: Number },
    salaryTo: { type: Number },
    salaryType: { type: String }, // monthly, yearly, etc

    // Application info
    applicationInstructions: { type: String },
    deadline: { type: Date },

    // Location info
    location: { type: String },
    companyAddress: { type: String },
    locationTypes: { type: [String], default: [] }, // On-site, Remote, Hybrid
    isRemote: { type: Boolean, default: false },

    // Benefits & Skills
    benefits: { type: String },
    skills: { type: [String], default: [] },

    // Contact info
    contactEmail: { type: String, },
    contactPhone: { type: String },
    companyUrl: { type: String },

    // Metadata
    applications: [applicationSchema],
    saved: [savedJobsSchema],
    status: { type: String, default: "open" },
    postingStatus: { type: String, default: "pending" },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
); // auto-manage createdAt and updatedAt

const Job = mongoose.model("Job", jobSchema);

module.exports = Job;
