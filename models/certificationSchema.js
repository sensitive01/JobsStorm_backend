// models/Training.js
const mongoose = require('mongoose');

// Enroller Schema
const enrollerSchema = new mongoose.Schema({
    email: { type: String },
      phone: { type: String },
  employerId: { type: String },
  employername: { type: String },
  paidAmount: { type: String },
  transactionId: { type: String }
}, { _id: false });

// SubCategory Schema
const subCategorySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

// Main Training Schema
const trainingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String },
  paymentStatus: { type: String,  },
  paidAmount: { type: String,  },
  subCategories: [subCategorySchema],
  enrollerList: [enrollerSchema],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Training', trainingSchema);
