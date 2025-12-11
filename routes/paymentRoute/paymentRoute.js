const express = require("express");
const router = express.Router();
const paymentController = require("../../controller/employeeController/paymentController");

// Create order (initiate payment)
router.post("/create-order", paymentController.createOrder);

// ✅ Single unified callback for both success and failure
router.post("/payu/callback", paymentController.handlePayUCallback);

// Get user subscription (optional)
router.get("/subscription/:employeeId", paymentController.getUserSubscription);

router.get("/payu/redirect", paymentController.handlePayURedirect);


module.exports = router;