const express = require("express");
const router = express.Router();
const employeradminController = require("../../controller/employeradminController/employeradminController");
const employeeController = require("../../controller/employeeController/employeeController");
const employerController = require("../../controller/employerController/employerController");
const employeradminRoute = express.Router();
const multer = require("multer");
const { compressFile } = require("../../utils/fileCompression");
const { cloudinary } = require("../../config/cloudinary");
const { Readable } = require("stream");

// All use memory storage for compression
const profileImageStorage = multer.memoryStorage();
const resumeStorage = multer.memoryStorage();
const coverLetterStorage = multer.memoryStorage();
const profileVideoStorage = multer.memoryStorage();
const audioStorage = multer.memoryStorage();

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

// Helper: Get Cloudinary upload params by fileType
const getCloudinaryParamsForAdmin = (req, file, fileType) => {
  const timestamp = Date.now();
  const originalName = file.originalname.replace(/\.[^/.]+$/, "");
  const id = req.params.id || req.body.employerAdminId || req.body.employeeId;
  
  const baseParams = {
    public_id: `${id}_${fileType}_${originalName}_${timestamp}`,
  };

  switch (fileType) {
    case 'profileImage':
      return {
        ...baseParams,
        folder: 'employer_admin_profile_images',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { width: 1200, height: 1200, crop: 'limit', quality: 'auto:good' }
        ],
      };
    case 'resume':
      return {
        ...baseParams,
        folder: 'employer_admin_resumes',
        resource_type: 'raw',
        format: 'pdf',
        flags: 'attachment',
      };
    case 'coverLetter':
      return {
        ...baseParams,
        folder: 'employer_admin_cover_letters',
        resource_type: 'raw',
        format: 'pdf',
        flags: 'attachment',
      };
    default:
      return baseParams;
  }
};

// Dynamic middleware for fileType-based upload with compression
const dynamicUploadMiddleware = (req, res, next) => {
  const fileType = req.query.fileType || req.headers['filetype'] || req.body.fileType;

  if (!fileType) {
    return res.status(400).json({ message: 'Invalid or missing fileType' });
  }

  const storage = getStorage(fileType);
  if (!storage) {
    return res.status(400).json({ message: 'Invalid fileType' });
  }

  const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  }).single('file');

  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size exceeds 50MB limit' });
      }
      return res.status(500).json({ message: 'Upload error', error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
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

        const uploadParams = getCloudinaryParamsForAdmin(req, req.file, fileType);
        
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadParams,
          (error, result) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              return res.status(500).json({
                message: 'Failed to upload file to Cloudinary',
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
          message: 'Error processing file',
          error: compressionError.message
        });
      }
    })();
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