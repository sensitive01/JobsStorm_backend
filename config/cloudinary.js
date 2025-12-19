const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

cloudinary.config({
   cloud_name: process.env.CLOUDINARY_NAME,
   api_key: process.env.CLOUDINARY_API_KEY,
   api_secret: process.env.CLOUDINARY_API_SECRET,
   // Increase timeout for large file uploads
   timeout: 60000, // 60 seconds
   chunk_size: 20 * 1024 * 1024, // 20MB chunks for large files
});

const generatePublicId = (req, file, prefix) => {
  const timestamp = Date.now();
  const originalName = file.originalname.replace(/\.[^/.]+$/, "");
  return `${req.params.employid || req.body.employeeId || req.body.employerId}_${prefix}_${originalName}_${timestamp}`;
};

// Common document settings
const getDocumentSettings = () => ({
  resource_type: 'raw',
  format: 'pdf',
  flags: 'attachment', // Forces download instead of preview
  quality_analysis: true, // Enable quality analysis
  colors: true, // Preserve colors in documents
  secure: true, // Force HTTPS
  fetch_format: 'auto', // Auto-optimize format
  transformation: [
    { dpr: 'auto', quality: 'auto:good' }
  ]
});

// Common image transformation settings
const getImageTransformations = () => ({
  quality: 'auto:good',  // Auto quality with good compression
  fetch_format: 'auto',  // Auto-select best format (WebP, AVIF, etc.)
  dpr: 'auto',           // Device pixel ratio
  width: 1200,           // Max width
  height: 1200,          // Max height
  crop: 'limit',         // Maintain aspect ratio
  flags: 'progressive',  // Progressive JPEGs
  format: 'jpg',         // Default format
  transformation: [
    { width: 1200, height: 1200, crop: 'limit', quality: 'auto:good' }
  ]
});

const profileImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => ({
    folder: 'employee_profile_images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: generatePublicId(req, file, 'profile'),
    ...getImageTransformations(),
    resource_type: 'image',
  }),
});

const sendimage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'sendimage',
    public_id: (req, file) => {
      const userId = req.body.employeeId || req.body.employerId || req.body.userId || uuidv4();
      const baseName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9-_]/g, '_');
      return `${userId}_profile_${baseName}_${Date.now()}`;
    },
    ...getImageTransformations(),
  },
});

const chatImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => ({
    folder: 'chatimage',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: generatePublicId(req, file, 'chatimage'),
    ...getImageTransformations(),
    transformation: [
      { width: 800, height: 600, crop: 'limit', quality: 'auto:good' }
    ],
    resource_type: 'image',
  }),
});

const chatAudioStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => ({
    folder: 'chataudio',
    allowed_formats: ['m4a', 'mp3', 'wav'],
    public_id: generatePublicId(req, file, 'chataudio'),
    resource_type: 'video', // Cloudinary uses 'video' for audio files
  }),
});

const eventImageStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: 'event_images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: generatePublicId(req, file, 'event'),
    ...getImageTransformations(),
    transformation: [
      { width: 1600, height: 900, crop: 'limit', quality: 'auto:good' }
    ],
    resource_type: 'image',
  }),
});

const resumeStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => ({
    folder: 'employee_resumes',
    allowed_formats: ['pdf', 'doc', 'docx', 'txt'],
    public_id: generatePublicId(req, file, 'resume'),
    ...getDocumentSettings(req, file),
    // Specific settings for resumes
    format: file.originalname.endsWith('.pdf') ? 'pdf' : 'docx',
    pages: true, // Extract first page for thumbnail
    page: 1
  }),
});

const coverLetterStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => ({
    folder: 'employee_cover_letters',
    allowed_formats: ['pdf', 'doc', 'docx', 'txt'],
    public_id: generatePublicId(req, file, 'coverletter'),
    ...getDocumentSettings(req, file),
    format: 'pdf',
  }),
});

// Video optimization settings
const getVideoSettings = () => ({
  resource_type: 'video',
  chunk_size: 100 * 1024 * 1024, // 100MB chunks for large files
  eager: [
    { width: 1280, height: 720, crop: 'limit', video_codec: 'h264', format: 'mp4' },
    { width: 854, height: 480, crop: 'limit', video_codec: 'h264', format: 'mp4' },
    { width: 640, height: 360, crop: 'limit', video_codec: 'h264', format: 'mp4' }
  ],
  eager_async: true,
  eager_notification_url: process.env.WEBHOOK_URL,
  quality_analysis: true,
  colors: true,
  audio_codec: 'aac',
  audio_frequency: 44100,
  bit_rate: '2500k',
  fallback_content: 'Video format not supported',
  format: 'mp4',
  transformation: [
    { width: 1280, height: 720, crop: 'limit', quality: 'auto:good' }
  ]
});

// Audio optimization settings
const getAudioSettings = () => ({
  resource_type: 'video', // Cloudinary treats audio as video
  format: 'mp3',
  audio_codec: 'aac',
  audio_bit_rate: '128k',
  audio_frequency: 44100,
  quality_analysis: true,
  fallback_content: 'Audio format not supported',
  transformation: [
    { audio_codec: 'aac', audio_bit_rate: '128k' }
  ]
});

const profileVideoStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: 'profileVideos',
    allowed_formats: ['mp4', 'mov', 'avi', 'webm', 'mkv'],
    public_id: `video-${Date.now()}-${path.parse(file.originalname).name}`,
    ...getVideoSettings(),
    // Additional video-specific settings
    transformation: [
      { width: 1280, height: 720, crop: 'limit', quality: 'auto:good' },
      { streaming_profile: 'hd' },
      { fallback_content: 'Video format not supported' }
    ]
  }),
});

const audioStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: 'audioFiles',
    allowed_formats: ['mp3', 'wav', 'm4a', 'ogg', 'aac'],
    public_id: `audio-${Date.now()}-${path.parse(file.originalname).name}`,
    ...getAudioSettings(),
    // Additional audio-specific settings
    transformation: [
      { audio_codec: 'aac', audio_bit_rate: '128k' },
      { fallback_content: 'Audio format not supported' }
    ]
  }),
});

const uploadImage = async (imageBuffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: folder, 
      resource_type: "auto",
      timeout: 60000, // 60 seconds timeout
      chunk_size: 20 * 1024 * 1024, // 20MB chunks
      ...options
    };
    
    cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          return reject(new Error("Cloudinary upload failed: " + error.message));
        }
        resolve(result.secure_url);
      }
    ).end(imageBuffer); 
  });
};
module.exports = {
  cloudinary,
  uploadImage,
  sendimage,
  audioStorage,
  profileVideoStorage,
  profileImageStorage,
  eventImageStorage,
  resumeStorage,
  chatImageStorage,
  chatAudioStorage,
  coverLetterStorage,
};