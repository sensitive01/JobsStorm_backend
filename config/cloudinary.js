const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// ==============================
// ✅ Cloudinary Config (SECURE)
// ==============================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==============================
// ✅ Public ID Generator (FIXED)
// ==============================
const generatePublicId = (req, file, prefix) => {
  const userId = req.params.userId || req.body.employeeId || req.body.userId || uuidv4();
  const timestamp = Date.now();
  const cleanName = path
    .parse(file.originalname)
    .name.replace(/[^a-zA-Z0-9-_]/g, "_");

  return `${userId}_${prefix}_${cleanName}_${timestamp}`;
};





// ==============================
// ✅ PROFILE IMAGE
// ==============================
const profileImageStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "employee/profile_images",
    public_id: generatePublicId(req, file, "profile"),
    allowed_formats: ["jpg", "jpeg", "png", "gif"],
    resource_type: "image",
  }),
});


// ==============================
// ✅ CHAT IMAGE
// ==============================
const chatImageStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "chat/images",
    public_id: generatePublicId(req, file, "chatimg"),
    allowed_formats: ["jpg", "jpeg", "png", "gif"],
    resource_type: "image",
  }),
});


// ==============================
// ✅ CHAT AUDIO
// ==============================
const chatAudioStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "chat/audio",
    public_id: generatePublicId(req, file, "chataudio"),
    allowed_formats: ["mp3", "wav", "m4a"],
    resource_type: "video",
  }),
});


// ==============================
// ✅ SEND IMAGE (CHAT / PROFILE)
// ==============================
const sendimage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    const userId = req.body.employeeId || req.body.userId || uuidv4();
    const baseName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9-_]/g, "_");

    return {
      folder: "sendimage",
      public_id: `${userId}_image_${baseName}_${Date.now()}`,
      resource_type: "image",
    };
  }
});


// ==============================
// ✅ EVENT IMAGE
// ==============================
const eventImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "events",
    allowed_formats: ["jpg", "jpeg", "png", "gif"],
    resource_type: "image",
  },
});


// ==============================
// ✅ RESUME
// ==============================
const resumeStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "employee/resumes",
    public_id: generatePublicId(req, file, "resume"),
    allowed_formats: ["pdf", "doc", "docx"],
    resource_type: "raw",
  }),
});


// ==============================
// ✅ COVER LETTER
// ==============================
const coverLetterStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "employee/cover_letters",
    public_id: generatePublicId(req, file, "coverletter"),
    allowed_formats: ["pdf", "doc", "docx"],
    resource_type: "raw",
  }),
});


// ==============================
// ✅ PASSPORT
// ==============================
const passportStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "employee/passports",
    public_id: generatePublicId(req, file, "passport"),
    allowed_formats: ["jpg", "png", "pdf"],
    resource_type: "auto",
  }),
});


// ==============================
// ✅ EDUCATION CERTIFICATE
// ==============================
const educationCertificateStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "employee/education_certificates",
    public_id: generatePublicId(req, file, "edu_cert"),
    allowed_formats: ["jpg", "png", "pdf"],
    resource_type: "auto",
  }),
});


// ==============================
// ✅ POLICE CLEARANCE
// ==============================
const policeClearanceStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "employee/police_clearance",
    public_id: generatePublicId(req, file, "police"),
    allowed_formats: ["jpg", "png", "pdf"],
    resource_type: "auto",
  }),
});


// ==============================
// ✅ MOFA ATTESTATION
// ==============================
const mofaAttestationStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "employee/mofa_attestation",
    public_id: generatePublicId(req, file, "mofa"),
    allowed_formats: ["jpg", "png", "pdf"],
    resource_type: "auto",
  }),
});


// ==============================
// ✅ PROFILE VIDEO
// ==============================
const profileVideoStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "employee/profile_videos",
    public_id: generatePublicId(req, file, "video"),
    allowed_formats: ["mp4", "mov", "avi"],
    resource_type: "video",
  }),
});


// ==============================
// ✅ INTRO AUDIO
// ==============================
const audioStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "employee/audio",
    public_id: generatePublicId(req, file, "audio"),
    allowed_formats: ["mp3", "wav", "m4a"],
    resource_type: "video",
  }),
});


// ==============================
// ✅ BUFFER UPLOADER (OPTIONAL)
// ==============================
const uploadImage = async (imageBuffer, folder) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    ).end(imageBuffer);
  });
};


// ==============================
// ✅ EXPORTS
// ==============================
module.exports = {
  cloudinary,
  uploadImage,

  profileImageStorage,
  chatImageStorage,
  chatAudioStorage,
  sendimage,
  eventImageStorage,

  resumeStorage,
  coverLetterStorage,

  passportStorage,
  educationCertificateStorage,
  policeClearanceStorage,
  mofaAttestationStorage,

  profileVideoStorage,
  audioStorage,
};
