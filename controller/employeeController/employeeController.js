const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Job = require("../../models/jobSchema");
const userModel = require("../../models/employeeschema");
const Employee = require("../../models/employeeschema");
const demoModel = require("../../models/bookDemoModal");
const Employer = require("../../models/employerSchema");

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
const blogSchema = require("../../models/blogSchema");

// Email/Mobile Signup
const signUp = async (req, res) => {
  try {
    console.log("req.body", req.body);
    const {
      userName,
      userMobile,
      userEmail,
      userPassword,
      referralCode,
      countryCode,
    } = req.body;

    // Clean and keep mobile as string
    const mobile = userMobile.replace(/[^0-9]/g, "");

    // Check if user already exists
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
      userMobile: mobile, // ✅ now string
      userEmail,
      userPassword: hashedPassword,
      verificationstatus: "pending",
      blockstatus: "unblock",
      emailverifedstatus: true,
      countryCode,
    });

    // Generate and assign referral code
    newUser.referralCode = newUser.generateReferralCode();

    // Handle referral
    if (referralCode && referralCode.trim() !== "") {
      const referrer = await userModel.findOne({
        referralCode: referralCode.trim(),
      });

      if (referrer) {
        newUser.referredBy = referrer._id;

        await userModel.findByIdAndUpdate(referrer._id, {
          $inc: { referralCount: 1, referralRewards: 100 },
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
    console.log("req.body", req.body);
    const { jobId, candidateId } = req.params;
    console.log("jobId, candidateId ", jobId, candidateId);
    const { uploadedFileUrl, coverLetter } = req.body;
    const candidateData = await Employee.findOne(
      { _id: candidateId },
      { userName: 1, subscription: 1 }
    );

    if (!candidateData) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    // Check subscription status
    const subscription = candidateData.subscription || {};
    const now = new Date();
    const isActive =
      subscription.status === "active" &&
      subscription.endDate &&
      new Date(subscription.endDate) > now;

    // Get plan details from database to determine features
    const EmployeePlan = require("../../models/employeePlansSchema");
    const plan = await EmployeePlan.findOne({
      planId: subscription.planType || "silver",
      isActive: true
    });

    const hasImmediateCall =
      isActive &&
      plan?.features?.immediateInterviewCall === true &&
      subscription.immediateInterviewCall;

    // Determine priority based on subscription plan features
    let priority = "normal";
    if (isActive && plan?.features?.priorityToRecruiters) {
      const priorityLevel = plan.features.priorityToRecruiters;
      if (priorityLevel === "highest") {
        priority = "highest";
      } else if (priorityLevel === "medium") {
        priority = "medium";
      }
    }

    const application = {
      applicantId: candidateId,
      firstName: candidateData.userName,
      email: candidateData.userEmail,
      phone: candidateData.userMobile,
      resume: {
        name: `${candidateData.userName}_resume.pdf`,
        url: uploadedFileUrl || "",
      },
      coverLetter,
      status: "Applied",
      priority,
      hasImmediateCall,
      subscriptionPlan: subscription.planType || "silver",
      appliedAt: new Date(),
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

    // Get plan name for message
    const planName = plan?.name || subscription.planType || "Silver";

    const responseMessage = hasImmediateCall
      ? "Application submitted successfully! You'll get an immediate interview call."
      : isActive && plan?.features?.priorityToRecruiters && plan.features.priorityToRecruiters !== "none"
        ? `Application submitted successfully! You have ${plan.features.priorityToRecruiters} priority in the application pool.`
        : "Application submitted successfully!";

    res.status(201).json({
      success: true,
      message: responseMessage,
      data: updatedJob.applications.slice(-1)[0],
      subscriptionInfo: {
        planType: subscription.planType || "silver",
        hasImmediateCall,
        priority,
      },
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
    const { userEmail } = req.body;

    const existUser = await userModel.findOne({ userEmail: userEmail });

    if (!existUser) {
      return res.status(404).json({
        message: "User not found with the provided contact number",
      });
    }

    if (!userEmail) {
      return res.status(400).json({ message: "User email id is required" });
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

    const { userEmail, password, confirmPassword } = req.body;

    // Validate inputs
    if (!userEmail || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Find the user by contact number
    const user = await userModel.findOne({ userEmail: userEmail });

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

    return res.status(200).json({ jobAlerts, userJobPreference });
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
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }

    const userJobPreference = await JobFilter.findOne({ userId });
    if (!userJobPreference) {
      return res
        .status(404)
        .json({ success: false, message: "No job preference found" });
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
      return res
        .status(200)
        .json({ success: true, jobAlerts: [], userJobPreference });
    }

    const jobAlerts = await Job.find(query);

    return res
      .status(200)
      .json({ success: true, jobAlerts, userJobPreference });
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
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
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
      return res.status(400).json({ message: "Invalid employee ID" });
    }

    const employee = await Employee.findById(employeeId).select("isAvailable");

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({
      message: "Availability status fetched successfully",
      isAvailable: employee.isAvailable || false,
    });
  } catch (error) {
    console.error("Error fetching availability status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateAvailabilityStatus = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const { isAvailable } = req.body;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: "Invalid employee ID" });
    }

    if (typeof isAvailable !== "boolean") {
      return res
        .status(400)
        .json({ message: "isAvailable must be a boolean value" });
    }

    const employee = await Employee.findByIdAndUpdate(
      employeeId,
      {
        isAvailable,
        updatedAt: Date.now(),
      },
      { new: true, runValidators: true }
    ).select("isAvailable userName userEmail");

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({
      message: "Availability status updated successfully",
      employee: {
        id: employee._id,
        userName: employee.userName,
        userEmail: employee.userEmail,
        isAvailable: employee.isAvailable,
      },
    });
  } catch (error) {
    console.error("Error updating availability status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getMyName = async (req, res) => {
  try {
    const { userId } = req.params; // or from req.body / req.user depending on your setup

    // Fetch the user by ID, only return userName field
    const user =
      (await userModel.findOne({ _id: userId }, { userName: 1, _id: 0 })) ||
      (await Employer.findOne({ _id: userId }, { contactPerson: 1, _id: 0 }));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      userName: user?.userName || user?.contactPerson,
    });
  } catch (err) {
    console.error("Error fetching user name:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user name",
      error: err.message,
    });
  }
};

const bookDemoSchedule = async (req, res) => {
  try {
    const { formData } = req.body;

    // Validate that formData exists
    if (!formData) {
      return res.status(400).json({
        success: false,
        message: "Form data is required",
      });
    }

    // Create a new document
    const saveData = new demoModel({
      schoolName: formData.schoolName,
      location: formData.location,
      contactPerson: formData.contactPerson,
      contactNumber: formData.contactNumber,
      email: formData.email,
    });

    // Save to database
    await saveData.save();

    res.status(201).json({
      success: true,
      message: "Demo booked successfully",
      data: saveData,
    });
  } catch (err) {
    console.error("Error saving demo:", err);
    res.status(500).json({
      success: false,
      message: "Server error while saving demo",
      error: err.message,
    });
  }
};

const editUserData = async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(req.body);

    // Access text fields from FormData
    const body = req.body;

    console.log("Body", body);

    // Parse arrays sent as JSON strings
    const languages = body.languages ? JSON.parse(body.languages) : [];
    const gradeLevels = body.gradeLevels ? JSON.parse(body.gradeLevels) : [];
    const skills = body.skills ? JSON.parse(body.skills) : [];
    const education = body.education ? JSON.parse(body.education) : [];
    const workExperience = body.workExperience
      ? JSON.parse(body.workExperience)
      : [];

    // Build update object
    const updateData = {
      userName: body.userName,
      gender: body.gender,
      dob: body.dob,
      maritalStatus: body.maritalStatus,
      languages,
      userEmail: body.userEmail,
      userMobile: body.userMobile,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      state: body.state,
      pincode: body.pincode,
      currentCity: body.currentCity,
      preferredLocation: body.preferredLocation,
      currentrole: body.currentrole,
      specialization: body.specialization,
      totalExperience: body.totalExperience,
      expectedSalary: body.expectedSalary,
      isAvailable: body.isAvailable === "true" || body.isAvailable === true,
      gradeLevels,
      skills,
      education,
      workExperience,
      profilesummary: body.profilesummary,
      github: body.github,
      linkedin: body.linkedin,
      portfolio: body.portfolio,
    };

    // Handle uploaded files
    if (req.files.userProfilePic) {
      updateData.userProfilePic = {
        name: req.files.userProfilePic[0].originalname,
        url: `/uploads/${req.files.userProfilePic[0].filename}`,
      };
    }

    if (req.files.resume) {
      updateData.resume = {
        name: req.files.resume[0].originalname,
        url: `/uploads/${req.files.resume[0].filename}`,
      };
    }

    if (req.files.coverLetterFile) {
      updateData.coverLetterFile = {
        name: req.files.coverLetterFile[0].originalname,
        url: `/uploads/${req.files.coverLetterFile[0].filename}`,
      };
    }

    // Update employee document in MongoDB
    const updatedEmployee = await Employee.findByIdAndUpdate(
      userId,
      { $set: updateData, updatedAt: Date.now() },
      { new: true }
    );

    if (!updatedEmployee) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedEmployee,
    });
  } catch (err) {
    console.error("Error updating user:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

const getUserData = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Find employee by ID
    const employee = await Employee.findById(employeeId, { userPassword: 0 });

    if (!employee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    // Send employee data
    res.status(200).json({ success: true, data: employee });
  } catch (err) {
    console.error("Error fetching employee:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

const getAppliedJobs = async (req, res) => {
  try {
    const { candidateId } = req.params;

    const jobs = await Job.aggregate([
      // 1️⃣ Match jobs that have an application with this candidateId
      { $match: { "applications.applicantId": candidateId } },

      // 2️⃣ Filter applications to include only this candidate's record
      {
        $addFields: {
          applications: {
            $filter: {
              input: "$applications",
              as: "app",
              cond: { $eq: ["$$app.applicantId", candidateId] },
            },
          },
        },
      },

      // 3️⃣ Optionally, pick which job fields to return
      {
        $project: {
          jobTitle: 1,
          companyName: 1,
          location: 1,
          jobType: 1,
          salaryFrom: 1,
          salaryTo: 1,
          skills: 1,
          applications: 1,
          createdAt: 1,
          experienceLevel: 1,
        },
      },
    ]);

    if (!jobs || jobs.length === 0) {
      return res.status(404).json({
        message: "No applied jobs found for this candidate.",
      });
    }

    res.status(200).json({
      message: "Applied jobs fetched successfully",
      data: jobs,
    });
  } catch (err) {
    console.error("Error in getting applied jobs:", err);
    res.status(500).json({
      message: "Server error while fetching applied jobs",
    });
  }
};

const candidateSaveJob = async (req, res) => {
  try {
    const { candidateId, jobId } = req.params;
    console.log("Candidate:", candidateId, "Job:", jobId);

    // 1️⃣ Find candidate
    const candidate = await Employee.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    // 2️⃣ Check if job is already saved
    const isSaved = candidate.savedJobs.includes(jobId);

    if (isSaved) {
      // 3️⃣ Remove job from saved list
      candidate.savedJobs = candidate.savedJobs.filter((id) => id !== jobId);
      await candidate.save();
      return res.status(200).json({
        message: "Job removed from saved list",
        savedJobs: candidate.savedJobs,
      });
    } else {
      // 4️⃣ Add job to saved list
      candidate.savedJobs.push(jobId);
      await candidate.save();
      return res.status(200).json({
        message: "Job saved successfully",
        savedJobs: candidate.savedJobs,
      });
    }
  } catch (err) {
    console.error("Error in saving/removing job:", err);
    res.status(500).json({ message: "Server error while saving job" });
  }
};

const getSavedJobs = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // 1️⃣ Find employee and select only savedJobs
    const candidateData = await Employee.findById(employeeId, {
      savedJobs: 1,
    }).lean();

    if (!candidateData) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // 2️⃣ If no saved jobs
    if (!candidateData.savedJobs || candidateData.savedJobs.length === 0) {
      return res.status(200).json({
        message: "No saved jobs found",
        savedJobs: [],
      });
    }

    // 3️⃣ Return saved jobs
    res.status(200).json({
      message: "Saved jobs fetched successfully",
      savedJobs: candidateData.savedJobs,
    });
  } catch (err) {
    console.error("Error fetching saved jobs:", err);
    res.status(500).json({
      message: "Server error while fetching saved jobs",
      error: err.message,
    });
  }
};

const getSavedJobDetails = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // 1️⃣ Find employee with savedJobs
    const employeeData = await Employee.findById(employeeId, {
      savedJobs: 1,
    }).lean();

    if (!employeeData) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // 2️⃣ If no saved jobs
    if (!employeeData.savedJobs || employeeData.savedJobs.length === 0) {
      return res.status(200).json({
        message: "No saved jobs found",
        savedJobs: [],
      });
    }

    // 3️⃣ Fetch all job details for savedJobs
    const jobs = await Job.find({
      _id: { $in: employeeData.savedJobs },
    }).lean();

    // 4️⃣ Filter each job’s applications to only this employee’s
    const filteredJobs = jobs.map((job) => {
      const candidateApplication = job.applications?.filter(
        (app) => app.applicantId?.toString() === employeeId
      );

      return {
        ...job,
        applications: candidateApplication, // only this candidate’s app
      };
    });

    // 5️⃣ Send response
    res.status(200).json({
      message: "Saved jobs fetched successfully",
      savedJobs: filteredJobs,
    });
  } catch (err) {
    console.error("Error fetching saved jobs:", err);
    res.status(500).json({
      message: "Server error while fetching saved jobs",
      error: err.message,
    });
  }
};

const getCompanyNameOrJobName = async (req, res) => {
  try {
    const jobData = await Job.aggregate([
      {
        $addFields: {
          normalizedLocation: {
            $trim: { input: { $toLower: "$location" } } // convert to lowercase + trim
          }
        }
      },
      {
        $group: {
          _id: {
            jobTitle: "$jobTitle",
            category: "$category",
            companyName: "$companyName",
            location: "$normalizedLocation"
          }
        }
      },
      {
        $project: {
          _id: 0,
          jobTitle: "$_id.jobTitle",
          category: "$_id.category",
          companyName: "$_id.companyName",
          location: "$_id.location"
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      message: "Fetched unique job/company/location list successfully",
      data: jobData
    });
  } catch (err) {
    console.log("Error in fetching job/company names:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching job/company names",
      error: err.message
    });
  }
};


const getFeaturedJobs = async (req, res) => {
  try {
    const { jobType } = req.params;
    console.log("jobType:", jobType);

    let jobs;

    if (jobType === "recent") {
      // Latest 4 jobs
      jobs = await Job.find().sort({ createdAt: -1 }).limit(4);
    }
    else if (jobType === "featured") {
      // Random 4 jobs
      jobs = await Job.aggregate([{ $sample: { size: 4 } }]);
    }
    else if (["freelancer", "part-time", "full-time"].includes(jobType.toLowerCase())) {
      // Job type filter
      jobs = await Job.find({ jobType: { $regex: jobType, $options: "i" } });
    }
    else {
      return res.status(400).json({
        success: false,
        message: "Invalid jobType parameter"
      });
    }

    return res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs
    });

  } catch (error) {
    console.log("Error in fetching featured jobs:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching featured jobs",
      error: error.message
    });
  }
};

