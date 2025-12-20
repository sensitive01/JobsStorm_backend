const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const sendEmail = require("../../utils/sendEmail");
const bcrypt = require("bcrypt");
const generateOTP = require("../../utils/generateOTP");
const userModel = require("../../models/employeeschema");
const jwtDecode = require("jwt-decode");
const jwksClient = require("jwks-rsa");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");

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

module.exports = {
  sendOtpToEmail,
  verifyEmailOtp,
  sendVerificationEmail,
  verifyCompanySignupOtp,
};
