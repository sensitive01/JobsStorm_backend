const mongoose = require('mongoose');
const applicationSchema = new mongoose.Schema({
  applicantId: { type: String },
  firstName: { type: String },
  email: { type: String },
  phone: { type: String },
    experience: { type: String },
      notes: { type: String },
       interviewtype : { type: String },
        interviewdate : { type: String },
            interviewtime : { type: String },
                interviewlink : { type: String },
                 lastupdatestatusdate : { type: String },
                    interviewvenue : { type: String },
        statusHistory: [
    {
       interviewtype : { type: String },
        interviewdate : { type: String },
            interviewtime : { type: String },
                interviewlink : { type: String },
                    interviewvenue : { type: String },
      status: { type: String },
      notes: { type: String },
      updatedAt: { type: Date, default: Date.now }
    }
  ],
  currentcity: { type: String },
  jobrole:{ type: String },
  resume: {
    name: { type: String },
    url: { type: String }
  },
  favourite: { type: Boolean, default: false },
  status: { type: String },
   profileurl: { type: String },
    employapplicantstatus: { type: String, default: 'Pending' },
  appliedDate: { type: Date, default: Date.now },
  notes: { type: String }
});
const savedjobs = new mongoose.Schema({
  applicantId: { type: String },
  
  saved: { type: Boolean, default: false },
 
});
const jobSchema = new mongoose.Schema({
  // Basic Information
  companyName: { type: String, },
  employid: { type: String, },
  jobTitle: { type: String,  },
  description: { type: String,  },
  category: { type: String,  },
   applydatetime: { type: String,  },
  // Salary Information
  salaryFrom: { type: String, },
  salaryTo: { type: String,  },
  salaryType: { type: String, },
  applications: [applicationSchema],
  saved: [savedjobs],
  // Job Details
  jobType: { 
    type: String, 
  },
  experienceLevel: { 
    type: String, 
  },
  educationLevel: { 
    type: String, 
  },
  openings: { type: String,  },
  
  // Location Information
  locationTypes: { 
    type: [String], 
  
  },
  location: { type: String },
  isRemote: { type: Boolean, default: false },
  
  // Skills and Benefits
  skills: { type: [String], default: [] },
  benefits: { type: String },
  
  // Contact Information
  contactEmail: { 
    type: String, 
  
  
  },
  contactPhone: { type: String },
  companyUrl: { type: String },
  
  // Application Details
  applicationInstructions: { type: String },
  deadline: { type: Date },
  priority: { 
    type: String, 
    
  },
   status: { type: String, },
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
 postingstatus: { type: String, default: 'pending' },
  isActive: { type: Boolean, default: true }
});



const Job = mongoose.model('Job', jobSchema);

module.exports = Job;