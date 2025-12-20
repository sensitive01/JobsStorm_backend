const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const sendEmail = require("../../utils/sendEmail");
const bcrypt = require("bcrypt");
const generateOTP = require("../../utils/generateOTP");
const userModel = require("../../models/employeeschema");
const Employer = require("../../models/employerSchema");
const Job = require("../../models/jobSchema");
const jwtDecode = require("jwt-decode");
const jwksClient = require("jwks-rsa");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const {
  cloudinary,
  profileImageStorage,
} = require("../../config/cloudinary");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const appleKeysClient = jwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
});

// Helper: Normalize email
const normalizeEmail = (email) => email?.trim().toLowerCase();

// Helper: Email template
const getOtpEmailTemplate = (otp) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f5f7fa;
        margin: 0;
        padding: 20px;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      }
      .content {
        padding: 40px 30px;
        text-align: center;
      }
      .content img {
        width: 100px;
        height: auto;
        margin-bottom: 20px;
      }
      .otp-box {
        background: #f8f9fa;
        border: 2px solid #0b132b;
        border-radius: 10px;
        padding: 20px;
        display: inline-block;
        margin-bottom: 15px;
      }
      .otp {
        font-size: 32px;
        font-weight: bold;
        color: #0b132b;
        letter-spacing: 5px;
      }
      .footer {
        background: #f8f9fa;
        padding: 20px;
        text-align: center;
        font-size: 14px;
        color: #666666;
        border-bottom-left-radius: 10px;
        border-bottom-right-radius: 10px;
      }
      .developer {
        font-size: 12px;
        color: #888888;
        margin-top: 10px;
      }
      .developer a {
        color: #ff6600;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <img src="cid:jobsstormlogo" alt="JobsStorm Logo" />
        <h2>Your OTP Code</h2>
        <p>Please use the following OTP to verify your email address:</p>
        <div class="otp-box">
          <div class="otp">${otp}</div>
        </div>
        <p>Valid for 10 minutes only. If you didn’t request this, please ignore this email.</p>
      </div>
      <div class="footer">
        <p>© JobsStorm – Global Career Partner</p>
        <p>Building your future, one opportunity at a time.</p>
        <div class="developer">
          Developed by <a href="https://sensitive.co.in" target="_blank">Sensitive Technologies</a>
        </div>
      </div>
    </div>
  </body>
</html>
`;

const getOtpVerificationEmailTemplate = (otp, companyName, contactPerson) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f5f7fa;
        margin: 0;
        padding: 20px;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      }
      .content {
        padding: 40px 30px;
        text-align: center;
      }
      .content img {
        width: 100px;
        height: auto;
        margin-bottom: 20px;
      }
      .otp-box {
        background: #f8f9fa;
        border: 2px solid #0b132b;
        border-radius: 10px;
        padding: 20px;
        display: inline-block;
        margin-bottom: 15px;
      }
      .otp {
        font-size: 32px;
        font-weight: bold;
        color: #0b132b;
        letter-spacing: 5px;
      }
      .footer {
        background: #f8f9fa;
        padding: 20px;
        text-align: center;
        font-size: 14px;
        color: #666666;
        border-bottom-left-radius: 10px;
        border-bottom-right-radius: 10px;
      }
      .developer {
        font-size: 12px;
        color: #888888;
        margin-top: 10px;
      }
      .developer a {
        color: #ff6600;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <img src="cid:jobsstormlogo" alt="JobsStorm Logo" />
        <h2>Welcome ${companyName||""}!</h2>
        <p>Hi ${contactPerson || "there"},</p>
        <p>Thank you for signing up with JobsStorm. Please use the OTP below to verify your email and complete your registration:</p>
        <div class="otp-box">
          <div class="otp">${otp}</div>
        </div>
        <p>This OTP is valid for 10 minutes. If you didn’t request this, please ignore this email.</p>
      </div>
      <div class="footer">
        <p>© JobsStorm – Global Career Partner</p>
        <p>Building your future, one opportunity at a time.</p>
        <div class="developer">
          Developed by <a href="https://sensitive.co.in" target="_blank">Sensitive Technologies</a>
        </div>
      </div>
    </div>
  </body>
</html>
`;

const sendOtpToEmail = async (req, res) => {
  try {
    let { userEmail } = req.body;
    userEmail = normalizeEmail(userEmail);

    if (!userEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Initialize storage if missing
    if (!req.app.locals.otps) req.app.locals.otps = {};

    // Simple cooldown: prevent multiple OTPs within 1 minute
    const existingOtp = req.app.locals.otps[userEmail];
    // if (existingOtp && Date.now() - existingOtp.createdAt < 60 * 1000) {
    //   return res.status(429).json({
    //     message:
    //       "OTP already sent recently. Please wait a minute before retrying.",
    //   });
    // }

    // Generate and hash OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 min

    // Store in memory
    req.app.locals.otps[userEmail] = {
      otp: hashedOtp,
      otpExpires,
      createdAt: Date.now(),
    };

    console.log(`OTP generated for ${userEmail}`);

    // Send Email
    const emailTemplate = getOtpEmailTemplate(otp);
    await sendEmail(userEmail, "Your OTP Code - JobsStorm", emailTemplate);

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error in sendOtpToEmail:", error);
    return res.status(500).json({ message: "Error sending OTP", error });
  }
};

const verifyEmailOtp = async (req, res) => {
  try {
    let { userEmail, otp } = req.body;
    userEmail = normalizeEmail(userEmail);

    if (!userEmail || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const storedOtpData = req.app.locals.otps
      ? req.app.locals.otps[userEmail]
      : null;

    if (!storedOtpData) {
      return res.status(404).json({ message: "No OTP found or expired" });
    }

    // Check expiry
    // if (Date.now() > storedOtpData.otpExpires) {
    //   delete req.app.locals.otps[userEmail];
    //   return res
    //     .status(400)
    //     .json({ message: "OTP expired, please request a new one" });
    // }

    // Compare OTP
    const isValid = await bcrypt.compare(otp, storedOtpData.otp);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Mark verified in DB
    // await userModel.updateOne(
    //   { userEmail },
    //   { $set: { emailverifedstatus: true } },
    //   { upsert: true }
    // );

    // Remove OTP from memory
    delete req.app.locals.otps[userEmail];

    return res.status(200).json({
      message: "Email verified successfully",
      emailverifedstatus: true,
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({ message: "OTP verification failed", error });
  }
};

const sendVerificationEmail = async (req, res) => {
  try {
    let { companyEmail, contactPerson, companyName } = req.body;
    console.log(companyEmail, contactPerson, companyName);

    if (!companyEmail) {
      return res.status(400).json({ message: "Company email is required" });
    }

    // Normalize the email
    const normalizedEmail = normalizeEmail(companyEmail);
    console.log(normalizedEmail);

    // Initialize storage if missing
    if (!req.app.locals.otps) req.app.locals.otps = {};

    // Simple cooldown: prevent multiple OTPs within 1 minute
    const existingOtp = req.app.locals.otps[normalizedEmail];
    // if (existingOtp && Date.now() - existingOtp.createdAt < 60 * 1000) {
    //   return res.status(429).json({
    //     message:
    //       "OTP already sent recently. Please wait a minute before retrying.",
    //   });
    // }

    // Generate and hash OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 min

    // Store OTP in memory with company signup flag
    req.app.locals.otps[normalizedEmail] = {
      otp: hashedOtp,
      otpExpires,
      createdAt: Date.now(),
      type: 'company_signup', // Flag to identify company signup OTP
      companyName: companyName,
      contactPerson: contactPerson,
    };

    console.log(`✅ [COMPANY SIGNUP] OTP generated for ${normalizedEmail}`);
    console.log(`📝 [COMPANY SIGNUP] OTP stored with key: "${normalizedEmail}"`);
    console.log(`🔑 [COMPANY SIGNUP] OTP (plain): ${otp}`);

    // Send Email
    const emailTemplate = getOtpVerificationEmailTemplate(
      otp,
      companyName,
      contactPerson
    );
    await sendEmail(
      normalizedEmail,
      "Your Signup OTP - JobsStorm",
      emailTemplate
    );

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error in sendVerificationEmail:", error);
    return res.status(500).json({ message: "Error sending OTP", error });
  }
};

const verifyCompanySignupOtp = async (req, res) => {
  try {
    let { userEmail, otp } = req.body;
    const originalEmail = userEmail;
    userEmail = normalizeEmail(userEmail);

    console.log(`🔐 [COMPANY SIGNUP VERIFY] Verification request received`);
    console.log(`📧 [COMPANY SIGNUP VERIFY] Original email: "${originalEmail}"`);
    console.log(`📧 [COMPANY SIGNUP VERIFY] Normalized email: "${userEmail}"`);
    console.log(`🔑 [COMPANY SIGNUP VERIFY] OTP received: "${otp}"`);

    if (!userEmail || !otp) {
      console.log(`❌ [COMPANY SIGNUP VERIFY] Missing email or OTP`);
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Initialize storage if missing
    if (!req.app.locals.otps) {
      console.log(`❌ [COMPANY SIGNUP VERIFY] req.app.locals.otps is not initialized`);
      return res.status(404).json({ message: "No OTP found or expired" });
    }

    console.log(`📊 [COMPANY SIGNUP VERIFY] Total OTPs stored: ${Object.keys(req.app.locals.otps).length}`);
    console.log(`📋 [COMPANY SIGNUP VERIFY] All stored email keys: ${JSON.stringify(Object.keys(req.app.locals.otps))}`);
    console.log(`🔍 [COMPANY SIGNUP VERIFY] Looking for key: "${userEmail}"`);

    const storedOtpData = req.app.locals.otps[userEmail];

    if (!storedOtpData) {
      console.log(`❌ [COMPANY SIGNUP VERIFY] No OTP found for key: "${userEmail}"`);
      console.log(`🔍 [COMPANY SIGNUP VERIFY] Available keys: ${JSON.stringify(Object.keys(req.app.locals.otps))}`);
      return res.status(404).json({ message: "No OTP found or expired" });
    }

    // Check if this is a company signup OTP
    if (storedOtpData.type !== 'company_signup') {
      console.log(`❌ [COMPANY SIGNUP VERIFY] OTP found but not for company signup. Type: ${storedOtpData.type || 'undefined'}`);
      return res.status(400).json({ message: "Invalid OTP type. Please request a new OTP for company signup." });
    }

    console.log(`✅ [COMPANY SIGNUP VERIFY] OTP data found for: "${userEmail}"`);
    console.log(`⏰ [COMPANY SIGNUP VERIFY] OTP created at: ${new Date(storedOtpData.createdAt).toISOString()}`);
    console.log(`⏰ [COMPANY SIGNUP VERIFY] OTP expires at: ${new Date(storedOtpData.otpExpires).toISOString()}`);
    console.log(`⏰ [COMPANY SIGNUP VERIFY] Current time: ${new Date().toISOString()}`);

    // Check expiry
    if (Date.now() > storedOtpData.otpExpires) {
      console.log(`❌ [COMPANY SIGNUP VERIFY] OTP expired`);
      delete req.app.locals.otps[userEmail];
      return res.status(400).json({ message: "OTP expired, please request a new one" });
    }

    // Compare OTP
    console.log(`🔐 [COMPANY SIGNUP VERIFY] Comparing OTP...`);
    const isValid = await bcrypt.compare(otp, storedOtpData.otp);
    console.log(`🔐 [COMPANY SIGNUP VERIFY] OTP comparison result: ${isValid}`);
    
    if (!isValid) {
      console.log(`❌ [COMPANY SIGNUP VERIFY] Invalid OTP provided`);
      return res.status(400).json({ message: "Invalid OTP" });
    }

    console.log(`✅ [COMPANY SIGNUP VERIFY] OTP is valid!`);

    // Remove OTP from memory
    delete req.app.locals.otps[userEmail];
    console.log(`🗑️ [COMPANY SIGNUP VERIFY] OTP removed from memory for: "${userEmail}"`);

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
      emailverifedstatus: true,
      data: {
        email: userEmail,
        companyName: storedOtpData.companyName,
        contactPerson: storedOtpData.contactPerson,
      }
    });
  } catch (error) {
    console.error("❌ [COMPANY SIGNUP VERIFY] OTP verification error:", error);
    return res.status(500).json({ 
      success: false,
      message: "OTP verification failed", 
      error: error.message 
    });
  }
};

// Get employer details by ID
const getEmployerDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Employer ID is required" });
    }

    const employer = await Employer.findById(id).select("-password");

    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    res.json(employer);
  } catch (err) {
    console.error("Error fetching employer details:", err);
    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid employer ID format" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// List all employers
const listAllEmployees = async (req, res) => {
  try {
    const employers = await Employer.find().select("-password");
    res.status(200).json(employers);
  } catch (error) {
    console.error("Error fetching employers:", error);
    res.status(500).json({ message: "Failed to fetch employers" });
  }
};

// Get referral link
const getReferralLink = async (req, res) => {
  try {
    const { userId } = req.params;
    const employer = await Employer.findById(userId);

    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    if (!employer.referralCode) {
      employer.referralCode = employer.generateReferralCode();
      await employer.save();
    }

    const referralLink = `${process.env.FRONTEND_URL || "https://jobsstorm.com"}/referral/${employer.referralCode}`;

    res.json({
      success: true,
      referralCode: employer.referralCode,
      referralLink,
    });
  } catch (error) {
    console.error("Error getting referral link:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get job and employer count
const getJobAndEmployerCount = async (req, res) => {
  try {
    const jobCount = await Job.countDocuments();
    const employerCount = await Employer.countDocuments();

    res.json({
      success: true,
      data: {
        jobCount,
        employerCount,
      },
    });
  } catch (error) {
    console.error("Error getting counts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Employer signup
const signUp = async (req, res) => {
  try {
    const {
      contactPerson,
      contactEmail,
      mobileNumber,
      password,
      companyName,
      website,
      address,
      city,
      state,
      pincode,
      referralCode,
    } = req.body;

    // Check if employer already exists
    const existEmployer = await Employer.findOne({
      $or: [{ contactEmail }, { mobileNumber }],
    });

    if (existEmployer) {
      return res.status(400).json({ message: "Employer already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newEmployer = new Employer({
      uuid: uuidv4(),
      contactPerson,
      contactEmail,
      mobileNumber,
      password: hashedPassword,
      companyName,
      website,
      address,
      city,
      state,
      pincode,
      verificationstatus: "pending",
      blockstatus: "unblock",
      emailverifedstatus: true,
    });

    // Generate referral code
    newEmployer.referralCode = newEmployer.generateReferralCode();

    // Handle referral
    if (referralCode && referralCode.trim() !== "") {
      const referrer = await Employer.findOne({
        referralCode: referralCode.trim(),
      });

      if (referrer) {
        newEmployer.referredBy = referrer._id;
        await Employer.findByIdAndUpdate(referrer._id, {
          $inc: { referralCount: 1, referralRewards: 100 },
        });
      }
    }

    await newEmployer.save();

    const token = jwt.sign({ id: newEmployer._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const { password: _, ...safeEmployer } = newEmployer._doc;

    res.status(201).json({
      message: "Employer registered successfully.",
      user: safeEmployer,
      token,
    });
  } catch (err) {
    console.error("Error in registration:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Employer login
const login = async (req, res) => {
  try {
    const { contactEmail, mobileNumber, password, fcmToken } = req.body;

    if (!contactEmail && !mobileNumber) {
      return res.status(400).json({ message: "Email or mobile is required." });
    }

    const employer = await Employer.findOne({
      $or: [
        ...(contactEmail ? [{ contactEmail }] : []),
        ...(mobileNumber ? [{ mobileNumber }] : []),
      ],
    });

    if (!employer) {
      return res
        .status(400)
        .json({ message: "Please check your email and password." });
    }

    const match = await bcrypt.compare(password, employer.password);
    if (!match) {
      return res
        .status(400)
        .json({ message: "Please check your email and password." });
    }

    // Optional FCM token saving
    if (
      fcmToken &&
      typeof fcmToken === "string" &&
      !employer.employerfcmtoken.includes(fcmToken)
    ) {
      employer.employerfcmtoken.push(fcmToken);
      await employer.save();
    }

    const token = jwt.sign({ id: employer._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const { password: _, ...safeEmployer } = employer._doc;

    res.json({
      message: "Login successful",
      user: safeEmployer,
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Google authentication
const googleAuth = async (req, res) => {
  const { idToken } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    let employer = await Employer.findOne({ googleId: payload.sub });
    if (!employer) {
      employer = new Employer({
        uuid: uuidv4(),
        googleId: payload.sub,
        contactEmail: payload.email,
        contactPerson: payload.name,
        userProfilePic: payload.picture,
        isVerified: true,
        emailverifedstatus: true,
      });
      employer.referralCode = employer.generateReferralCode();
      await employer.save();
    }

    const token = jwt.sign({ id: employer._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const { password: _, ...safeEmployer } = employer._doc;

    res.json({
      message: "Google login successful",
      user: safeEmployer,
      token,
    });
  } catch (err) {
    console.error("Google auth error:", err);
    res
      .status(401)
      .json({ message: "Invalid Google token", error: err.message });
  }
};

// Apple authentication
const appleAuth = async (req, res) => {
  const { idToken } = req.body;
  try {
    const decoded = jwtDecode(idToken);
    let employer = await Employer.findOne({ appleId: decoded.sub });

    if (!employer) {
      employer = new Employer({
        uuid: uuidv4(),
        appleId: decoded.sub,
        contactEmail: decoded.email,
        contactPerson: "Apple User",
        isVerified: true,
        emailverifedstatus: true,
      });
      employer.referralCode = employer.generateReferralCode();
      await employer.save();
    }

    const token = jwt.sign({ id: employer._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const { password: _, ...safeEmployer } = employer._doc;

    res.json({
      message: "Apple login successful",
      user: safeEmployer,
      token,
    });
  } catch (err) {
    console.error("Apple auth error:", err);
    res.status(401).json({ message: "Invalid Apple token" });
  }
};

// Employer forgot password
const employerForgotPassword = async (req, res) => {
  try {
    const { contactEmail, mobileNumber } = req.body;

    if (!contactEmail && !mobileNumber) {
      return res.status(400).json({ message: "Email or mobile is required" });
    }

    const employer = await Employer.findOne({
      $or: [
        ...(contactEmail ? [{ contactEmail }] : []),
        ...(mobileNumber ? [{ mobileNumber }] : []),
      ],
    });

    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP in memory
    if (!req.app.locals.otps) req.app.locals.otps = {};
    req.app.locals.otps[contactEmail || mobileNumber] = {
      otp: hashedOtp,
      otpExpires,
      createdAt: Date.now(),
      type: "forgot_password",
    };

    // Send OTP via email if email exists
    if (contactEmail) {
      const emailTemplate = getOtpEmailTemplate(otp);
      await sendEmail(contactEmail, "Password Reset OTP - JobsStorm", emailTemplate);
    }

    res.json({
      message: "OTP sent successfully",
      contactEmail: contactEmail || undefined,
      mobileNumber: mobileNumber || undefined,
    });
  } catch (error) {
    console.error("Error in forgot password:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Verify OTP for forgot password
const employerverifyOTP = async (req, res) => {
  try {
    const { contactEmail, mobileNumber, otp } = req.body;

    if ((!contactEmail && !mobileNumber) || !otp) {
      return res.status(400).json({ message: "Email/mobile and OTP are required" });
    }

    const key = contactEmail || mobileNumber;
    const storedOtpData = req.app.locals.otps?.[key];

    if (!storedOtpData || storedOtpData.type !== "forgot_password") {
      return res.status(404).json({ message: "No OTP found or expired" });
    }

    if (Date.now() > storedOtpData.otpExpires) {
      delete req.app.locals.otps[key];
      return res.status(400).json({ message: "OTP expired, please request a new one" });
    }

    const isValid = await bcrypt.compare(otp, storedOtpData.otp);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Mark OTP as verified
    req.app.locals.otps[key].verified = true;

    res.json({
      message: "OTP verified successfully",
      verified: true,
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Change password after OTP verification
const employerChangePassword = async (req, res) => {
  try {
    const { contactEmail, mobileNumber, newPassword } = req.body;

    if ((!contactEmail && !mobileNumber) || !newPassword) {
      return res.status(400).json({ message: "Email/mobile and new password are required" });
    }

    const key = contactEmail || mobileNumber;
    const storedOtpData = req.app.locals.otps?.[key];

    if (!storedOtpData || !storedOtpData.verified) {
      return res.status(400).json({ message: "Please verify OTP first" });
    }

    const employer = await Employer.findOne({
      $or: [
        ...(contactEmail ? [{ contactEmail }] : []),
        ...(mobileNumber ? [{ mobileNumber }] : []),
      ],
    });

    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    employer.password = hashedPassword;
    await employer.save();

    // Remove OTP from memory
    delete req.app.locals.otps[key];

    res.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update employer details
const updateEmployerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove password from update data if present
    delete updateData.password;

    const employer = await Employer.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    res.json({
      message: "Employer details updated successfully",
      user: employer,
    });
  } catch (error) {
    console.error("Error updating employer details:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update profile picture
const updateProfilePicture = async (req, res) => {
  try {
    const { employid } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const employer = await Employer.findById(employid);

    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    // Delete old profile picture from cloudinary if exists
    if (employer.userProfilePic) {
      const publicId = employer.userProfilePic.split("/").pop().split(".")[0];
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error("Error deleting old profile picture:", err);
      }
    }

    employer.userProfilePic = req.file.path;
    await employer.save();

    const { password: _, ...safeEmployer } = employer._doc;

    res.json({
      message: "Profile picture updated successfully",
      user: safeEmployer,
    });
  } catch (error) {
    console.error("Error updating profile picture:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Decrease profile view
const decreaseProfileView = async (req, res) => {
  try {
    const { employerId, employeeId } = req.params;

    const employer = await Employer.findById(employerId);

    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    // Remove from viewedEmployees if exists
    employer.viewedEmployees = employer.viewedEmployees.filter(
      (view) => view.employeeId.toString() !== employeeId
    );

    // Decrease total count
    if (employer.totalprofileviews > 0) {
      employer.totalprofileviews -= 1;
    }

    await employer.save();

    res.json({
      message: "Profile view decreased successfully",
      totalprofileviews: employer.totalprofileviews,
    });
  } catch (error) {
    console.error("Error decreasing profile view:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Decrease resume download
const decreaseResumeDownload = async (req, res) => {
  try {
    const { employerId, employeeId } = req.params;

    const employer = await Employer.findById(employerId);

    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    // Remove from resumedownload if exists
    employer.resumedownload = employer.resumedownload.filter(
      (download) => download.employeeId.toString() !== employeeId
    );

    // Decrease total count
    if (employer.totaldownloadresume > 0) {
      employer.totaldownloadresume -= 1;
    }

    await employer.save();

    res.json({
      message: "Resume download decreased successfully",
      totaldownloadresume: employer.totaldownloadresume,
    });
  } catch (error) {
    console.error("Error decreasing resume download:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Change my password (authenticated user)
const employerChangeMyPassword = async (req, res) => {
  try {
    const { employerId } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    const employer = await Employer.findById(employerId);

    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    // Verify current password
    const match = await bcrypt.compare(currentPassword, employer.password);
    if (!match) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    employer.password = hashedPassword;
    await employer.save();

    res.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  sendOtpToEmail,
  verifyEmailOtp,
  sendVerificationEmail,
  verifyCompanySignupOtp,
  getEmployerDetails,
  listAllEmployees,
  getReferralLink,
  getJobAndEmployerCount,
  signUp,
  login,
  googleAuth,
  appleAuth,
  employerForgotPassword,
  employerverifyOTP,
  employerChangePassword,
  updateEmployerDetails,
  updateProfilePicture,
  decreaseProfileView,
  decreaseResumeDownload,
  employerChangeMyPassword,
};
