const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

cloudinary.config({
  cloud_name: 'dsyqzw9ft',
  api_key: '639592464425626',
  api_secret: '1bdQpon4QnDnkKOFCtORmyjU2c0',
});

const generatePublicId = (req, file, prefix) => {
  const timestamp = Date.now();
  const originalName = file.originalname.replace(/\.[^/.]+$/, "");
  return `${req.params.employid || req.body.employeeId || req.body.employerId}_${prefix}_${originalName}_${timestamp}`;
};

const profileImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => ({
    folder: 'employee_profile_images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    public_id: generatePublicId(req, file, 'profile'),
    transformation: [{ width: 500, height: 500, crop: 'limit' }],
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
  },
});

const chatImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => ({
    folder: 'chatimage',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    public_id: generatePublicId(req, file, 'chatimage'),
    transformation: [{ width: 500, height: 500, crop: 'limit' }],
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
  params: {
    folder: 'event_images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [{ width: 1000, height: 500, crop: 'limit' }],
    resource_type: 'image',
  },
});

const resumeStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => ({
    folder: 'employee_resumes',
    allowed_formats: ['pdf', 'doc', 'docx', 'txt'],
    public_id: generatePublicId(req, file, 'resume'),
    resource_type: 'raw',
    format: 'pdf',
  }),
});

const coverLetterStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => ({
    folder: 'employee_cover_letters',
    allowed_formats: ['pdf', 'doc', 'docx', 'txt'],
    public_id: generatePublicId(req, file, 'coverletter'),
    resource_type: 'raw',
    format: 'pdf',
  }),
});
const profileVideoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    resource_type: 'video', // ✅ VERY IMPORTANT
    folder: 'profileVideos',
    allowed_formats: ['mp4', 'mov', 'avi'],
    public_id: (req, file) => `video-${Date.now()}-${file.originalname}`,
  },
});
const audioStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    resource_type: 'video', // ✅ Audio is treated as 'video' in Cloudinary
    folder: 'audioFiles',
    allowed_formats: ['mp3', 'wav', 'm4a'],
    public_id: (req, file) => `audio-${Date.now()}-${file.originalname}`,
  },
});
const uploadImage = async (imageBuffer, folder) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: folder, 
        resource_type: "auto",
      },
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