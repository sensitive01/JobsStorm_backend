const express = require("express");
const employeeController = require("../../controller/employeeController/employeeController");
const { profileImageStorage, resumeStorage, coverLetterStorage,profileVideoStorage,audioStorage } = require("../../config/cloudinary");
const jobController = require ("../../controller/employerController/postjobcontroller");
const feedbackController = require ("../../controller/employeeController/feedbackreview");
const employeeRoute = express.Router();
const multer = require("multer");
const emailverifycontroller = require("../../controller/employerController/emailverfycontoller");
// Determine storage based on fileType
const getStorage = (fileType) => {
  switch (fileType) {
    case 'profileImage': return profileImageStorage;
    case 'resume': return resumeStorage;
    case 'coverLetter': return coverLetterStorage;
     case 'profileVideo': return profileVideoStorage; 
       case 'audio': return audioStorage; 
     
    default: return null;
  }
};

// Dynamic middleware for fileType-based upload
const dynamicUploadMiddleware = (req, res, next) => {
    const fileType = req.query.fileType || req.headers['filetype'] || req.body.fileType;

  const storage = getStorage(fileType);

  if (!storage) {
    return res.status(400).json({ message: 'Invalid or missing fileType' });
  }

  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  }).single('file');

  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size exceeds 10MB limit' });
      }
      return res.status(500).json({ message: 'Upload error', error: err.message });
    }
    next();
  });
};

employeeRoute.post('/sendemailotp', emailverifycontroller.sendOtpToEmail);
employeeRoute.post('/verifyemailotp', emailverifycontroller.verifyEmailOtp);

// Existing routes
employeeRoute.post('/signup', employeeController.signUp);
employeeRoute.post('/login', employeeController.login);
employeeRoute.post('/google', employeeController.googleAuth);
employeeRoute.post('/apple', employeeController.appleAuth);
employeeRoute.get('/fetchemployee/:id', employeeController.getEmployeeDetails);
employeeRoute.put(
  '/uploadprofilevideo/:employeeId',
  dynamicUploadMiddleware,
  employeeController.uploadProfileVideo
);

employeeRoute.put('/uploadintroaudio/:employeeId', dynamicUploadMiddleware, employeeController.uploadIntroAudio);

employeeRoute.get('/fetchallemployee', employeeController.getAllEmployees);
// Upload file to Cloudinary
employeeRoute.put(
  '/uploadfile/:employid',
  dynamicUploadMiddleware,
  employeeController.uploadFile
);

// Update profile
employeeRoute.put('/updateprofile/:employid', employeeController.updateProfile);
employeeRoute.post('/:jobId/apply',employeeController.applyForJob);
employeeRoute.get('/job/:jobId/application/:applicantId/status', employeeController.getApplicationStatus);

employeeRoute.get('/applicant/:applicantId', employeeController.appliedjobsfetch);
employeeRoute.get('/fetchshorlitstedjobsemployee/:applicantId', jobController.getJobsWithNonPendingApplications);
employeeRoute.get('/percentage/:id', employeeController.getProfileCompletion);
employeeRoute.get("/getfeedback", feedbackController.fetchFeedback);
employeeRoute.post("/createfeedback", feedbackController.addFeedback);
employeeRoute.get("/feedbackbyid/:userId", feedbackController.fetchFeedbackByUserId);
employeeRoute.put("/updatefeedback/:userId", feedbackController.updateFeedback);

employeeRoute.post("/forgotpassword",employeeController.userForgotPassword)
employeeRoute.post("/verify-otp",employeeController.verifyOTP)
employeeRoute.post("/resend-otp",employeeController.userForgotPassword)
employeeRoute.post("/change-password",employeeController.userChangePassword)
employeeRoute.put("/employeee-change-password/:candidateId",employeeController.candidateChangePassword)
employeeRoute.get(
  "/verify-the-candidate-register-or-not/:candidateEmail",
  employeeController.verifyTheCandidateRegisterOrNot
);


employeeRoute.get("/get-job-alerts",employeeController.getDesiredJobAlerts)
employeeRoute.post("/add-job-alert",employeeController.addJobAlert)
employeeRoute.post("/addjobtoken",employeeController.addwithouttoeken)
employeeRoute.get("/getalretjobs",employeeController.getDesiredJobAlertswithouttoken)
employeeRoute.get('/fetchAvailabilityStatus/:employeeId', employeeController.fetchAvailabilityStatus);
employeeRoute.put('/updateAvailabilityStatus/:employeeId', employeeController.updateAvailabilityStatus);

module.exports = employeeRoute;