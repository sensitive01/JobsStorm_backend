const express = require("express");
const multer = require("multer");
const fs = require("fs");
const employeeRoute = express.Router();

// ===============================
// Controllers
// ===============================
const employeeController = require("../../controller/employeeController/employeeController");
const jobController = require("../../controller/employerController/postjobcontroller");
const feedbackController = require("../../controller/employeeController/feedbackreview");
const emailverifycontroller = require("../../controller/employerController/emailverfycontoller");

// ===============================
// Cloudinary
// ===============================
const { cloudinary } = require("../../config/cloudinary");

// ===============================
// Temp Upload for Cloudinary
// ===============================
const tempUpload = multer({ dest: "temp/" });

// ===============================
// ✅ Upload All Files To Cloudinary Middleware
// ===============================
const uploadDocumentsToCloudinary = async (req, res, next) => {
  try {
    const uploadedFiles = {};

    const uploadFile = async (file, folder) => {
      const result = await cloudinary.uploader.upload(file.path, {
        folder,
        resource_type: "auto"
      });

      fs.unlinkSync(file.path); // cleanup temp file

      return {
        name: file.originalname,
        url: result.secure_url,
        public_id: result.public_id
      };
    };

    const folderMap = {
      userProfilePic: "employee/profile_images",
      resume: "employee/resumes",
      coverLetterFile: "employee/cover_letters",
      passport: "employee/passports",
      educationCertificate: "employee/education_certificates",
      policeClearance: "employee/police_clearance",
      mofaAttestation: "employee/mofa_attestation"
    };

    for (const field in req.files || {}) {
      const file = req.files[field][0];
      const uploaded = await uploadFile(file, folderMap[field]);
      uploadedFiles[field] = uploaded;
    }

    req.uploadedFiles = uploadedFiles;
    next();

  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    return res.status(500).json({ message: "Cloudinary upload failed" });
  }
};

// ===============================
// Helper: Select Cloudinary Storage by FileType (UNCHANGED)
// ===============================
const {
  profileImageStorage,
  resumeStorage,
  coverLetterStorage,
  profileVideoStorage,
  audioStorage
} = require("../../config/cloudinary");

const getStorage = (fileType) => {
  switch (fileType) {
    case "profileImage":
      return profileImageStorage;
    case "resume":
      return resumeStorage;
    case "coverLetter":
      return coverLetterStorage;
    case "profileVideo":
      return profileVideoStorage;
    case "audio":
      return audioStorage;
    default:
      return null;
  }
};

// ===============================
// Dynamic Upload Middleware (UNCHANGED)
// ===============================
const dynamicUploadMiddleware = (req, res, next) => {
  const fileType =
    req.query.fileType || req.headers["filetype"] || req.body.fileType;

  const storage = getStorage(fileType);

  if (!storage) {
    return res.status(400).json({ message: "Invalid or missing fileType" });
  }

  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }
  }).single("file");

  upload(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File size exceeds 10MB limit" });
      }
      return res.status(500).json({ message: "Upload error", error: err.message });
    }
    next();
  });
};

// ====================================================
// 🔹 GET Routes (UNCHANGED)
// ====================================================
employeeRoute.get("/get-my-name/:userId", employeeController.getMyName);
employeeRoute.get("/get-user-data/:employeeId", employeeController.getUserData);
employeeRoute.get("/get-saved-jobs/:employeeId", employeeController.getSavedJobs);
employeeRoute.get("/get-saved-jobs-details/:employeeId", employeeController.getSavedJobDetails);
employeeRoute.get("/get-company-name-or-job-name", employeeController.getCompanyNameOrJobName);
employeeRoute.get("/get-jobs-by-type/:jobType", employeeController.getFeaturedJobs);
employeeRoute.get("/get-all-blogs", employeeController.getAllBlogs);
employeeRoute.get("/get-distict-category-location", employeeController.getDistinctCategoryLocation);
employeeRoute.get("/get-random-blogs", employeeController.getRandomBlogs);
employeeRoute.get("/get-candidate-dashboard-data/:candidateId", employeeController.geCandidateDashboardData);
employeeRoute.get("/get-job-storm-card-data/:candidateId", employeeController.getSubscriptionCard);