const getAllBlogs = async (req, res) => {
  try {
    const blogData = await blogSchema.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Blogs fetched successfully",
      blogs: blogData,
    });

  } catch (err) {
    console.error("❌ Error fetching blogs:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching blogs",
      error: err.message,
    });
  }
};


const getDistinctCategoryLocation = async (req, res) => {
  try {
    // Get distinct categories
    const categories = await Job.distinct("category");


    const regions = await Job.distinct("region");
    const experience = await Job.distinct("experienceLevel");

    // Combine locations + regions and get unique values
    const allLocations = Array.from(new Set([...regions]));

    return res.status(200).json({
      success: true,
      message: "Distinct categories and locations fetched successfully",
      categories: categories.sort((a, b) => a.localeCompare(b)), // sorted alphabetically
      locations: allLocations.sort((a, b) => a.localeCompare(b)), // sorted alphabetically
      experience: experience.sort((a, b) => a.localeCompare(b)), // sorted alphabetically
    });

  } catch (err) {
    console.error("❌ Error fetching distinct categories/locations:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching distinct categories/locations",
      error: err.message,
    });
  }
};

const getRandomBlogs = async (req, res) => {
  try {
    const randomBlogs = await blogSchema.aggregate([
      { $sample: { size: 3 } }, // Fetch 3 random blogs
    ]);


    return res.status(200).json({
      success: true,
      message: "Random blogs fetched successfully",
      blogs: randomBlogs, // Note: this is now an array of blogs
    });
  } catch (err) {
    console.error("❌ Error fetching random blogs:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching random blogs",
      error: err.message,
    });
  }
};


