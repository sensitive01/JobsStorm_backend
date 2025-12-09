const express = require("express");
const multer = require("multer");
const employerRoute = express();

const meetingController = require("../../controller/employerController/meetingController");
const employerController = require("../../controller/employerController/employerController");
const jobController = require("../../controller/employerController/postjobcontroller");
const eventController = require("../../controller/employerController/calendarControllers");
const eventsController = require("../../controller/employerController/upcomeevent");
const emailverifycontroller = require("../../controller/employerController/emailverfycontoller");
const helpcontroller = require("../../controller/employerController/employerhelpController");
const chatController = require("../../controller/employerController/chatController");
const certificatecontroller = require("../../controller/employerController/certificationControleler");
const savecontroller = require("../../controller/employerController/savedCandiateControlller");
const OrderController = require("../../controller/employeeController/orderController");

const {
  profileImageStorage,
  resumeStorage,
  coverLetterStorage,
  chatImageStorage,
  chatAudioStorage,
  eventImageStorage,
  sendimage,
} = require("../../config/cloudinary");

// Memory upload for chat
const memoryUpload = multer({ storage: multer.memoryStorage() }).single("file");

// ===== Dynamic Upload Config =====
const getStorage = (fileType) => {
  switch (fileType) {
    case "profileImage":
      return profileImageStorage;
    case "resume":
      return resumeStorage;
    case "coverLetter":
      return coverLetterStorage;
    case "3":
      return chatImageStorage;
    case "chatAudio":
      return chatAudioStorage;
    case "eventimage":
      return eventImageStorage;
    case "send":
      return sendimage;
    default:
      return null;
  }
};

const dynamicUploadMiddleware = (req, res, next) => {
  const fileType = req.body.fileType || req.query.fileType;
  const storage = getStorage(fileType);
  if (!storage) return next();

  const upload = multer({ storage }).single("file");
  upload(req, res, (err) => {
    if (err)
      return res
        .status(400)
        .json({
          success: false,
          message: "File upload failed",
          error: err.message,
        });
    next();
  });
};

const dynamicUploadMiddlewareNew = (req, res, next) => {
  memoryUpload(req, res, (err) => {
    if (err)
      return res
        .status(400)
        .json({ success: false, message: "Upload failed", error: err.message });
    next();
  });
};

// ================================================================
// ==========================  GET ROUTES  =========================
// ================================================================
employerRoute.get("/fetchjob/:employid", jobController.getJobsByEmployee);
employerRoute.get("/get-active-job-data/:employid", jobController.getActiveJobData);
employerRoute.get("/get-inactive-job-data/:employid", jobController.getInActiveJobData);
employerRoute.get("/viewjobs/:id", jobController.getJobById);
employerRoute.get("/update-is-subscription-active", jobController.updateIsSubscriptionActive);
employerRoute.get("/get-job-post-count-exceeded-or-not/:employerId", jobController.getEmployerJobCountExeedOrNot);
employerRoute.get("/get-candidate-database-data", jobController.getCandidateDataBaseData);
employerRoute.get("/get-candidate-details/:candidateId", jobController.getCandidateData);
employerRoute.get("/get-shortlisted-candidate-data/:employerId", jobController.getShortListedCandidateData);




employerRoute.get("/fetchemployer/:id", employerController.getEmployerDetails);
employerRoute.get("/fetchjobs", jobController.getAllJobs);
employerRoute.get("/fetchappliedcand/:id", jobController.getAppliedCandidates);
employerRoute.get(
  "/fetchfavcand/:employid",
  jobController.getFavouriteCandidates
);
employerRoute.get("/fetchshortlistcand/:id", jobController.shortlistcand);
employerRoute.get(
  "/fetchallnonpending/:employid",
  jobController.getNonPendingApplicantsByEmployId
);
employerRoute.get(
  "/viewallappliedcandi/:employid",
  jobController.getAllApplicantsByEmployId
);
employerRoute.get("/fetchAllJobs", jobController.fetchAllJobs);
employerRoute.get(
  "/fetchSavedJobs/:employid",
  jobController.fetchSavedJobslist
);
employerRoute.get("/fetchschooljobs", jobController.getSchoolEmployerJobs);
employerRoute.get("/fetchcompanyjobs", jobController.getcompnanyEmployerJobs);
employerRoute.get("/fetchjobtitle/:jobId", jobController.getJobTitleByJobId);

