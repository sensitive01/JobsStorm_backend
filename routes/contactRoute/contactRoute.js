const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController'); // Adjust path to controller

// POST /contact-us
router.post('/contact-us', contactController.submitContactForm);

module.exports = router;