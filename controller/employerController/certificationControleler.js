// controllers/trainingController.js
const Training = require('../../models/certificationSchema');


// POST: Create a new training
exports.createTraining = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      paymentStatus,
      paidAmount,
      subCategories
    } = req.body;

    const newTraining = new Training({
      title,
      description,
      status,
      paymentStatus,
      paidAmount,
      subCategories
    });

    const savedTraining = await newTraining.save();
    res.status(201).json(savedTraining);
  } catch (error) {
    console.error('Error creating training:', error);
    res.status(500).json({ message: 'Server error while creating training.' });
  }
};


// Get All Trainings
exports.getAllTrainings = async (req, res) => {
  try {
    const trainings = await Training.find(); // You can use .lean() for better performance
    res.status(200).json(trainings);
  } catch (error) {
    console.error('Error fetching trainings:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.getTrainingSubCategories = async (req, res) => {
  try {
    const trainingId = req.params.id;

    const training = await Training.findById(trainingId).select('subCategories');

    if (!training) {
      return res.status(404).json({ message: 'Training not found' });
    }

    res.status(200).json(training.subCategories);
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
// Get Certification by ID
exports.enrollEmployer = async (req, res) => {
  try {
    const trainingId = req.params.id;
    const { employerId, employername, paidAmount, transactionId, email, phone } = req.body;

    const training = await Training.findById(trainingId);
    if (!training) {
      return res.status(404).json({ message: 'Training not found' });
    }

    // Check if already enrolled
    const alreadyEnrolled = training.enrollerList.some(
      (e) => e.employerId === employerId
    );
    if (alreadyEnrolled) {
      return res.status(400).json({ message: 'Employer already enrolled in this training.' });
    }

    // Add to enrollerList
    training.enrollerList.push({ employerId, employername, paidAmount, transactionId, email, phone });
    await training.save();

    res.status(200).json({ message: 'Employer enrolled successfully', training });
  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
// Controller function
exports.checkEmployerEnrollment = async (req, res) => {
  try {
    const trainingId = req.params.trainingId;
    const employerId = req.params.employerId;

    const training = await Training.findById(trainingId);
    if (!training) {
      return res.status(404).json({ message: 'Training not found' });
    }

    const isEnrolled = training.enrollerList.some(
      (e) => e.employerId === employerId
    );

    if (isEnrolled) {
      return res.status(200).json({ status: 'enrolled' });
    } else {
      return res.status(200).json({ status: 'not enrolled' });
    }
  } catch (error) {
    console.error('Check enrollment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Enroll