const getJobStormCardData = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const employee = await Employee.findById(employeeId, { subscriptionActive: 1, subscription: 1, userName: 1 });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "JobStorm card data fetched successfully",
      employee,
      isSubscribed: employee.subscriptionActive,
    });

  } catch (err) {
    console.error("❌ Error fetching jobstorm card data:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching jobstorm card data",
      error: err.message,
    });
  }
}

const isCandidateSubscribed = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const employee = await Employee.findById(employeeId, { subscriptionActive: 1 });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "JobStorm card data fetched successfully",

      isSubscribed: employee.subscriptionActive,
    });

  } catch (err) {
    console.error("❌ Error fetching jobstorm card data:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching jobstorm card data",
      error: err.message,
    });
  }
}


const geCandidateDashboardData = async (req, res) => {
  try {
    const { candidateId } = req.params;
    let profileViews = 0;

    // ✅ 1. SAVED JOB COUNT
    const employee = await Employee.findById(candidateId, { savedJobs: 1 }).lean();
    const savedJobCount = employee?.savedJobs?.length || 0;

    // ✅ 2. APPLIED JOB COUNT (STRING MATCH)
    const appliedJobCount = await Job.countDocuments({
      "applications.applicantId": candidateId   // ✅ STRING MATCH
    });

    // ✅ 3. INTERVIEW COUNT (ACCORDING TO YOUR DB)
    const interviewData = await Job.aggregate([
      { $match: { "applications.applicantId": candidateId } },

      {
        $project: {
          applications: {
            $filter: {
              input: "$applications",
              as: "app",
              cond: {
                $and: [
                  { $eq: ["$$app.applicantId", candidateId] },
                  { $eq: ["$$app.status", "Interview Scheduled"] } // ✅ FIXED CASE
                ]
              }
            }
          }
        }
      },

      { $unwind: "$applications" },
      { $count: "count" }
    ]);

    const interviewScheduledCount = interviewData[0]?.count || 0;

    // ✅ 4. RECENT APPLIED JOBS (LAST 3)
    const recentJobs = await Job.aggregate([
      { $match: { "applications.applicantId": candidateId } },

      {
        $project: {
          jobTitle: 1,
          companyName: 1,
          location: 1,
          jobType: 1,
          salaryFrom: 1,
          salaryTo: 1,
          applications: {
            $filter: {
              input: "$applications",
              as: "app",
              cond: { $eq: ["$$app.applicantId", candidateId] }
            }
          }
        }
      },

      { $unwind: "$applications" },

      // ✅ SORT BY appliedDate DESC
      { $sort: { "applications.appliedDate": -1 } },

      // ✅ RETURN ONLY 3
      { $limit: 3 },

      {
        $project: {
          jobTitle: 1,
          companyName: 1,
          location: 1,
          jobType: 1,


          appliedDate: "$applications.appliedDate",
          status: "$applications.status",
          employApplicantStatus: "$applications.employApplicantStatus"
        }
      }
    ]);

    console.log(
      "DASHBOARD =>",
      savedJobCount,
      appliedJobCount,
      interviewScheduledCount,
      recentJobs
    );

    return res.status(200).json({
      success: true,
      data: {
        savedJobCount,
        appliedJobCount,
        interviewScheduledCount,
        profileViews,
        recentAppliedJobs: recentJobs
      }
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    return res.status(500).json({
      success: false,
      message: "Dashboard data error"
    });
  }
};


//hbh
module.exports = {
  geCandidateDashboardData,
  isCandidateSubscribed,
  getJobStormCardData,
  getRandomBlogs,
  getDistinctCategoryLocation,
  getAllBlogs,
  getFeaturedJobs,
  getCompanyNameOrJobName,
  getSavedJobDetails,
  getSavedJobs,
  candidateSaveJob,
  getAppliedJobs,
  getUserData,
  editUserData,
  bookDemoSchedule,
  getMyName,
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
  fetchAvailabilityStatus, // <-- Add this
  updateAvailabilityStatus,
};
