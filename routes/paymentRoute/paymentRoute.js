const express = require('express');
const router = express.Router();
const paymentController = require('../../controller/employeeController/paymentController');
const contactController = require('../../controller/employeeController/contactController');

router.post('/create-order', paymentController.createOrder);
router.get('/verify-payment', paymentController.verifyPayment);

// Route to generate hash
router.post('/generate-hash', paymentController.generateHash);

// Route for success callback
router.post('/success', paymentController.paymentSuccess);

// Route for failure callback
router.post('/failure', paymentController.paymentFailure);

router.post('/contact-us', contactController.submitContactForm);

module.exports = router;