employerRoute.get("/listallemployer", employerController.listAllEmployees);
employerRoute.get("/fetchmeeting/:id", meetingController.getMeetingsByVendor);

employerRoute.get("/geteveent", eventController.getEvents);
employerRoute.get(
  "/organizer/:organizerId/events",
  eventsController.getOrganizerEvents
);
employerRoute.get("/details/:eventId", eventsController.getEventDetails);
employerRoute.get("/getallevents", eventsController.getAllEvents);
employerRoute.get(
  "/events/:eventId/geteventspariticapant",
  eventsController.getEventRegistrations
);
employerRoute.get(
  "/events/:eventId/registration-status/:participantId",
  eventsController.checkRegistrationStatus
);

employerRoute.get(
  "/gethelpemployer/:employerid",
  helpcontroller.getHelpRequests
);
employerRoute.get("/fetchchat/:docId", helpcontroller.fetchChat);

// ===== Chat Routes =====
// Send message (with optional file upload)
employerRoute.post(
  "/sendchats",
  memoryUpload,
  chatController.sendMessage
);

// Get chat messages by employeeId, employerId, and jobId
employerRoute.get("/chat/messages", chatController.getChatMessages);

// Get chat messages by jobId (with optional employeeId and employerId in query)
employerRoute.get("/chats/:jobId", chatController.getChatMessagesByJobId);

// Get all chats for an employer
employerRoute.get("/chat/employer/:employerId", chatController.getChatsByEmployerId);

// Get all chats for an employee
employerRoute.get("/chat/employee/:employeeId", chatController.getChatsByEmployeeId);

// Mark messages as read
employerRoute.post("/chat/mark-read", chatController.markAsRead);

// Get unread message count
employerRoute.get("/chat/unread-count", chatController.getUnreadCount);

// Delete a chat
employerRoute.delete("/chat/:chatId", chatController.deleteChat);

// Legacy routes for backward compatibility
employerRoute.get("/employer/:employerId", chatController.getChatsByEmployerId);
employerRoute.get("/employee/:employeeId", chatController.getChatsByEmployeeId);
employerRoute.get("/view", chatController.getChatMessages);
employerRoute.get("/unread", chatController.getUnreadCount);
employerRoute.post("/mark-read", chatController.markAsRead);

employerRoute.get(
  "/getsavedcandidates/:employerId",
  savecontroller.getSavedCandidates
);

employerRoute.get("/fetchtraining", certificatecontroller.getAllTrainings);
employerRoute.get(
  "/trainings/:id/subcategories",
  certificatecontroller.getTrainingSubCategories
);
employerRoute.get(
  "/training/:trainingId/employer/:employerId/status",
  certificatecontroller.checkEmployerEnrollment
);

employerRoute.get("/sendlink/:userId", employerController.getReferralLink);
employerRoute.get(
  "/get-job-and-employer-count",
  employerController.getJobAndEmployerCount
);

// ================================================================
// ==========================  POST ROUTES  ========================
// ================================================================

employerRoute.post("/signup", employerController.signUp);
employerRoute.post("/login", employerController.login);
employerRoute.post("/postjob/:empId", jobController.createJob);
// employerRoute.post("/create-chat-room/:employerId/:candidateId", chatController.createChatRoom);




