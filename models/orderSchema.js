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
    enum: ['created', 'paid', 'failed'],
    default: 'created',
  },
  employerid: String, // legacy
  employeeId: String, // for employee subscriptions
  planType: String, // e.g., silver/gold/platinum
  type: {
    type: String,
    default: 'employee_subscription',
  },
  paymentId: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Ordersss', orderSchema);
