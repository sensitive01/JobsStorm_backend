const express = require("express");
const multer = require("multer");
const path = require("path");
const employeeRoute = express.Router();
const { compressFile } = require("../../utils/fileCompression");
const { cloudinary } = require("../../config/cloudinary");
const { Readable } = require("stream");

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
// Default Multer (Local Upload) - Increased file size limit
// ===============================
const upload = multer({ 
  dest: "uploads/",
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB limit
    fieldSize: 50 * 1024 * 1024  // 50MB for fields
  }
});

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
// Helper: Get Cloudinary upload params by fileType
// ===============================
const getCloudinaryParams = (req, file, fileType) => {
  const timestamp = Date.now();
  const originalName = file.originalname.replace(/\.[^/.]+$/, "");
  const employid = req.params.employid || req.params.employeeId || req.body.employeeId;
  
  const baseParams = {
    public_id: `${employid}_${fileType}_${originalName}_${timestamp}`,
  };

  switch (fileType) {
    case "profileImage":
      return {
        ...baseParams,
        folder: 'employee_profile_images',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { width: 1200, height: 1200, crop: 'limit', quality: 'auto:good' }
        ],
      };
    case "resume":
      return {
        ...baseParams,
        folder: 'employee_resumes',
        resource_type: 'raw',
        format: 'pdf',
        flags: 'attachment',
      };
    case "coverLetter":
      return {
        ...baseParams,
        folder: 'employee_cover_letters',
        resource_type: 'raw',
        format: 'pdf',
        flags: 'attachment',
      };
    case "passport":
      return {
        ...baseParams,
        folder: 'employee_passports',
        resource_type: 'raw', // PDF only
        format: 'pdf',
        flags: 'attachment',
      };
    case "educationCertificate":
      return {
        ...baseParams,
        folder: 'employee_education_certificates',
        resource_type: 'raw', // PDF only
        format: 'pdf',
        flags: 'attachment',
      };
    case "policeClearance":
      return {
        ...baseParams,
        folder: 'employee_police_clearance',
        resource_type: 'raw', // PDF only
        format: 'pdf',
        flags: 'attachment',
      };
    case "mofaAttestation":
      return {
        ...baseParams,
        folder: 'employee_mofa_attestation',
        resource_type: 'raw', // PDF only
        format: 'pdf',
        flags: 'attachment',
      };
    case "profileVideo":
      return {
        ...baseParams,
        folder: 'profileVideos',
        resource_type: 'video',
        chunk_size: 100 * 1024 * 1024,
        eager: [
          { width: 1280, height: 720, crop: 'limit', video_codec: 'h264', format: 'mp4' }
        ],
      };
    case "audio":
      return {
        ...baseParams,
        folder: 'audioFiles',
        resource_type: 'video',
        format: 'mp3',
        audio_codec: 'aac',
        audio_bit_rate: '128k',
      };
    default:
      // Return default params for unknown types
      return {
        ...baseParams,
        folder: 'employee_documents',
        resource_type: 'auto',
      };
  }
};

