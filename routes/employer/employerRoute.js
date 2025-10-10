const express = require("express");
const multer = require("multer");
const employerRoute = express();
const meetingController = require("../../controller/employerController/meetingController")
const employerController = require("../../controller/employerController/employerController");
const jobController = require ("../../controller/employerController/postjobcontroller");
// const { profileImageStorage, resumeStorage, coverLetterStorage,chatImageStorage,eventImageStorage ,sendimage } = require("../../config/cloudinary");
const eventController = require("../../controller/employerController/calendarControllers");
const eventsController = require("../../controller/employerController/upcomeevent");
const emailverifycontroller = require("../../controller/employerController/emailverfycontoller");
const helpcontroller = require("../../controller/employerController/employerhelpController");
const chatController = require("../../controller/employerController/chatController");
const certificatecontroller = require('../../controller/employerController/certificationControleler');
const savecontroller = require('../../controller/employerController/savedCandiateControlller');
const OrderController = require("../../controller/employeeController/orderController");
const memoryUpload = multer({ storage: multer.memoryStorage() }).single('file');
const {
  profileImageStorage,
  resumeStorage,
  coverLetterStorage,
  chatImageStorage,
  chatAudioStorage,
  eventImageStorage,
  sendimage,
} = require('../../config/cloudinary');

const getStorage = (fileType) => {
  switch (fileType) {
    case 'profileImage': return profileImageStorage;
    case 'resume': return resumeStorage;
    case 'coverLetter': return coverLetterStorage;
    case '3': return chatImageStorage;
    case 'chatAudio': return chatAudioStorage;
    case 'eventimage': return eventImageStorage;
    case 'send': return sendimage;
    default: return null;
  }
};

const dynamicUploadMiddleware = (req, res, next) => {
  console.log("Iam in upload file",req.file)
  const fileType = req.body.fileType || req.query.fileType;
  const storage = getStorage(fileType);

  if (!storage) {
    console.log(`❌ Unsupported or missing fileType: "${fileType}"`);
    return next(); // Let it continue without upload if no fileType
  }

  const upload = multer({ storage }).single('file');

  upload(req, res, function (err) {
    if (err) {
      console.error('❌ Multer Error:', err);
      return res.status(400).json({ success: false, message: 'File upload failed', error: err.message });
    }
    next();
  });
};

const dynamicUploadMiddlewareNew = (req, res, next) => {
  memoryUpload(req, res, async function (err) {
    if (err) {
      console.error('❌ Memory upload failed:', err);
      return res.status(400).json({ success: false, message: 'Upload failed', error: err.message });
    }

    const fileType = req.body.fileType || req.query.fileType;

    console.log('✅ fileType:', fileType);
    console.log('✅ file:', req.file);
    console.log('✅ body:', req.body);

    if (!req.file) {
      console.warn('⚠️ No file uploaded');
    }

    return next();
  });
};

employerRoute.put('/decreaseProfileView/:employerId/:employeeId', employerController.decreaseProfileView);
employerRoute.put('/decrease/:employerId/:employeeId', employerController.decreaseResumeDownload);
employerRoute.post('/sendemailotp', emailverifycontroller.sendOtpToEmail);
employerRoute.post('/verifyemailotp', emailverifycontroller.verifyEmailOtp);

employerRoute.post('/signup', employerController.signUp);

// Email/Mobile Login
employerRoute.post('/login', employerController.login);

// Google Sign-In
employerRoute.post('/google', employerController.googleAuth);

// Apple Sign-In
employerRoute.post('/apple', employerController.appleAuth);
employerRoute.get('/fetchemployer/:id', employerController.getEmployerDetails);
employerRoute.put("/updateemployer/:id", employerController.updateEmployerDetails);
employerRoute.put('/uploadprofilepic/:employid', dynamicUploadMiddleware, employerController.updateProfilePicture);


employerRoute.post('/postjob', jobController.createJob);
employerRoute.get('/fetchjobs', jobController.getAllJobs);
employerRoute.get("/viewjobs/:id", jobController.getJobById);
employerRoute.get("/fetchjob/:employid", jobController.getJobsByEmployee);
employerRoute.get("/fetchappliedcand/:id", jobController.getAppliedCandidates);
employerRoute.get("/fetchfavcand/:employid", jobController.getFavouriteCandidates);

employerRoute.get('/listallemployer', employerController.listAllEmployees);
// employerRoute.put('/updatefavoritesave/:employid/:applicantId', jobController.updateFavStatusforsavecand);
employerRoute.get("/fetchshortlistcand/:id", jobController.shortlistcand);
employerRoute.put('/updatefavorite/:jobId/:applicantId', jobController.updateFavoriteStatus);
// employerRoute.put('/update-status/:jobId/:applicantId', jobController.updateApplicantStatus);
employerRoute.put('/update-status/:applicationId/:applicantId', jobController.updateApplicantStatus);

employerRoute.get("/fetchallnonpending/:employid", jobController.getNonPendingApplicantsByEmployId);

