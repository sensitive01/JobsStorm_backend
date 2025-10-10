const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Job = require("../../models/jobSchema");
const userModel = require("../../models/employeeschema");
const Employee = require('../../models/employeeschema');

const generateOTP = require("../../utils/generateOTP");
const jwtDecode = require("jwt-decode");
const jwksClient = require("jwks-rsa");
const sendEmail = require("../../utils/sendEmail");
const { v4: uuidv4 } = require("uuid");
const {
  cloudinary,
  profileImageStorage,
  resumeStorage,
  coverLetterStorage,
  profileVideoStorage,
} = require("../../config/cloudinary");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const appleKeysClient = jwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
});
const mongoose = require("mongoose");
const JobFilter = require("../../models/jobAlertModal");

// Email/Mobile Signup
const signUp = async (req, res) => {
  try {
    console.log("req.body", req.body);
    const { userName, userMobile, userEmail, userPassword, referralCode } =
      req.body;
    const mobile = parseInt(userMobile);

    const existUser = await userModel.findOne({
      $or: [{ userMobile: mobile }, { userEmail }],
    });

    if (existUser) {
      return res.status(400).json({ message: "Employee already registered." });
    }

    const hashedPassword = await bcrypt.hash(userPassword, 10);

    const newUser = new userModel({
      uuid: uuidv4(),
      userName,
      userMobile: mobile,
      userEmail,
      userPassword: hashedPassword,
      verificationstatus: "pending",
      blockstatus: "unblock",
      emailverifedstatus: true,
    });

    // Generate and assign referral code
    newUser.referralCode = newUser.generateReferralCode();

    let referralApplied = false;
    if (referralCode && referralCode.trim() !== "") {
      const referrer = await userModel.findOne({
        referralCode: referralCode.trim(),
      });

      if (referrer) {
        newUser.referredBy = referrer._id;
        referralApplied = true;

        await userModel.findByIdAndUpdate(referrer._id, {
          $inc: {
            referralCount: 1,
            referralRewards: 100,
          },
        });
      }
    }

    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      message: "Employee registered successfully.",
      user: newUser,
      token,
    });
  } catch (err) {
    console.error("Error in registration:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const getAllEmployees = async (req, res) => {
  try {
    const employees = await userModel.find(); // You can add `.select()` to limit fields
    res.status(200).json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ message: "Failed to fetch employees" });
  }
};
// Email/Mobile Login
const login = async (req, res) => {
  try {
    const { userMobile, userEmail, userPassword, fcmToken } = req.body;

    if (!userMobile && !userEmail) {
      return res.status(400).json({ message: "Mobile or email is required." });
    }

    const user = await userModel.findOne({
      $or: [
        ...(userMobile ? [{ userMobile: userMobile.toString() }] : []),
        ...(userEmail ? [{ userEmail }] : []),
      ],
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Please check your email and password." });
    }

    const match = await bcrypt.compare(userPassword, user.userPassword);
    if (!match) {
      return res
        .status(400)
        .json({ message: "Please check your email and password." });
    }

    // ✅ Optional FCM token saving logic
    if (
      fcmToken &&
      typeof fcmToken === "string" &&
      !user.employeefcmtoken.includes(fcmToken)
    ) {
      user.employeefcmtoken.push(fcmToken);
      await user.save(); // only if token is new
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const { userPassword: _, ...safeUser } = user._doc;

    res.json({
      message: "Login successful",
      user: safeUser,
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Google Sign-In
const googleAuth = async (req, res) => {
  const { idToken } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    let user = await userModel.findOne({ googleId: payload.sub });
    if (!user) {
      user = new userModel({
        uuid: generateUserUUID(),
        googleId: payload.sub,
        userEmail: payload.email,
        userName: payload.name,
        userProfilePic: payload.picture,
        isVerified: true,
      });
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({
      message: "Google login successful",
      user,
      token,
    });
  } catch (err) {
    console.error("Google auth error:", err);
    res
      .status(401)
      .json({ message: "Invalid Google token", error: err.message });
  }
};
// Apple Sign-In
const appleAuth = async (req, res) => {
  const { idToken } = req.body;
  try {
    const decoded = jwtDecode(idToken);
    let user = await userModel.findOne({ appleId: decoded.sub });

    if (!user) {
      user = new userModel({
        uuid: uuidv4(),
        appleId: decoded.sub,
        userEmail: decoded.email,
        userName: "Apple User",
        isVerified: true,
      });
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({
      message: "Apple login successful",
      user,
      token,
    });
  } catch (err) {
    console.error("Apple auth error:", err);
    res.status(401).json({ message: "Invalid Apple token" });
  }
};

const getEmployeeDetails = async (req, res) => {
  try {
    const employeeId = req.userId || req.params.id;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required" });
    }

    const employee = await userModel
      .findById(employeeId)
      .select("-userPassword");

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(employee);
  } catch (err) {
    console.error("Error fetching employee details:", err);
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid employee ID format" });
    }
    res.status(500).json({ message: "Server error" });
  }
};
const applyForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const {
      applicantId,
      firstName,
      email,
      phone,
      resume,
      experience,
      jobrole,
      currentcity,
      profileurl, // <-- Extract profileurl from body
    } = req.body;

    // Optionally validate required fields
    // if (!applicantId || !firstName) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Missing required fields'
    //   });
    // }

    const application = {
      applicantId,
      firstName,
      email,
      phone,
      jobrole,
      experience,
      currentcity,
      resume: {
        name: resume?.name || "resume.pdf",
        url: resume?.url || "",
      },
      profileurl, // <-- Add profileurl to application
      status: "Applied",
    };

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      { $push: { applications: application } },
      { new: true }
    );

    if (!updatedJob) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: updatedJob.applications.slice(-1)[0],
    });
  } catch (error) {
    console.error("Error submitting application:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const getApplicationStatus = async (req, res) => {
  try {
    const { jobId, applicantId } = req.params;

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const application = job.applications.find(
      (app) => app.applicantId === applicantId
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found for this applicant",
      });
    }

    res.status(200).json({
      success: true,
      message: "Application status fetched successfully",
      status: application.status,
      application,
    });
  } catch (error) {
    console.error("Error fetching application status:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// employeeController.js

const uploadFile = async (req, res) => {
  try {
    const { employid } = req.params;
    const fileType = req.query.fileType || req.body.fileType;

    // Validate inputs
    if (!employid || !mongoose.isValidObjectId(employid)) {
      return res.status(400).json({ message: "Valid employee ID is required" });
    }

    if (!fileType) {
      return res
        .status(400)
        .json({ message: "File type (fileType) is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = req.file;

    // Check if we have a valid URL in the result
    if (!result.secure_url && !result.url && !result.path) {
      return res.status(500).json({
        message: "Cloudinary upload failed: No URL returned",
        details: result,
      });
    }

    // Use secure_url if available, otherwise fall back to url or path
    const fileUrl = result.secure_url || result.url || result.path;

    // First, get the current employee to check for existing files
    const currentEmployee = await userModel.findById(employid);
    if (!currentEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Delete old file from Cloudinary if it exists
    try {
      switch (fileType) {
        case "profileImage":
          if (currentEmployee.userProfilePic) {
            const publicId = currentEmployee.userProfilePic
              .split("/")
              .slice(-2)
              .join("/")
              .split(".")[0];
            await cloudinary.uploader.destroy(publicId);
          }
          break;
        case "resume":
          if (currentEmployee.resume?.url) {
            const publicId = currentEmployee.resume.url
              .split("/")
              .slice(-2)
              .join("/")
              .split(".")[0];
            await cloudinary.uploader.destroy(publicId, {
              resource_type: "raw",
            });
          }
          break;
        case "coverLetter":
          if (currentEmployee.coverLetterFile?.url) {
            const publicId = currentEmployee.coverLetterFile.url
              .split("/")
              .slice(-2)
              .join("/")
              .split(".")[0];
            await cloudinary.uploader.destroy(publicId, {
              resource_type: "raw",
            });
          }
          break;
      }
    } catch (deleteError) {
      console.error("Error deleting old file:", deleteError);
      // Continue with the update even if deletion fails
    }

    // Prepare field update
    let updateField;
    switch (fileType) {
      case "profileImage":
        updateField = { userProfilePic: fileUrl };
        break;
      case "resume":
        updateField = {
          resume: {
            name: result.originalname || result.filename || "Unnamed",
            url: fileUrl,
          },
        };
        break;
      case "coverLetter":
        updateField = {
          coverLetterFile: {
            name: result.originalname || result.filename || "Unnamed",
            url: fileUrl,
          },
        };
        break;
      default:
        return res.status(400).json({ message: "Invalid file type provided" });
    }

    // Update employee document
    const updatedEmployee = await userModel.findByIdAndUpdate(
      employid,
      { $set: updateField },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      fileType,
      file: {
        name: result.originalname || result.filename || "Unnamed",
        url: fileUrl,
      },
      message: "File uploaded and saved successfully",
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during file upload",
      error: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { employid } = req.params;
    const profileData = req.body;

    // Update employee profile
    const updatedEmployee = await userModel.findByIdAndUpdate(
      employid,
      { $set: profileData },
      { new: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      data: updatedEmployee,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

const appliedjobsfetch = async (req, res) => {
  const { applicantId } = req.params;

  try {
    const jobs = await Job.aggregate([
      {
        $match: {
          "applications.applicantId": applicantId,
        },
      },
      {
        $addFields: {
          employidObject: { $toObjectId: "$employid" },
        },
      },
      {
        $lookup: {
          from: "employers",
          localField: "employidObject",
          foreignField: "_id",
          as: "employerInfo",
        },
      },
      {
        $unwind: {
          path: "$employerInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          employerProfilePic: "$employerInfo.userProfilePic",
          employerName: {
            $concat: ["$employerInfo.firstName", " ", "$employerInfo.lastName"],
          },
        },
      },
      {
        $project: {
          employerInfo: 0,
          employidObject: 0,
        },
      },
    ]);

    if (!jobs || jobs.length === 0) {
      return res
        .status(404)
        .json({ message: "No jobs found for this applicant." });
    }

    res.status(200).json(jobs);
  } catch (error) {
    console.error("Error fetching jobs by applicant:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const calculateProfileCompletion = (employee) => {
  let score = 0;
  const report = {
    basicInfo: 0,
    address: 0,
    education: 0,
    workExperience: 0,
    profileDetails: 0,
    documents: 0,
    socialLinks: 0,
    jobPreferences: 0,
    total: 0,
  };

  // Basic Info (20%)
  if (employee.userName) report.basicInfo += 3.33;
  if (employee.userEmail) report.basicInfo += 3.33;
  if (employee.userMobile) report.basicInfo += 3.33;
  if (employee.dob) report.basicInfo += 3.33;
  if (employee.gender) report.basicInfo += 3.33;
  if (employee.maritalStatus) report.basicInfo += 3.33;

  // Address (10%)
  if (employee.addressLine1) report.address += 2.5;
  if (employee.city) report.address += 2.5;
  if (employee.state) report.address += 2.5;
  if (employee.pincode) report.address += 2.5;

  // Education (15%)
  if (employee.education && employee.education.length > 0)
    report.education += 15;

  // Work Experience (15%)
  if (
    employee.totalExperience === "Fresher" ||
    (employee.workExperience && employee.workExperience.length > 0)
  )
    report.workExperience += 15;

  // Profile Details (15%)
  if (employee.userProfilePic) report.profileDetails += 3.75;
  if (employee.profilesummary) report.profileDetails += 3.75;
  if (employee.skills) report.profileDetails += 3.75;
  if (employee.languages) report.profileDetails += 3.75;

  // Documents (10%)
  if (employee.resume?.url) report.documents += 10;

  // Social/Online Links (5%)
  if (employee.github) report.socialLinks += 1.66;
  if (employee.linkedin) report.socialLinks += 1.66;
  if (employee.portfolio) report.socialLinks += 1.66;

  // Job Preferences (10%)
  // if (employee.preferredLocation) report.jobPreferences += 2;
  if (employee.expectedSalary) report.jobPreferences += 2;
  if (employee.currentCity) report.jobPreferences += 4;

  if (employee.gradeLevels) report.jobPreferences += 4;

  // Calculate Total
  report.total = Math.round(
    report.basicInfo +
      report.address +
      report.education +
      report.workExperience +
      report.profileDetails +
      report.documents +
      report.socialLinks +
      report.jobPreferences
  );

  return report;
};

const getProfileCompletion = async (req, res) => {
  try {
    const employee = await userModel.findById(req.params.id);
    if (!employee)
      return res.status(404).json({ message: "Employee not found" });

    const percentageReport = calculateProfileCompletion(employee);
    res.json({ total: percentageReport.total }); // Return only the total
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

const userForgotPassword = async (req, res) => {
  try {
    const { userMobile } = req.body;

    const existUser = await userModel.findOne({ userMobile: userMobile });

    if (!existUser) {
      return res.status(404).json({
        message: "User not found with the provided contact number",
      });
    }

    if (!userMobile) {
      return res.status(400).json({ message: "Mobile number is required" });
    }

    const otp = generateOTP();
    console.log("Generated OTP:", otp);

    req.app.locals.otp = otp;

    return res.status(200).json({
      message: "OTP sent successfully",
      otp: otp,
    });
  } catch (err) {
    console.log("Error in sending OTP in forgot password:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ message: "OTP is required" });
    }

    if (req.app.locals.otp) {
      if (otp == req.app.locals.otp) {
        return res.status(200).json({
          message: "OTP verified successfully",
          success: true,
        });
      } else {
        return res.status(400).json({
          message: "Invalid OTP",
          success: false,
        });
      }
    } else {
      return res.status(400).json({
        message: "OTP has expired or is invalid",
        success: false,
      });
    }
  } catch (err) {
    console.log("Error in OTP verification:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const userChangePassword = async (req, res) => {
  try {
    console.log("Welcome to user change password");

    const { userMobile, password, confirmPassword } = req.body;

    // Validate inputs
    if (!userMobile || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Find the user by contact number
    const user = await userModel.findOne({ userMobile: userMobile });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update the user's password field
    user.userPassword = hashedPassword;

    // Save the updated user to trigger schema validation and middleware
    await user.save();

    // Send success response
    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Error in user change password:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const candidateChangePassword = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Validate inputs
    if (!candidateId || !currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Find candidate
    const candidate = await userModel.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(
      currentPassword,
      candidate.userPassword
    );
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Prevent reusing old password
    const isSamePassword = await bcrypt.compare(
      newPassword,
      candidate.userPassword
    );
    if (isSamePassword) {
      return res
        .status(400)
        .json({ message: "New password cannot be same as old password" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update candidate's password
    candidate.userPassword = hashedPassword;
    await candidate.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Error in candidateChangePassword:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const uploadProfileVideo = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const file = req.file;

    console.log("Received file:", file);

    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const fileInfo = {
      name: file.originalname,
      url: file.path,
      thumbnail: `${file.path}-thumbnail`, // Adjust if you're generating real thumbnails
    };

    const updatedEmployee = await userModel.findByIdAndUpdate(
      employeeId,
      { profileVideo: fileInfo },
      { new: true } // returns updated document (optional)
    );

    if (!updatedEmployee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    res.status(200).json({
      success: true,
      message: "Profile video uploaded successfully",
      file: fileInfo,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT: Upload intro audio for an employee
const uploadIntroAudio = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const file = req.file;

    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const updatedEmployee = await userModel.findByIdAndUpdate(
      employeeId,
      {
        introductionAudio: {
          name: file.originalname,
          url: file.path,
          duration: req.body.duration || 0,
        },
      },
      { new: true }
    );

    res.status(200).json({ success: true, employee: updatedEmployee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const sendOtpToEmail = async (req, res) => {
  const { userEmail } = req.body;

  try {
    // Find existing user or create new
    let employer = await userModel.findOne({ userEmail });

    if (!employer) {
      // If not found, create a new user with just the email
      employer = new userModel({ userEmail });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

    // Update OTP fields
    employer.otp = otp;
    employer.otpExpires = otpExpires;

    await employer.save();
    console.log(`OTP generated: ${otp} for email: ${userEmail}`);

    // Send email
    try {
      await sendEmail(userEmail, "Your OTP Code", `Your OTP is: ${otp}`);
      console.log("OTP email sent successfully");
    } catch (emailErr) {
      console.error("Failed to send OTP email:", emailErr);
      return res
        .status(500)
        .json({ message: "Failed to send OTP email", error: emailErr });
    }

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error in sendOtpToEmail:", error);
    return res.status(500).json({ message: "Error sending OTP", error });
  }
};

const verifyEmailOtp = async (req, res) => {
  const { userEmail, otp } = req.body;

  try {
    const employer = await userModel.findOne({ userEmail });

    if (!employer) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check OTP and expiry
    const isOtpValid = employer.otp === otp;
    const isOtpExpired = new Date() > new Date(employer.otpExpires);

    if (!isOtpValid || isOtpExpired) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Mark email as verified
    employer.emailverifedstatus = true;
    employer.otp = undefined;
    employer.otpExpires = undefined;

    await employer.save();

    return res.status(200).json({
      message: "Email verified successfully",
      emailverifedstatus: employer.emailverifedstatus,
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({ message: "OTP verification failed", error });
  }
};

const verifyTheCandidateRegisterOrNot = async (req, res) => {
  try {
    const { candidateEmail } = req.params;

    const candidateData = await userModel.findOne({
      userEmail: candidateEmail,
    });
    console.log(candidateData);
    const token = jwt.sign({ id: candidateData._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    if (candidateData) {
      return res.status(200).json({ exists: true, candidateData, token });
    } else {
      return res.status(200).json({ exists: false });
    }
  } catch (err) {
    console.error("Error verifying candidate:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const addJobAlert = async (req, res) => {
  try {
    console.log("submitData", req.body);

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    console.log("token", token);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded.id; // make sure your token payload has `id`

    const {
      salaryFrom,
      salaryTo,
      location,
      workType,
      experience,
      jobCategories,
    } = req.body;

    // ✅ Find by userId and update, or create new if not exists
    const updatedJobAlert = await JobFilter.findOneAndUpdate(
      { userId },
      {
        salaryFrom,
        salaryTo,
        location,
        workType,
        experience,
        jobCategories,
        userId,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    res.status(200).json({
      success: true,
      data: updatedJobAlert,
      message: "Job alert saved successfully",
    });
  } catch (err) {
    console.error("Error in addJobAlert:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getDesiredJobAlerts = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const userJobPreference = await JobFilter.findOne({ userId });
    if (!userJobPreference) {
      return res.status(404).json({ message: "No job preference found" });
    }

    const query = {
      $or: [],
    };

    if (userJobPreference.salaryFrom && userJobPreference.salaryTo) {
      query.$or.push({
        $and: [
          { salaryFrom: { $lte: userJobPreference.salaryTo } },
          { salaryTo: { $gte: userJobPreference.salaryFrom } },
        ],
      });
    }

    if (userJobPreference.location) {
      query.$or.push({ location: userJobPreference.location });
    }

    if (userJobPreference.workType) {
      query.$or.push({ jobType: userJobPreference.workType });
    }

    if (userJobPreference.experience) {
      query.$or.push({ experienceLevel: userJobPreference.experience });
    }

    if (userJobPreference.jobCategories?.length > 0) {
      query.$or.push({ category: { $in: userJobPreference.jobCategories } });
    }

    if (query.$or.length === 0) {
      return res.status(200).json({ jobAlerts: [] });
    }

    const jobAlerts = await Job.find(query);

    return res.status(200).json({ jobAlerts ,userJobPreference});
  } catch (err) {
    console.error("Error getting desired job alerts:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const getDesiredJobAlertswithouttoken = async (req, res) => {
  try {
    const { userId } = req.query; // ✅ Change from req.body to req.query

    // Validate userId presence
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const userJobPreference = await JobFilter.findOne({ userId });
    if (!userJobPreference) {
      return res.status(404).json({ success: false, message: "No job preference found" });
    }

    const query = {
      $or: [],
    };

    // Match salary range
    if (userJobPreference.salaryFrom && userJobPreference.salaryTo) {
      query.$or.push({
        $and: [
          { salaryFrom: { $lte: userJobPreference.salaryTo } },
          { salaryTo: { $gte: userJobPreference.salaryFrom } },
        ],
      });
    }

    // Match location
    if (userJobPreference.location) {
      query.$or.push({ location: userJobPreference.location });
    }

    // Match work type
    if (userJobPreference.workType) {
      query.$or.push({ jobType: userJobPreference.workType });
    }

    // Match experience level
    if (userJobPreference.experience) {
      query.$or.push({ experienceLevel: userJobPreference.experience });
    }

    // Match categories
    if (userJobPreference.jobCategories?.length > 0) {
      query.$or.push({ category: { $in: userJobPreference.jobCategories } });
    }

    // If no filters available
    if (query.$or.length === 0) {
      return res.status(200).json({ success: true, jobAlerts: [], userJobPreference });
    }

    const jobAlerts = await Job.find(query);

    return res.status(200).json({ success: true, jobAlerts, userJobPreference });
  } catch (err) {
    console.error("Error getting desired job alerts:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const addwithouttoeken = async (req, res) => {
  try {
    console.log("submitData", req.body);

    const {
      userId,
      salaryFrom,
      salaryTo,
      location,
      workType,
      experience,
      jobCategories,
    } = req.body;

    // Validate userId presence
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    // Find by userId and update, or create new if not exists
    const updatedJobAlert = await JobFilter.findOneAndUpdate(
      { userId },
      {
        salaryFrom,
        salaryTo,
        location,
        workType,
        experience,
        jobCategories,
        userId,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    res.status(200).json({
      success: true,
      data: updatedJobAlert,
      message: "Job alert saved successfully",
    });
  } catch (err) {
    console.error("Error in addJobAlert:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



const fetchAvailabilityStatus = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }

    const employee = await Employee.findById(employeeId).select('isAvailable');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.status(200).json({
      message: 'Availability status fetched successfully',
      isAvailable: employee.isAvailable || false,
    });
  } catch (error) {
    console.error('Error fetching availability status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateAvailabilityStatus = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const { isAvailable } = req.body;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: 'Invalid employee ID' });
    }

    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ message: 'isAvailable must be a boolean value' });
    }

    const employee = await Employee.findByIdAndUpdate(
      employeeId,
      {
        isAvailable,
        updatedAt: Date.now(),
      },
      { new: true, runValidators: true }
    ).select('isAvailable userName userEmail');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.status(200).json({
      message: 'Availability status updated successfully',
      employee: {
        id: employee._id,
        userName: employee.userName,
        userEmail: employee.userEmail,
        isAvailable: employee.isAvailable,
      },
    });
  } catch (error) {
    console.error('Error updating availability status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


//hbh
module.exports = {
  addwithouttoeken,
  addJobAlert,
  getDesiredJobAlerts,
  verifyTheCandidateRegisterOrNot,
  sendOtpToEmail,
  verifyEmailOtp,
  signUp,
  login,
  getDesiredJobAlertswithouttoken,
  googleAuth,
  getEmployeeDetails,
  appleAuth,
  uploadFile,
  uploadProfileVideo,
  applyForJob,
  uploadIntroAudio,
  userChangePassword,
  userForgotPassword,
  verifyOTP,
  getAllEmployees,
  getProfileCompletion,
  calculateProfileCompletion,
  getApplicationStatus,
  appliedjobsfetch,
  updateProfile,
  candidateChangePassword,
    fetchAvailabilityStatus,      // <-- Add this
  updateAvailabilityStatus,  
};
