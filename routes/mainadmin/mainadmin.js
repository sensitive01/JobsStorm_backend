const express = require("express");
const multer = require("multer");
const { bannerImageStorage } = require("../../config/cloudinary");


// Controllers
// const adminPlanController = require("../../controller//employeeController/pricingPlanController");


const planController = require("../../controller/employerController/employerplanController");
const adminPlanController = require("../../controller/employeeController/pricingPlanController");
const adminfunction = require("../../controller/adminController/adminfunction");
const bannerController = require("../../controller/adminController/eventbannerController");
const employeeBannerController = require("../../controller/adminController/employeebanner");
const adminLoginController = require("../../controller/adminController/adminlogin");

// Initialize Router
const mainadminRoute = express.Router();

// Multer setup for Cloudinary image uploads
const upload = multer({ storage: bannerImageStorage });

/* ────────────────────────────────────────────────
   📦 PLAN MANAGEMENT
──────────────────────────────────────────────── */


mainadminRoute.get("/get-all-plans", adminPlanController.getPricingPlans);
mainadminRoute.put('/update-plan/:id', adminPlanController.updatePlan);
mainadminRoute.delete('/delete-plan/:id', adminPlanController.deletePlan);








mainadminRoute.get(
  "/fetchplanbyemp/:employerId",
  planController.getPlansByEmployer
);
mainadminRoute.post("/activateplans", planController.activateSubscription);
mainadminRoute.get("/getallplans", planController.getAllPlans);
mainadminRoute.get("/getplan/:id", planController.getPlanById);
mainadminRoute.post("/createplan", planController.createPlan);
mainadminRoute.put("/updateplan/:id", planController.updatePlan);
mainadminRoute.delete("/deleteplan/:id", planController.deletePlan);















/* ────────────────────────────────────────────────
   💳 EMPLOYEE PLAN ACTIVATION (ADMIN)
──────────────────────────────────────────────── */
mainadminRoute.post("/activate-employee-plan", adminfunction.activateEmployeePlan);

/* ────────────────────────────────────────────────
   🧾 EMPLOYER & EMPLOYEE APPROVALS
──────────────────────────────────────────────── */
mainadminRoute.put("/approveemployer/:id", adminfunction.approveSingleEmployer);
mainadminRoute.put("/approve-all", adminfunction.approveAllEmployers);

mainadminRoute.put("/approveemployee/:id", adminfunction.approveSingleEmployee);
mainadminRoute.put("/approveallemployee", adminfunction.approveAllEmployee);

mainadminRoute.put(
  "/approveemployeradmin/:id",
  adminfunction.approveSingleEmployeradmin
);
mainadminRoute.put(
  "/approveallemployeradmin",
  adminfunction.approveAllEmployeradmin
);

mainadminRoute.put("/updateapprovejobs/:id", adminfunction.updateJobStatus);
mainadminRoute.put("/updateallapproved", adminfunction.updateapproved);

/* ────────────────────────────────────────────────
   🚫 BLOCK / UNBLOCK MANAGEMENT
──────────────────────────────────────────────── */
mainadminRoute.put(
  "/updateblockstatus/:id",
  adminfunction.blockunblockemployer
);
mainadminRoute.put(
  "/updateblockstatusemployee/:id",
  adminfunction.blockunblockemployee
);
mainadminRoute.put(
  "/updateblockstatusemployeradmin/:id",
  adminfunction.blockunblockemployeradmin
);
mainadminRoute.put("/updateunblockall", adminfunction.updateallblock);

/* ────────────────────────────────────────────────
   🧑‍💼 EMPLOYER & EMPLOYEE FETCH
──────────────────────────────────────────────── */
mainadminRoute.get("/getallemployers", adminfunction.getAllEmployers);
mainadminRoute.put("/approve-employer/:employerId", adminfunction.approveEmployer);
mainadminRoute.put("/reject-employer/:employerId", adminfunction.rejectEmployer);
mainadminRoute.get("/get-employer-details/:employerId", adminfunction.getEmployerDetails);
mainadminRoute.get("/get-registerd-candidate", adminfunction.getRegisteredCandidates);
mainadminRoute.get("/get-candidate-details/:candidateId", adminfunction.getCandidateDetails);
mainadminRoute.get("/get-all-company-details", adminfunction.getRegisteredCompanyData);
mainadminRoute.get("/get-all-company-posted-jobs/:companyId", adminfunction.getAllJobsPostedByCompany);
mainadminRoute.get("/get-job-details/:jobId", adminfunction.getJobDetails);
mainadminRoute.put("/update-job-details/:jobId", adminfunction.updateJobDetails);




mainadminRoute.get(
  "/getsubscribedemployers",
  adminfunction.getSubscribedEmployers
);

/* ────────────────────────────────────────────────
   🖼️ EVENT & EMPLOYEE BANNERS
──────────────────────────────────────────────── */
mainadminRoute.post(
  "/createeventbanner",
  upload.fields([{ name: "image", maxCount: 1 }]),
  bannerController.createBanner
);
mainadminRoute.get("/fetchalleventbanner", bannerController.getBanners);

mainadminRoute.post(
  "/createemployeebanner",
  upload.fields([{ name: "image", maxCount: 1 }]),
  employeeBannerController.employeecreatebanner
);
mainadminRoute.get(
  "/fetchemployeebanner",
  employeeBannerController.getemployeeBanners
);

/* ────────────────────────────────────────────────
   🔐 ADMIN AUTH
──────────────────────────────────────────────── */
mainadminRoute.post("/signup", adminLoginController.adminSignup);
mainadminRoute.post("/login", adminLoginController.adminVerification);
mainadminRoute.post("/post-blogs", adminfunction.postBlogs);
mainadminRoute.get("/get-all-blogs", adminfunction.getAllBlogs);
mainadminRoute.get("/get-blogs/:id", adminfunction.getBlogData);
mainadminRoute.put("/update-blog-data/:id", adminfunction.updateBlogdata);
mainadminRoute.delete("/delete-blog-data/:id", adminfunction.deleteBlogData);
mainadminRoute.get(
  "/fetchallemployeradmin",
  adminLoginController.getAllEmployerAdmins
);

/* ────────────────────────────────────────────────
   📚 RESOURCES MANAGEMENT
──────────────────────────────────────────────── */
const resourceController = require("../../controller/resourceController");

mainadminRoute.post("/post-resources", resourceController.postResource);
mainadminRoute.get("/get-all-resources", resourceController.getAllResources);
mainadminRoute.get("/get-resources/:id", resourceController.getResourceById);
mainadminRoute.put("/update-resource-data/:id", resourceController.updateResource);
mainadminRoute.delete("/delete-resource-data/:id", resourceController.deleteResource);

mainadminRoute.get("/get-all-transactions", adminfunction.getAllTransactions);
mainadminRoute.delete("/delete-transaction/:id", adminfunction.deleteTransaction);

const colleagueController = require("../../controller/employeeController/employeeController");
mainadminRoute.get("/get-all-jobs-list", adminfunction.getAllJobsList);
mainadminRoute.post("/apply-job/:jobId/:candidateId", colleagueController.applyForJob);

module.exports = mainadminRoute;