// ===============================
// Helper: Normalize fileType (trim, lowercase, remove extra words)
// ===============================
const normalizeFileType = (fileType) => {
  if (!fileType) return null;
  
  // Convert to lowercase and trim
  let normalized = String(fileType).toLowerCase().trim();
  
  // Remove common file extensions and extra words (more aggressive)
  normalized = normalized
    .replace(/\s*(pdf|jpg|jpeg|png|doc|docx|image|file|document)\s*/gi, '')
    .replace(/\s+/g, '') // Remove all spaces
    .trim();
  
  // Map common variations to standard types (expanded list)
  const typeMap = {
    'passport': 'passport',
    'passportpdf': 'passport',
    'passportimage': 'passport',
    'passportdoc': 'passport',
    'education': 'educationCertificate',
    'educationcertificate': 'educationCertificate',
    'educationcert': 'educationCertificate',
    'educationpdf': 'educationCertificate',
    'educationcertificatepdf': 'educationCertificate',
    'educationcertpdf': 'educationCertificate',
    'edcertificate': 'educationCertificate',
    'edcert': 'educationCertificate',
    'certificate': 'educationCertificate', // Common abbreviation
    'cert': 'educationCertificate',
    'police': 'policeClearance',
    'policeclearance': 'policeClearance',
    'policeclearancepdf': 'policeClearance',
    'pcc': 'policeClearance',
    'mofa': 'mofaAttestation',
    'mofaattestation': 'mofaAttestation',
    'mofapdf': 'mofaAttestation',
    'profile': 'profileImage',
    'profileimage': 'profileImage',
    'profilepic': 'profileImage',
    'resume': 'resume',
    'resumepdf': 'resume',
    'cv': 'resume',
    'coverletter': 'coverLetter',
    'coverletterpdf': 'coverLetter',
    'cover': 'coverLetter',
  };
  
  // Try exact match first
  if (typeMap[normalized]) {
    console.log(`FileType matched exactly: "${normalized}" -> "${typeMap[normalized]}"`);
    return typeMap[normalized];
  }
  
  // Try partial match (contains) - check if normalized contains any key
  for (const [key, value] of Object.entries(typeMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      console.log(`FileType matched partially: "${normalized}" (contains "${key}") -> "${value}"`);
      return value;
    }
  }
  
  // If still not found, try to extract the main word
  const mainWords = ['passport', 'education', 'police', 'mofa', 'profile', 'resume', 'cover', 'certificate', 'cert'];
  for (const word of mainWords) {
    if (normalized.includes(word)) {
      let result;
      if (word === 'education' || word === 'certificate' || word === 'cert') {
        result = 'educationCertificate';
      } else if (word === 'police') {
        result = 'policeClearance';
      } else if (word === 'mofa') {
        result = 'mofaAttestation';
      } else if (word === 'profile') {
        result = 'profileImage';
      } else if (word === 'cover') {
        result = 'coverLetter';
      } else {
        result = word;
      }
      console.log(`FileType matched by main word: "${normalized}" (contains "${word}") -> "${result}"`);
      return result;
    }
  }
  
  // Return as-is if nothing matches (might be a valid type)
  console.log(`FileType not matched, returning as-is: "${normalized}"`);
  return normalized;
};

