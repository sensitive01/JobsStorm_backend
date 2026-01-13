const Contact = require('../../models/contactSchema'); // Adjust path to your model

// Submit Contact Form
exports.submitContactForm = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Validate request
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'All fields (Name, Email, Phone/Subject, Course/Message) are required.'
            });
        }

        // Create new entry
        const newContact = new Contact({
            name,
            email,
            subject, // Storing Phone Number
            message  // Storing Course Information
        });

        await newContact.save();

        res.status(201).json({
            success: true,
            message: 'Your query has been submitted successfully!',
            data: newContact
        });

    } catch (error) {
        console.error('Error submitting contact form:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error. Please try again later.',
            error: error.message
        });
    }
};