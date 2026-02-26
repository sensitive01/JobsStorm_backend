const express = require("express");
const multer = require("multer");
const employerRoute = express();
const { compressFile } = require("../../utils/fileCompression");
const { cloudinary } = require("../../config/cloudinary");
const { Readable } = require("stream");

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
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
}).single("file");

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

// Helper: Get Cloudinary upload params by fileType
const getCloudinaryParamsForEmployer = (req, file, fileType) => {
  const timestamp = Date.now();
  const originalName = file.originalname.replace(/\.[^/.]+$/, "");
  const employid = req.params.employid || req.body.employerId || req.body.employeeId;

  const baseParams = {
    public_id: `${employid}_${fileType}_${originalName}_${timestamp}`,
  };

  switch (fileType) {
    case "profileImage":
      return {
        ...baseParams,
        folder: 'employer_profile_images',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { width: 1200, height: 1200, crop: 'limit', quality: 'auto:good' }
        ],
      };
    case "3":
    case "chatImage":
      return {
        ...baseParams,
        folder: 'chatimage',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { width: 800, height: 600, crop: 'limit', quality: 'auto:good' }
        ],
      };
    case "eventimage":
      return {
        ...baseParams,
        folder: 'event_images',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { width: 1600, height: 900, crop: 'limit', quality: 'auto:good' }
        ],
      };
    case "send":
      return {
        ...baseParams,
        folder: 'sendimage',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { width: 1200, height: 1200, crop: 'limit', quality: 'auto:good' }
        ],
      };
    default:
      return baseParams;
  }
};

const dynamicUploadMiddleware = (req, res, next) => {
  const fileType = req.body.fileType || req.query.fileType;

  // Use memory storage to get file buffer for compression
  const memoryStorage = multer.memoryStorage();
  const upload = multer({
    storage: memoryStorage,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit
    },
  }).single("file");

  upload(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File size exceeds 50MB limit",
        });
      }
      return res.status(400).json({
        success: false,
        message: "File upload failed",
        error: err.message,
      });
    }

    if (!req.file) {
      return next(); // Allow routes that don't require files
    }

    // Compress and upload asynchronously
    (async () => {
      try {
        console.log(`Compressing ${fileType} file: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)}KB)`);

        const compressedBuffer = await compressFile(
          req.file.buffer,
          req.file.mimetype,
          {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 85,
            maxFileSize: 5 * 1024 * 1024
          }
        );

        console.log(`Compressed size: ${(compressedBuffer.length / 1024).toFixed(2)}KB`);

        const uploadParams = getCloudinaryParamsForEmployer(req, req.file, fileType);

        const uploadStream = cloudinary.uploader.upload_stream(
          uploadParams,
          (error, result) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              return res.status(500).json({
                success: false,
                message: "Failed to upload file to Cloudinary",
                error: error.message
              });
            }

            req.file.secure_url = result.secure_url;
            req.file.url = result.secure_url;
            req.file.public_id = result.public_id;
            req.file.size = compressedBuffer.length;

            console.log('File uploaded successfully to Cloudinary');
            next();
          }
        );

        const bufferStream = new Readable();
        bufferStream.push(compressedBuffer);
        bufferStream.push(null);
        bufferStream.pipe(uploadStream);
      } catch (compressionError) {
        console.error('Compression/upload error:', compressionError);
        return res.status(500).json({
          success: false,
          message: "Error processing file",
          error: compressionError.message
        });
      }
    })();
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
employerRoute.get("/get-employer-topbar-data/:employerId", employerController.getEmployerDetailsTopBar);

employerRoute.get("/get-dashboard-data/:employerId", employerController.getDashboardData);
employerRoute.get("/get-interview-details/:employerId", employerController.getInterviewDetails);

employerRoute.get("/get-suggested-candidates/:employerId", employerController.getSuggestedCandidates);


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
employerRoute.post("/company-signup/send-otp", emailverifycontroller.sendCompanySignupOtp);
employerRoute.post("/company-signup/verify-otp", emailverifycontroller.verifyCompanySignupOtp);
// Get chat messages by employeeId, employerId, and jobId
employerRoute.get("/chat/messages", chatController.getChatMessages);

// Get chat messages by jobId (with optional employeeId and employerId in query)
employerRoute.get("/chats/:jobId", chatController.getChatMessagesByJobId);

// Get all chats for an employer
employerRoute.get("/chat/employer/:employerId", chatController.getChatsByEmployerId);

// Get all chats for an employee
employerRoute.get("/chat/employeedata/:employeeId", chatController.getChatsByEmployeeId);

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
  "/uploadcoverpic/:employid",
  dynamicUploadMiddleware,
  employerController.updateCoverPicture
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
