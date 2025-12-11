const express = require("express");
const router = express.Router();
const controller = require("../../controller/employeeController/paymentController");

// FRONTEND hits this to create a PayU order
router.post("/order/create", controller.createOrder);

// PayU hits these after payment
router.post("/payu/success", controller.handlePayUSuccess);
router.post("/payu/failure", controller.handlePayUFailure);

module.exports = router;
