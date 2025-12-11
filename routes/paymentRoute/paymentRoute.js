const express = require('express');
const paymentRoute = express.Router();
const candidateOrderController = require('../../controller/employeeController/paymentController'); // Adjusted path

// Create Order for Payment
paymentRoute.post('/order/create', candidateOrderController.createOrder);

// Verify Payment after success
paymentRoute.post('/order/verify', candidateOrderController.verifyPayment);

// NEW: Handle PayU Redirect (This matches the surl/furl in the controller)
// paymentRoute.post('/payu-response', candidateOrderController.handlePayUResponse);

module.exports = paymentRoute;