// ===============================
// Dynamic Upload Middleware with Compression
// ===============================
const dynamicUploadMiddleware = (req, res, next) => {
  console.log('='.repeat(80));
  console.log('📤 UPLOAD REQUEST RECEIVED');
  console.log('='.repeat(80));
  console.log('URL:', req.url);
  console.log('Method:', req.method);
  console.log('Params:', JSON.stringify(req.params));
  console.log('Query:', JSON.stringify(req.query));
  console.log('Body keys:', Object.keys(req.body || {}));
  console.log('Headers filetype:', req.headers["filetype"]);
  
  let fileType =
    req.query.fileType || req.headers["filetype"] || req.body.fileType;

  console.log('🔍 Original fileType:', fileType);

  // Normalize the fileType
  const originalFileType = fileType;
  fileType = normalizeFileType(fileType);
  
  console.log(`✅ FileType normalization: "${originalFileType}" -> "${fileType}"`);

  if (!fileType) {
    console.error('❌ Invalid or missing fileType');
    return res.status(400).json({ 
      success: false,
      message: "Invalid or missing fileType",
      received: originalFileType
    });
  }

  // Store normalized fileType in request for controller to use
  req.body.fileType = fileType;
  req.query.fileType = fileType;
  
  console.log('📝 Stored normalized fileType in request');

  // Define allowed file types for each fileType
  const allowedFileTypes = {
    profileImage: {
      mimetypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
      extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      description: 'image files (JPG, PNG, WebP, GIF)'
    },
    profileVideo: {
      mimetypes: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
      extensions: ['.mp4', '.mov', '.avi', '.webm', '.mpeg'],
      description: 'video files (MP4, MOV, AVI, WebM)'
    },
    audio: {
      mimetypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-m4a', 'audio/aac', 'audio/ogg'],
      extensions: ['.mp3', '.wav', '.m4a', '.aac', '.ogg'],
      description: 'audio files (MP3, WAV, M4A, AAC)'
    },
    resume: {
      mimetypes: ['application/pdf'],
      extensions: ['.pdf'],
      description: 'PDF files only'
    },
    coverLetter: {
      mimetypes: ['application/pdf'],
      extensions: ['.pdf'],
      description: 'PDF files only'
    },
    passport: {
      mimetypes: ['application/pdf'],
      extensions: ['.pdf'],
      description: 'PDF files only'
    },
    educationCertificate: {
      mimetypes: ['application/pdf'],
      extensions: ['.pdf'],
      description: 'PDF files only'
    },
    policeClearance: {
      mimetypes: ['application/pdf'],
      extensions: ['.pdf'],
      description: 'PDF files only'
    },
    mofaAttestation: {
      mimetypes: ['application/pdf'],
      extensions: ['.pdf'],
      description: 'PDF files only'
    }
  };

  // File filter function
  const fileFilter = (req, file, cb) => {
    const fileTypeConfig = allowedFileTypes[fileType];
    
    if (!fileTypeConfig) {
      console.error(`❌ Unknown fileType: ${fileType}`);
      return cb(new Error(`Unknown file type: ${fileType}`), false);
    }

    // Check mimetype
    const isValidMimetype = fileTypeConfig.mimetypes.includes(file.mimetype.toLowerCase());
    
    // Check file extension
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const isValidExtension = fileTypeConfig.extensions.includes(fileExtension);

    if (isValidMimetype && isValidExtension) {
      console.log(`✅ File type validated: ${file.originalname} (${file.mimetype})`);
      cb(null, true);
    } else {
      console.error(`❌ Invalid file type for ${fileType}:`, {
        filename: file.originalname,
        mimetype: file.mimetype,
        extension: fileExtension,
        allowed: fileTypeConfig.description
      });
      cb(new Error(`Invalid file type. ${fileType} only accepts ${fileTypeConfig.description}. Received: ${file.mimetype} (${fileExtension})`), false);
    }
  };

  // Use memory storage to get file buffer for compression
  const memoryStorage = multer.memoryStorage();
  const upload = multer({
    storage: memoryStorage,
    fileFilter: fileFilter,
    limits: { 
      fileSize: 50 * 1024 * 1024, // 50MB limit (increased for large files before compression)
    },
  }).single("file");

  upload(req, res, (err) => {
    if (err) {
      console.error('❌ Multer upload error:', {
        code: err.code,
        message: err.message,
        field: err.field,
        name: err.name,
        stack: err.stack
      });
      
      if (err.code === "LIMIT_FILE_SIZE") {
        console.error('❌ File size limit exceeded');
        return res
          .status(400)
          .json({ 
            success: false,
            message: "File size exceeds 50MB limit",
            error: "LIMIT_FILE_SIZE"
          });
      }
      
      // Handle file type validation errors
      if (err.message && err.message.includes('Invalid file type')) {
        console.error('❌ Invalid file type uploaded');
        return res
          .status(400)
          .json({ 
            success: false,
            message: err.message,
            error: "INVALID_FILE_TYPE",
            fileType: fileType
          });
      }
      
      console.error('❌ Unknown upload error:', err);
      return res
        .status(500)
        .json({ 
          success: false,
          message: "Upload error", 
          error: err.message,
          code: err.code
        });
    }

    if (!req.file) {
      console.error('❌ No file uploaded in request');
      return res.status(400).json({ 
        success: false,
        message: "No file uploaded" 
      });
    }
    
    console.log('✅ File received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: `${(req.file.size / 1024).toFixed(2)}KB`,
      encoding: req.file.encoding
    });

    // Compress and upload asynchronously
    (async () => {
      try {
        // Validate file buffer exists
        if (!req.file || !req.file.buffer) {
          throw new Error('File buffer is missing');
        }

        // Compress the file before uploading to Cloudinary
        console.log(`[${fileType}] Starting compression for: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)}KB, ${req.file.mimetype})`);
        
        let compressedBuffer;
        try {
          // For PDFs, don't compress (Cloudinary handles PDF optimization)
          // For images, compress if >= 2MB to optimize upload speed
          const isImage = req.file.mimetype.startsWith('image/');
          const isPDF = req.file.mimetype === 'application/pdf';
          const compressionThreshold = isImage ? 2 * 1024 * 1024 : Infinity; // 2MB for images, never compress PDFs
          
          console.log(`[${fileType}] File type: ${isImage ? 'Image' : isPDF ? 'PDF' : 'Other'}, Size: ${(req.file.size / 1024).toFixed(2)}KB`);
          
          compressedBuffer = await compressFile(
            req.file.buffer,
            req.file.mimetype,
            {
              maxWidth: 1920,
              maxHeight: 1920,
              quality: 85,
              maxFileSize: compressionThreshold
            }
          );
          
          const compressionRatio = ((1 - compressedBuffer.length / req.file.size) * 100).toFixed(1);
          console.log(`[${fileType}] Compression result: ${(compressedBuffer.length / 1024).toFixed(2)}KB (${compressionRatio > 0 ? compressionRatio + '% reduction' : 'no compression'})`);
        } catch (compressError) {
          console.error(`[${fileType}] Compression error:`, compressError);
          // Continue with original buffer if compression fails
          compressedBuffer = req.file.buffer;
          console.log(`[${fileType}] Using original file (compression failed)`);
        }

        // Upload compressed file to Cloudinary
        const uploadParams = getCloudinaryParams(req, req.file, fileType);
        
        if (!uploadParams) {
          console.error(`[${fileType}] Failed to get Cloudinary params for fileType: ${fileType}`);
          throw new Error(`Invalid file type: ${fileType}. Please use one of: profileImage, resume, coverLetter, passport, educationCertificate, policeClearance, mofaAttestation`);
        }
        
        console.log(`[${fileType}] Uploading to Cloudinary:`, JSON.stringify({
          folder: uploadParams.folder,
          resource_type: uploadParams.resource_type,
          public_id: uploadParams.public_id?.substring(0, 50) + '...'
        }));
        
        // Set up upload with timeout (longer for larger files)
        // Calculate timeout based on file size: 10 seconds per MB, minimum 60 seconds, maximum 5 minutes
        const fileSizeMB = compressedBuffer.length / (1024 * 1024);
        const timeoutMs = Math.max(60000, Math.min(300000, fileSizeMB * 10000));
        console.log(`[${fileType}] Setting upload timeout to ${(timeoutMs / 1000).toFixed(0)} seconds for ${fileSizeMB.toFixed(2)}MB file`);
        
        const uploadTimeout = setTimeout(() => {
          if (!res.headersSent) {
            console.error(`[${fileType}] Upload timeout after ${(timeoutMs / 1000).toFixed(0)} seconds`);
            return res.status(500).json({
              success: false,
              message: `Upload timeout after ${(timeoutMs / 1000).toFixed(0)} seconds. File may be too large or network is slow. Please try again.`,
              error: "UPLOAD_TIMEOUT",
              fileSize: `${fileSizeMB.toFixed(2)}MB`
            });
          }
        }, timeoutMs);
        
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadParams,
          (error, result) => {
            clearTimeout(uploadTimeout);
            
            if (error) {
              console.error(`[${fileType}] Cloudinary upload error:`, {
                message: error.message,
                http_code: error.http_code,
                name: error.name
              });
              // Ensure we send JSON response, not HTML
              if (!res.headersSent) {
                return res.status(500).json({
                  success: false,
                  message: "Failed to upload file to Cloudinary",
                  error: error.message || "Upload failed",
                  errorCode: error.http_code || error.name,
                  fileType: fileType
                });
              }
              return;
            }

            if (!result || !result.secure_url) {
              console.error(`[${fileType}] Cloudinary upload failed - No URL returned. Result:`, result);
              if (!res.headersSent) {
                return res.status(500).json({
                  success: false,
                  message: "Upload completed but no URL returned from Cloudinary",
                  error: "UPLOAD_FAILED",
                  fileType: fileType
                });
              }
              return;
            }

            // Attach Cloudinary result to req.file for controller
            req.file.secure_url = result.secure_url;
            req.file.url = result.secure_url;
            req.file.public_id = result.public_id;
            req.file.size = compressedBuffer.length; // Update size to compressed size
            
            console.log(`[${fileType}] ✅ File uploaded successfully to Cloudinary: ${result.secure_url.substring(0, 50)}...`);
            console.log(`[${fileType}] 📤 Proceeding to controller...`);
            next();
          }
        );

        // Handle stream errors
        uploadStream.on('error', (streamError) => {
          clearTimeout(uploadTimeout);
          console.error(`[${fileType}] Upload stream error:`, {
            message: streamError.message,
            code: streamError.code,
            stack: streamError.stack
          });
          if (!res.headersSent) {
            return res.status(500).json({
              success: false,
              message: "Error uploading file stream to Cloudinary",
              error: streamError.message || "Stream error",
              errorCode: streamError.code,
              fileType: fileType
            });
          }
        });

        // Create a readable stream from buffer and pipe to Cloudinary
        const bufferStream = new Readable();
        bufferStream.push(compressedBuffer);
        bufferStream.push(null);
        
        bufferStream.on('error', (bufferError) => {
          clearTimeout(uploadTimeout);
          console.error(`[${fileType}] Buffer stream error:`, bufferError);
          if (!res.headersSent) {
            return res.status(500).json({
              success: false,
              message: "Error reading file buffer",
              error: bufferError.message || "Buffer error",
              fileType: fileType
            });
          }
        });
        
        bufferStream.pipe(uploadStream);
      } catch (compressionError) {
        console.log('='.repeat(80));
        console.error(`[${fileType}] ❌❌❌ COMPRESSION/UPLOAD ERROR ❌❌❌`);
        console.log('='.repeat(80));
        console.error("Error details:", {
          name: compressionError.name,
          message: compressionError.message,
          code: compressionError.code,
          stack: compressionError.stack
        });
        console.error("File info:", {
          originalname: req.file?.originalname,
          mimetype: req.file?.mimetype,
          size: req.file?.size,
          hasBuffer: !!req.file?.buffer
        });
        console.log('='.repeat(80));
        
        // Ensure we send JSON response, not HTML
        if (!res.headersSent) {
          console.log(`[${fileType}] 📤 Sending error response to client`);
          return res.status(500).json({
            success: false,
            message: "Error processing file",
            error: compressionError.message || "Processing error",
            errorType: compressionError.name || "UNKNOWN_ERROR",
            fileType: fileType,
            ...(process.env.NODE_ENV === 'development' && { 
              stack: compressionError.stack 
            })
          });
        } else {
          console.error(`[${fileType}] ⚠️ Response already sent, cannot send error response`);
        }
        console.log('='.repeat(80));
      }
    })();
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
// Middleware to handle file upload errors for edit profile
const handleEditProfileUpload = (req, res, next) => {
  upload.fields([
    { name: "userProfilePic", maxCount: 1 },
    { name: "resume", maxCount: 1 },
    { name: "coverLetterFile", maxCount: 1 },
    { name: "passport", maxCount: 1 },
    { name: "educationCertificate", maxCount: 1 },
    { name: "policeClearance", maxCount: 1 },
    { name: "mofaAttestation", maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      console.error('File upload error in edit profile:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: "File size exceeds 50MB limit. Please compress your file and try again.",
          error: "FILE_TOO_LARGE",
          maxSize: "50MB"
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: "Unexpected file field. Please check your file upload fields.",
          error: "UNEXPECTED_FILE_FIELD"
        });
      }
      return res.status(500).json({
        success: false,
        message: "File upload failed",
        error: err.message || "UPLOAD_ERROR"
      });
    }
    next();
  });
};

employeeRoute.post(
  "/edit-form-data/:userId",
  handleEditProfileUpload,
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