employeeRoute.get("/fetchallemployee", employeeController.getAllEmployees);
employeeRoute.get("/fetchemployee/:id", employeeController.getEmployeeDetails);
employeeRoute.get("/percentage/:id", employeeController.getProfileCompletion);
employeeRoute.get("/getfeedback", feedbackController.fetchFeedback);
employeeRoute.get("/feedbackbyid/:userId", feedbackController.fetchFeedbackByUserId);
employeeRoute.get("/get-job-alerts", employeeController.getDesiredJobAlerts);
employeeRoute.get("/getalretjobs", employeeController.getDesiredJobAlertswithouttoken);

employeeRoute.get("/fetchAvailabilityStatus/:employeeId", employeeController.fetchAvailabilityStatus);
employeeRoute.get("/verify-the-candidate-register-or-not/:candidateEmail", employeeController.verifyTheCandidateRegisterOrNot);
employeeRoute.get("/job/:jobId/application/:applicantId/status", employeeController.getApplicationStatus);
employeeRoute.get("/applicant/:applicantId", employeeController.appliedjobsfetch);
employeeRoute.get("/fetchshorlitstedjobsemployee/:applicantId", jobController.getJobsWithNonPendingApplications);

// ====================================================
// 🔹 POST Routes (UNCHANGED except edit)
// ====================================================
employeeRoute.post("/signup", employeeController.signUp);
employeeRoute.post("/login", employeeController.login);
employeeRoute.post("/sendemailotp", emailverifycontroller.sendOtpToEmail);
employeeRoute.post("/verifyemailotp", emailverifycontroller.verifyEmailOtp);
employeeRoute.post("/change-password", employeeController.userChangePassword);
employeeRoute.post("/book-my-demo", employeeController.bookDemoSchedule);
employeeRoute.post("/generate-job-storm-card/:candidateId", employeeController.generateSubscriptionCard);

// ✅ FIXED CLOUDINARY ROUTE ONLY
employeeRoute.post(
  "/edit-form-data/:userId",
  tempUpload.fields([
    { name: "userProfilePic", maxCount: 1 },
    { name: "resume", maxCount: 1 },
    { name: "coverLetterFile", maxCount: 1 },
    { name: "passport", maxCount: 1 },
    { name: "educationCertificate", maxCount: 1 },
    { name: "policeClearance", maxCount: 1 },
    { name: "mofaAttestation", maxCount: 1 }
  ]),
  uploadDocumentsToCloudinary,
  employeeController.editUserData
);

employeeRoute.post("/apply-job/:jobId/:candidateId", employeeController.applyForJob);
employeeRoute.get("/get-applied-jobs/:candidateId", employeeController.getAppliedJobs);

employeeRoute.post("/google", employeeController.googleAuth);
employeeRoute.post("/apple", employeeController.appleAuth);
employeeRoute.post("/forgotpassword", employeeController.userForgotPassword);
employeeRoute.post("/verify-otp", employeeController.verifyOTP);
employeeRoute.post("/resend-otp", employeeController.userForgotPassword);
employeeRoute.post("/createfeedback", feedbackController.addFeedback);
employeeRoute.post("/add-job-alert", employeeController.addJobAlert);
employeeRoute.post("/addjobtoken", employeeController.addwithouttoeken);

// ====================================================
// 🔹 PUT Routes (UNCHANGED)
// ====================================================
employeeRoute.put("/candidate-save-job/:candidateId/:jobId", employeeController.candidateSaveJob);

employeeRoute.put("/uploadfile/:employid", dynamicUploadMiddleware, employeeController.uploadFile);
employeeRoute.put("/uploadprofilevideo/:employeeId", dynamicUploadMiddleware, employeeController.uploadProfileVideo);
employeeRoute.put("/uploadintroaudio/:employeeId", dynamicUploadMiddleware, employeeController.uploadIntroAudio);

employeeRoute.put("/updateprofile/:employid", employeeController.updateProfile);
employeeRoute.put("/updatefeedback/:userId", feedbackController.updateFeedback);
employeeRoute.put("/employeee-change-password/:candidateId", employeeController.candidateChangePassword);
employeeRoute.put("/updateAvailabilityStatus/:employeeId", employeeController.updateAvailabilityStatus);

// ====================================================
// EXPORT
// ====================================================
module.exports = employeeRoute;
