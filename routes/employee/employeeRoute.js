const express = require("express");
const multer = require("multer");
const employeeRoute = express.Router();

// ===============================
// Controllers
// ===============================
const employeeController = require("../../controller/employeeController/employeeController");
const jobController = require("../../controller/employerController/postjobcontroller");
const feedbackController = require("../../controller/employeeController/feedbackreview");
const emailverifycontroller = require("../../controller/employerController/emailverfycontoller");
const subscriptionController = require("../../controller/employeeController/subscriptionController");
const pricingPlanController = require("../../controller/employeeController/pricingPlanController");
const orderController = require("../../controller/employeeController/orderController");

// ===============================
// Cloudinary Storage Config
// ===============================
const {
  profileImageStorage,
  resumeStorage,
  coverLetterStorage,
  profileVideoStorage,
  audioStorage,
} = require("../../config/cloudinary");

// ===============================
// Default Multer (Local Upload)
// ===============================
const upload = multer({ dest: "uploads/" });

// ===============================
// Helper: Select Cloudinary Storage by FileType
// ===============================
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
// Dynamic Upload Middleware
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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  }).single("file");

  upload(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ message: "File size exceeds 10MB limit" });
      }
      return res
        .status(500)
        .json({ message: "Upload error", error: err.message });
    }
    next();
  });
};

// ====================================================
// 🔹 GET Routes
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
employeeRoute.get("/get-candidate-transaction-history/:employeeId", orderController.getEmployeeOrders);
employeeRoute.get("/get-job-storm-card-data/:employeeId", employeeController.getJobStormCardData);
employeeRoute.get("/is-candidate-subscribed/:employeeId", employeeController.isCandidateSubscribed);
employeeRoute.get("/get-candidate-dashboard-data/:candidateId", employeeController.geCandidateDashboardData);

employeeRoute.get("/fetchallemployee", employeeController.getAllEmployees);
employeeRoute.get("/fetchemployee/:id", employeeController.getEmployeeDetails);
employeeRoute.get("/percentage/:id", employeeController.getProfileCompletion);
employeeRoute.get("/getfeedback", feedbackController.fetchFeedback);
employeeRoute.get(
  "/feedbackbyid/:userId",
  feedbackController.fetchFeedbackByUserId
);
employeeRoute.get("/get-job-alerts", employeeController.getDesiredJobAlerts);
employeeRoute.get(
  "/getalretjobs",
  employeeController.getDesiredJobAlertswithouttoken
);
employeeRoute.get(
  "/fetchAvailabilityStatus/:employeeId",
  employeeController.fetchAvailabilityStatus
);
employeeRoute.get(
  "/verify-the-candidate-register-or-not/:candidateEmail",
  employeeController.verifyTheCandidateRegisterOrNot
);
employeeRoute.get(
  "/job/:jobId/application/:applicantId/status",
  employeeController.getApplicationStatus
);
employeeRoute.get(
  "/applicant/:applicantId",
  employeeController.appliedjobsfetch
);
employeeRoute.get(
  "/fetchshorlitstedjobsemployee/:applicantId",
  jobController.getJobsWithNonPendingApplications
);

// ====================================================
// 🔹 Subscription Routes
// ====================================================
employeeRoute.get(
  "/subscription/status/:employeeId",
  subscriptionController.getSubscriptionStatus
);
employeeRoute.get(
  "/subscription/check-interview-eligibility/:employeeId",
  subscriptionController.checkInterviewEligibility
);
employeeRoute.post(
  "/subscription/create",
  subscriptionController.createSubscription
);

// ====================================================
// 🔹 Order & Payment Routes
// ====================================================
employeeRoute.post(
  "/order/create",
  orderController.createOrder
);
employeeRoute.post(
  "/order/verify",
  orderController.verifyPayment
);
employeeRoute.get(
  "/order/history/:employeeId",
  orderController.getEmployeeOrders
);

// ====================================================
// 🔹 Pricing Plans Routes
// ====================================================
employeeRoute.get(
  "/pricing-plans",
  pricingPlanController.getPricingPlans
);
employeeRoute.get(
  "/pricing-plans/comparison",
  pricingPlanController.getComparisonTable
);

// ====================================================
// 🔹 POST Routes
// ====================================================

employeeRoute.post("/signup", employeeController.signUp);
employeeRoute.post("/login", employeeController.login);
employeeRoute.post("/sendemailotp", emailverifycontroller.sendOtpToEmail);
employeeRoute.post("/verifyemailotp", emailverifycontroller.verifyEmailOtp);
employeeRoute.post("/change-password", employeeController.userChangePassword);
employeeRoute.post("/book-my-demo", employeeController.bookDemoSchedule);
employeeRoute.post(
  "/edit-form-data/:userId",
  upload.fields([
    { name: "userProfilePic", maxCount: 1 },
    { name: "resume", maxCount: 1 },
    { name: "coverLetterFile", maxCount: 1 },
    { name: "passport", maxCount: 1 },
    { name: "educationCertificate", maxCount: 1 },
    { name: "policeClearance", maxCount: 1 },
    { name: "mofaAttestation", maxCount: 1 },
  ]),
  employeeController.editUserData
);
employeeRoute.post(
  "/apply-job/:jobId/:candidateId",

  employeeController.applyForJob
);

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
// 🔹 PUT Routes
// ====================================================

employeeRoute.put("/candidate-save-job/:candidateId/:jobId", employeeController.candidateSaveJob);


employeeRoute.put(
  "/uploadfile/:employid",
  dynamicUploadMiddleware,
  employeeController.uploadFile
);
employeeRoute.put(
  "/uploadprofilevideo/:employeeId",
  dynamicUploadMiddleware,
  employeeController.uploadProfileVideo
);
employeeRoute.put(
  "/uploadintroaudio/:employeeId",
  dynamicUploadMiddleware,
  employeeController.uploadIntroAudio
);

employeeRoute.put("/updateprofile/:employid", employeeController.updateProfile);
employeeRoute.put("/updatefeedback/:userId", feedbackController.updateFeedback);
employeeRoute.put(
  "/employeee-change-password/:candidateId",
  employeeController.candidateChangePassword
);
employeeRoute.put(
  "/updateAvailabilityStatus/:employeeId",
  employeeController.updateAvailabilityStatus
);

// ====================================================
// 🔹 DELETE Routes (if any added later)
// ====================================================
// Example:
// employeeRoute.delete("/delete/:id", employeeController.deleteEmployee);

employeeRoute.delete("/clear-all-transactions/:candidateId", orderController.clearAllTransactions);


// ====================================================
// EXPORT ROUTER
// ====================================================
module.exports = employeeRoute;
