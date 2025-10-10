const mongoose = require('mongoose');

// Subdocument schema for registrations
const registrationSchema = new mongoose.Schema({
  participantId: {
    type:String,
 
  },
  participantName: {
    type: String,
 
  },
  contactEmail: {
    type: String,
 
  },
  contactPhone: {
    type: String,
 
  },
  resumeLink: {
    type: String,
  },
  profileImage: {
    type: String
  },
  registrationStatus: {
    type: String,
   
  },
  status: {
    type: String,
   
  },
  registeredAt: {
    type: String,
  }
});

// Main event schema
const organizedEventSchema = new mongoose.Schema({
  organizerId: {

  },
  title: {
    type: String,
  

  },
  description: String,
  category: {
    type: String,
   
  },
  eventDate: {
    type: String,

  },
    eventendDate: {
    type: String,

  },
      totalattendes: {
    type: String,

  },
  startTime: {
    type: String,
 
  },
  endTime: {
    type: String,
 
  },
  venue: {
    type: String,

  },
  entryfee: {
    type: String,
 
  },
  coordinator: {
   
  },
  bannerImage: {
    type: String
  },
  totalRegistrations: {
    type: Number,
    default: 0
  },
  registrations: [registrationSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.OrganizedEvent || mongoose.model('OrganizedEvent', organizedEventSchema);
