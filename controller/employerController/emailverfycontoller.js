 
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const sendEmail = require('../../utils/sendEmail');
const bcrypt = require('bcrypt');
const generateOTP = require("../../utils/generateOTP")

const otpmodel = require('../../models/optschema');
const jwtDecode = require('jwt-decode');
const jwksClient = require('jwks-rsa');
const { v4: uuidv4 } = require('uuid'); // Import uuid
const mongoose = require('mongoose'); // <-- Add this line






// const sendOtpToEmail = async (req, res) => {
//   const { userEmail } = req.body;

//   try {
//     // Find existing user or create new
//     let employer = await otpmodel.findOne({ userEmail });

//     if (!employer) {
//       // If not found, create a new user with just the email
//       employer = new otpmodel({ userEmail });
//     }

//     // Generate 6-digit OTP
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

//     // Update OTP fields
//     employer.otp = otp;
//     employer.otpExpires = otpExpires;

//     await employer.save();
//     console.log(`OTP generated: ${otp} for email: ${userEmail}`);

//     // Send email
//     try {
//       await sendEmail(userEmail, 'Your OTP Code', `Your OTP is: ${otp}`);
//       console.log('OTP email sent successfully');
//     } catch (emailErr) {
//       console.error('Failed to send OTP email:', emailErr);
//       return res.status(500).json({ message: 'Failed to send OTP email', error: emailErr });
//     }

//     return res.status(200).json({ message: 'OTP sent successfully' });
//   } catch (error) {
//     console.error('Error in sendOtpToEmail:', error);
//     return res.status(500).json({ message: 'Error sending OTP', error });
//   }
// };

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

    // Email template
    const emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
            .header { background: #4A90E2; color: white; text-align: center; padding: 20px; }
            .content { padding: 30px; text-align: center; }
            .otp-box { background: #f8f9fa; border: 2px solid #4A90E2; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .otp { font-size: 28px; font-weight: bold; color: #4A90E2; letter-spacing: 4px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>EdProfio</h1>
            </div>
            <div class="content">
                <h2>Your OTP Code</h2>
                <p>Please use the following OTP to verify your email address:</p>
                <div class="otp-box">
                    <div class="otp">${otp}</div>
                </div>
                <p><strong>Valid for 10 minutes only</strong></p>
                <p>If you didn't request this, please ignore this email.</p>
            </div>
            <div class="footer">
                <p>© EdProfio - Your Education Platform</p>
            </div>
        </div>
    </body>
    </html>`;

    // Send email
    try {
      await sendEmail(userEmail, "Your OTP Code - EdProfio", emailTemplate);
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
    const employer = await otpmodel.findOne({ userEmail });

    if (!employer) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check OTP and expiry
    const isOtpValid = employer.otp === otp;
    const isOtpExpired = new Date() > new Date(employer.otpExpires);

    if (!isOtpValid || isOtpExpired) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Mark email as verified
    employer.emailverifedstatus = true;
    employer.otp = undefined;
    employer.otpExpires = undefined;

    await employer.save();

    return res.status(200).json({ 
      message: 'Email verified successfully',
      emailverifedstatus: employer.emailverifedstatus
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    return res.status(500).json({ message: 'OTP verification failed', error });
  }
};

module.exports = {
 
  sendOtpToEmail,
  verifyEmailOtp,
 
};