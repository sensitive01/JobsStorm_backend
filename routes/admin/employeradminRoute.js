const express = require("express");
const router = express.Router();
const employeradminController = require("../../controller/employeradminController/employeradminController");
const employeeController = require("../../controller/employeeController/employeeController");
const employerController = require("../../controller/employerController/employerController");
const employeradminRoute = express.Router();
const multer = require("multer");

const profileImageStorage = multer.memoryStorage();
const resumeStorage = multer.memoryStorage();
const coverLetterStorage = multer.memoryStorage();
const profileVideoStorage = multer.memoryStorage();
const audioStorage = multer.memoryStorage();
// const {
//   profileImageStorage,


// } = require('../../config/cloudinary');
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

employeradminRoute.post('/employeradminsignup', employeradminController.employersignupAdmin);
employeradminRoute.post('/employerloginAdmin', employeradminController.employerloginAdmin);
employeradminRoute.get('/fetchprofile/:id', employeradminController.employergetAdminById);
employeradminRoute.post('/employeradminforgotpassword', employeradminController.employeradminForgotPassword);
employeradminRoute.post('/employeradminverifyotp', employeradminController.employeradminVerifyOTP);
employeradminRoute.post('/employeradminchangepassword', employeradminController.employeradminChangePassword);
employeradminRoute.post('/createemployer', employeradminController.createemployersignUp);

employeradminRoute.get('/fetchbyorg/:organizationid', employeradminController.getEmployersByOrganizationId);

employeradminRoute.get('/fetchallemployee', employeradminController.getAllEmployees);
employeradminRoute.get('/fetchallemployers', employeradminController.getAllEmployers);
employeradminRoute.put('/updateemployeradmin/:id', dynamicUploadMiddleware, employeradminController.updateEmployerAdmin);

// employeradminRoute.get('/fetchsubunitjobs/:applicantId', employeradminController.getJobsByApplicant);
employeradminRoute.get('/getjobsbyorg/:employerAdminId', employeradminController.getJobsByEmployerAdmin);
module.exports = employeradminRoute;