employerRoute.get("/viewallappliedcandi/:employid", jobController.getAllApplicantsByEmployId);
// employerRoute.put('/updaee/:applicationId/:employid', jobController.updateFavStatusforsavecand);

employerRoute.put('/updaee/:applicationId/:employid', jobController.updateFavStatusforsavecand);

employerRoute.get('/fetchAllJobs', jobController.fetchAllJobs);
employerRoute.post('/toggleSaveJob', jobController.toggleSaveJob);
employerRoute.get('/fetchSavedJobs/:employid', jobController.fetchSavedJobslist);
employerRoute.get('/fetchschooljobs', jobController.getSchoolEmployerJobs);
employerRoute.get('/fetchcompanyjobs', jobController.getcompnanyEmployerJobs);
employerRoute.get('/fetchjobtitle/:jobId', jobController.getJobTitleByJobId);
employerRoute.put('/editjob/:id', jobController.updateJobById);

employerRoute.post("/createmeeting", meetingController.create);
employerRoute.get("/fetchmeeting/:id", meetingController.getMeetingsByVendor);

employerRoute.post("/employerforgotpassword",employerController.employerForgotPassword)
employerRoute.post("/employerverify-otp",employerController.employerverifyOTP)
employerRoute.post("/employerresend-otp",employerController.employerForgotPassword)
employerRoute.post("/employerchange-password",employerController.employerChangePassword)
employerRoute.put("/changeMyPassword/:employerId",employerController.employerChangeMyPassword)

employerRoute.put('/updatejobstatus/:jobId', jobController.updateJobActiveStatus);
employerRoute.post('/createcalender', eventController.createEvent);
employerRoute.get('/geteveent', eventController.getEvents);
employerRoute.put('/updatecalenderevent/:id', eventController.updateEvent);
employerRoute.delete('/deletecalendarevent/:id', eventController.deleteEvent);

employerRoute.post('/createhelpemployer', helpcontroller.createHelpRequest);

// Get Help Requests by Employer ID
employerRoute.get('/gethelpemployer/:employerid', helpcontroller.getHelpRequests);

// Fetch Chat Messages
employerRoute.get('/fetchchat/:docId', helpcontroller.fetchChat);

// Send Chat Message (with optional image)
employerRoute.post('/sendchat/:docId', dynamicUploadMiddleware, helpcontroller.sendChat);
employerRoute.post("/savecandi/:employerId/:employeeId",savecontroller.toggleSaveCandidate);

employerRoute.get("/getsavedcandidates/:employerId",savecontroller.getSavedCandidates);
employerRoute.post('/:organizerId/events', dynamicUploadMiddleware, eventsController.createsEvent);
employerRoute.get('/organizer/:organizerId/events', eventsController.getOrganizerEvents);
employerRoute.get('/details/:eventId', eventsController.getEventDetails);
employerRoute.get('/getallevents', eventsController.getAllEvents);
employerRoute.put('/updateevent/:eventId', eventsController.updateEvent);
employerRoute.delete('/removeevents/:eventId', eventsController.deleteEvent);

employerRoute.post('/events/:eventId/registerevents', eventsController.registerInEvent);
employerRoute.get('/events/:eventId/geteventspariticapant', eventsController.getEventRegistrations);
employerRoute.put('/events/:eventId/registrations/:registrationId', eventsController.updateRegistrationStatus);
employerRoute.put('/events/:eventId/registrations/:participantId/updatestatus', eventsController.updateRegistrationStatus);
employerRoute.get('/events/:eventId/registration-status/:participantId', eventsController.checkRegistrationStatus);


// BEFORE (broken image handling):
employerRoute.post('/sendchats', dynamicUploadMiddlewareNew, chatController.sendMessage);
// employerRoute.post('/send', dynamicUploadMiddlewareNew, helpcontroller.sendsMessage);

employerRoute.get('/chats/:jobId', chatController.getChatMessagesByJobId);

// Route: GET /employer/:employerId
employerRoute.get('/employer/:employerId', chatController.getChatsByEmployerId);

employerRoute.get('/employee/:employeeId', chatController.getChatsByEmployeeId);
employerRoute.get('/getchatmessagesbyemployerid', chatController.getchatmessagesbyemployerid);
employerRoute.get('/view', chatController.getChatMessages);

employerRoute.get('/unread', chatController.getUnreadCount);

// Mark messages as read
employerRoute.post('/mark-read', chatController.markAsRead);

employerRoute.post('/createorderrazo', OrderController.createOrder);


employerRoute.post('/createtraining', certificatecontroller.createTraining);
employerRoute.get('/fetchtraining', certificatecontroller.getAllTrainings);
employerRoute.get('/trainings/:id/subcategories', certificatecontroller.getTrainingSubCategories);


employerRoute.post('/trainings/:id/enroll', certificatecontroller.enrollEmployer);
employerRoute.get('/training/:trainingId/employer/:employerId/status', certificatecontroller.checkEmployerEnrollment);

employerRoute.get('/sendlink/:userId', employerController.getReferralLink);



employerRoute.get("/get-job-and-employer-count",employerController.getJobAndEmployerCount)






module.exports = employerRoute;