employerRoute.post("/sendemailotp", emailverifycontroller.sendOtpToEmail);
employerRoute.post("/verifyemailotp", emailverifycontroller.verifyEmailOtp);
employerRoute.post(
  "/send-verification-otp",
  emailverifycontroller.sendVerificationEmail
);

employerRoute.post("/toggleSaveJob", jobController.toggleSaveJob);

employerRoute.post("/createmeeting", meetingController.create);

employerRoute.post("/createcalender", eventController.createEvent);
employerRoute.post(
  "/:organizerId/events",
  dynamicUploadMiddleware,
  eventsController.createsEvent
);
employerRoute.post(
  "/events/:eventId/registerevents",
  eventsController.registerInEvent
);

employerRoute.post("/createhelpemployer", helpcontroller.createHelpRequest);
employerRoute.post(
  "/sendchat/:docId",
  dynamicUploadMiddleware,
  helpcontroller.sendChat
);

employerRoute.post(
  "/sendchats",
  dynamicUploadMiddlewareNew,
  chatController.sendMessage
);
employerRoute.post("/mark-read", chatController.markAsRead);

employerRoute.post(
  "/savecandi/:employerId/:employeeId",
  savecontroller.toggleSaveCandidate
);
employerRoute.post("/createorderrazo", OrderController.createOrder);

employerRoute.post("/createtraining", certificatecontroller.createTraining);
employerRoute.post(
  "/trainings/:id/enroll",
  certificatecontroller.enrollEmployer
);

employerRoute.post(
  "/employerforgotpassword",
  employerController.employerForgotPassword
);
employerRoute.post("/employerverify-otp", employerController.employerverifyOTP);
employerRoute.post(
  "/employerresend-otp",
  employerController.employerForgotPassword
);
employerRoute.post(
  "/employerchange-password",
  employerController.employerChangePassword
);

employerRoute.post("/google", employerController.googleAuth);
employerRoute.post("/apple", employerController.appleAuth);

// ================================================================
// ==========================  PUT ROUTES  =========================
// ================================================================

employerRoute.put("/editjob/:id", jobController.updateJobById);
employerRoute.put("/editjob-status/:id/:employeeId", jobController.changeJobStatus);
employerRoute.put("/update-candidate-job-application-status/:jobId", jobController.updateCandidateJobApplicationStatus);




employerRoute.put(
  "/updateemployer/:id",
  employerController.updateEmployerDetails
);
employerRoute.put(
  "/uploadprofilepic/:employid",
  dynamicUploadMiddleware,
  employerController.updateProfilePicture
);

employerRoute.put(
  "/updatejobstatus/:jobId",
  jobController.updateJobActiveStatus
);
employerRoute.put(
  "/updatefavorite/:jobId/:applicantId",
  jobController.updateFavoriteStatus
);
employerRoute.put(
  "/update-status/:applicationId/:applicantId",
  jobController.updateApplicantStatus
);
employerRoute.put(
  "/updaee/:applicationId/:employid",
  jobController.updateFavStatusforsavecand
);

employerRoute.put("/updatecalenderevent/:id", eventController.updateEvent);
employerRoute.put(
  "/events/:eventId/registrations/:registrationId",
  eventsController.updateRegistrationStatus
);
employerRoute.put(
  "/events/:eventId/registrations/:participantId/updatestatus",
  eventsController.updateRegistrationStatus
);

employerRoute.put(
  "/decreaseProfileView/:employerId/:employeeId",
  employerController.decreaseProfileView
);
employerRoute.put(
  "/decrease/:employerId/:employeeId",
  employerController.decreaseResumeDownload
);
employerRoute.put(
  "/changeMyPassword/:employerId",
  employerController.employerChangeMyPassword
);

// ================================================================
// ========================= DELETE ROUTES ========================
// ================================================================

employerRoute.delete("/deletecalendarevent/:id", eventController.deleteEvent);
employerRoute.delete("/removeevents/:eventId", eventsController.deleteEvent);

module.exports = employerRoute;
