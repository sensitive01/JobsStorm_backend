const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: String,
  amount: Number,
  currency: {
    type: String,
    default: 'INR',
  },
  status: {
    type: String,
    enum: ['created', 'paid', 'failed', 'cancelled',"pending"],
    default: 'created',
  },
  employerid: String, // legacy
  employeeId: String, // for employee subscriptions
  planType: String, // e.g., silver/gold/platinum/starter/premium/special
  planId: String,
  type: {
    type: String,
    default: 'employee_subscription',
  },
  paymentId: String,
  // Subscription validity (for convenience/history)
  subscriptionStart: Date,
  subscriptionEnd: Date,
  // Payment details
  paymentMethod: String, // e.g., 'netbanking', 'card', 'upi', 'wallet'
  paymentResponse: {
    type: mongoose.Schema.Types.Mixed, // Store full PayU response
  },
  errorMessage: String, // Store error message if payment fails
  verifiedAt: Date, // When payment was verified
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Ordersss', orderSchema);
