const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const sendEmail = require("../../utils/sendEmail");
const bcrypt = require("bcrypt");
const generateOTP = require("../../utils/generateOTP");
const Job = require("../../models/jobSchema");
const userModel = require("../../models/employerSchema");
const jwtDecode = require("jwt-decode");
const jwksClient = require("jwks-rsa");
const { v4: uuidv4 } = require("uuid"); // Import uuid
const mongoose = require("mongoose"); // <-- Add this line
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const appleKeysClient = jwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
});
const jobModel = require("../../models/jobSchema");
const employeeModel = require("../../models/employeeschema")
const { GoogleGenerativeAI } = require("@google/generative-ai");

const generateUserUUID = () => uuidv4(); // Define the function

// const signUp = async (req, res) => {
//   try {
//     let {
//       employerType,
//       schoolName,
//       userMobile,
//       lastName,
//       firstName,
//       userEmail,
//       userPassword,
//       referralCode = ""
//     } = req.body;

//     // Trim all inputs
//     employerType = employerType?.trim();
//     schoolName = schoolName?.trim();
//     userMobile = userMobile?.trim();
//     lastName = lastName?.trim();
//     firstName = firstName?.trim();
//     userEmail = userEmail?.trim();
//     userPassword = userPassword?.trim();
//     referralCode = referralCode.trim();

//     // Validation
//     if (!userEmail && !userMobile) {
//       return res.status(400).json({ message: "Email or mobile is required." });
//     }

//     // Check if user already exists
//     const existUser = await userModel.findOne({
//       $or: [{ userMobile }, { userEmail }]
//     });

//     if (existUser) {
//       return res.status(400).json({ message: "Employer already registered." });
//     }

//     // Hash password
//     const hashedPassword = await bcrypt.hash(userPassword, 10);

//     // Handle referral code if provided
//     let referredBy = null;
//     if (referralCode) {
//       const referringEmployer = await userModel.findOne({ referralCode });
//       if (!referringEmployer) {
//         return res.status(400).json({ message: "Invalid referral code." });
//       }
//       referredBy = referringEmployer._id;
//     }

//     // Create new employer
//     const newEmployer = new userModel({
//       uuid: uuidv4(),
//       employerType,
//       schoolName,
//       userMobile,
//       lastName,
//       firstName,
//       userEmail,
//         verificationstatus: 'pending',
//             blockstatus: 'unblock',
//       userPassword: hashedPassword,
//       emailverifedstatus: true ,
//       referredBy
//     });

//     // Generate unique referral code
//     newEmployer.referralCode = newEmployer.generateReferralCode();

//     // Save the new employer
//     await newEmployer.save();

//     // Update referrer's counts if applicable
//     if (referredBy) {
//       await userModel.findByIdAndUpdate(referredBy, {
//         $inc: {
//           referralCount: 1,
//           referralRewards: 100 // You can adjust this value
//         }
//       });
//     }

//     // Create JWT token
//     const token = jwt.sign(
//       { id: newEmployer._id },
//       process.env.JWT_SECRET,
//       { expiresIn: '7d' }
//     );

//     // Return success response
//     res.status(201).json({
//       success: true,
//       message: "Employer registered successfully",
//       data: {
//         id: newEmployer._id,
//         uuid: newEmployer.uuid,
//         firstName: newEmployer.firstName,
//         lastName: newEmployer.lastName,
//         userEmail: newEmployer.userEmail,
//         userMobile: newEmployer.userMobile,
//         referralCode: newEmployer.referralCode,
//            verificationstatus: newEmployer.verificationstatus,
//            blockstatus: newEmployer.blockstatus,
//            emailverifedstatus: newEmployer.emailverifedstatus,

//         referredBy: referredBy
//       },
//       token
//     });

//   } catch (err) {
//     console.error("Error in employer registration:", err.message);
//     console.error(err.stack);

//     // Handle duplicate key errors (like duplicate referral code)
//     if (err.code === 11000) {
//       return res.status(400).json({
//         success: false,
//         message: "Registration failed due to duplicate data",
//         error: err.message
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Server error during registration",
//       error: err.message
//     });
//   }
// };
// Email/Mobile Login

const signUp = async (req, res) => {
  try {
    let {
      companyName,
      contactPerson,
      contactEmail,
      mobileNumber,
      password,
      referralCode, // optional
    } = req.body;

    // Validation
    if (!contactEmail) {
      return res.status(400).json({ message: "Email or mobile is required." });
    }

    // Check if user already exists
    const existUser = await userModel.findOne({ userEmail: contactEmail });

    if (existUser) {
      return res.status(400).json({ message: "Employer already registered." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Handle referral code if provided
    let referredBy = null;
    if (referralCode) {
      const referringEmployer = await userModel.findOne({ referralCode });
      if (!referringEmployer) {
        return res.status(400).json({ message: "Invalid referral code." });
      }
      referredBy = referringEmployer._id;
    }

    // Create new employer
    const newEmployer = new userModel({
      uuid: uuidv4(),
      companyName,
      contactPerson,
      contactEmail: contactEmail,
      password: hashedPassword,
    });

    // Generate unique referral code
    newEmployer.referralCode = newEmployer.generateReferralCode();

    // Save employer
    await newEmployer.save();

    // Update referrer's counts if applicable
    if (referredBy) {
      await userModel.findByIdAndUpdate(referredBy, {
        $inc: { referralCount: 1, referralRewards: 100 },
      });
    }

    // ✅ Email template
    const loginLink = "https:jobsstorm.com/employer-login"; // replace with actual
    const emailHtml = `
<div style="font-family: Arial, sans-serif; padding:30px; max-width:600px; margin:auto; border-radius:10px; background-color:#1a1a1a; color:#f0f0f0;">
  <div style="text-align:center; padding-bottom:20px; border-bottom:1px solid #333;">
    <img src="cid:jobsstormlogo" alt="JobsStorm Logo" style="max-height:80px; margin-bottom:15px;" />
    <h2 style="color:#ffffff; font-weight:bold;">Welcome to JobsStorm - Global Career Partner!</h2>
  </div>

  <p style="font-size:16px;">Hi <b>${contactPerson}</b>,</p>
  <p style="font-size:16px;">We are thrilled to have you on board. Your employer account has been successfully created. 🎉</p>
  <p style="font-size:16px;">You can now start posting jobs and managing your company profile.</p>

  <p style="font-size:14px; color:#cccccc;">If you have any questions, feel free to reach out to our support team.</p>

  <p style="font-size:14px; margin-top:30px; color:#cccccc;">
    Best regards,<br/>
    The <b>JobsStorm - Global Career Partner</b> Team
  </p>

  <div style="text-align:center; margin-top:20px; font-size:12px; color:#888888;">
    Developed by <a href="https://sensitive.co.in" style="color:#ff6600; text-decoration:none;">Sensitive Technologies</a>
  </div>
</div>
`;

    // Send email
    await sendEmail(
      contactEmail,
      "Welcome to JobsStorm - Your Employer Account Details",
      emailHtml
    );

    // JWT token
    const token = jwt.sign({ id: newEmployer._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Response
    res.status(201).json({
      success: true,
      message: "Employer registered successfully",
      data: {
        id: newEmployer._id,
        uuid: newEmployer.uuid,
        companyName: newEmployer.companyName,
        contactPerson: newEmployer.contactPerson,
        userEmail: newEmployer.userEmail,
        userMobile: newEmployer.userMobile,
        referralCode: newEmployer.referralCode,
        referredBy,
      },
      token,
    });
  } catch (err) {
    console.error("Error in employer registration:", err);
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate data found",
        error: err.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error during registration",
      error: err.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { userEmail, password } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await userModel.findOne({
      contactEmail: userEmail,
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Please check your email and password." });
    }

    const match = await bcrypt.compare(password, user?.password);
    if (!match) {
      return res
        .status(400)
        .json({ message: "Please check your email and password" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    const role = user?.role || "employer"
    res.json({
      message: "Login successful",
      user,
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
    res.status(401).json({ message: "Invalid Google token" });
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
        uuid: generateUserUUID(),
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
const getEmployerDetails = async (req, res) => {
  try {

    const employeeId = req.userId || req.params.id;

    if (!employeeId) {
      return res.status(400).json({ message: "Employer ID is required" });
    }

    const employee = await userModel
      .findById(employeeId)
      .select("-userPassword");

    if (!employee) {
      return res.status(404).json({ message: "Employer not found" });
    }

    res.json(employee);
  } catch (err) {
    console.error("Error fetching employer details:", err);

    if (err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid employer ID format" });
    }

    res.status(500).json({ message: "Server error" });
  }
};


const getEmployerDetailsTopBar = async (req, res) => {
  try {

    const { employerId } = req.params;

    if (!employerId) {
      return res.status(400).json({ message: "Employer ID is required" });
    }

    const employer = await userModel
      .findById(employerId, { contactPerson: 1, companyName: 1, userProfilePic: 1 })

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

const listAllEmployees = async (req, res) => {
  try {
    // Fetch all employees, excluding the password field
    const employees = await userModel.find().select("-userPassword");

    // Check if any employees exist
    if (!employees || employees.length === 0) {
      return res.status(404).json({ message: "No employees found" });
    }

    // Return the list of employees
    res.json(employees);
  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).json({ message: "Server error" });
  }
};
const updateEmployerDetails = async (req, res) => {
  try {
    console.log("Update request body:", req.body); // ✅ Log incoming data
    const updatedEmployer = await userModel.findByIdAndUpdate(
      req.params.id,
      {
        companyName: req.body.companyName,
        contactPerson: req.body.contactPerson,
        contactEmail: req.body.contactEmail,
        mobileNumber: req.body.mobileNumber,
        address: req.body.address,
        state: req.body.state,
        pincode: req.body.pincode,
        city: req.body.city,
        schoolName: req.body.schoolName,
        website: req.body.website,
        board: req.body.board,
        institutionType: req.body.institutionType,
        linkedin: req.body.linkedin,
        twitter: req.body.twitter,
        facebook: req.body.facebook,
      },
      { new: true }
    );

    if (!updatedEmployer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    res.json(updatedEmployer);
  } catch (err) {
    console.error("Error updating employer details:", err); // 👈 this error should reveal the issue
    res.status(500).json({ message: "Server error" });
  }
};
const updateProfilePicture = async (req, res) => {
  try {
    const { employid } = req.params;

    // Validate employee ID
    if (!employid || !mongoose.isValidObjectId(employid)) {
      return res.status(400).json({ message: "Valid employee ID is required" });
    }

    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = req.file;

    // Get file URL
    const fileUrl = result.secure_url || result.url || result.path;
    if (!fileUrl) {
      return res.status(500).json({
        message: "Cloudinary upload failed: No URL returned",
        details: result,
      });
    }

    // Find current employee
    const currentEmployee = await userModel.findById(employid);
    if (!currentEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Delete old profile picture if exists
    if (currentEmployee.userProfilePic) {
      try {
        const publicId = currentEmployee.userProfilePic
          .split("/")
          .slice(-2)
          .join("/")
          .split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error("Failed to delete old profile picture:", err);
      }
    }

    // Update with new profile picture
    currentEmployee.userProfilePic = fileUrl;
    await currentEmployee.save();

    res.status(200).json({
      success: true,
      message: "Profile picture updated successfully",
      file: {
        name: result.originalname || result.filename || "Unnamed",
        url: fileUrl,
      },
    });
  } catch (error) {
    console.error("Error updating profile picture:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating profile picture",
      error: error.message,
    });
  }
};

const employerForgotPassword = async (req, res) => {
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

const employerverifyOTP = async (req, res) => {
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
const employerChangePassword = async (req, res) => {
  try {
    console.log("Welcome to user change password");

    const { companyEmail, password, confirmPassword } = req.body;

    // Validate inputs
    if (!companyEmail || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Find the user by contact number
    const user = await userModel.findOne({ contactEmail: companyEmail });

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

const employerChangeMyPassword = async (req, res) => {
  try {
    const { employerId } = req.params;
    const { currentPassword, newPassword } = req.body;
    console.log("req.body", req.body);

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new password are required" });
    }

    // Find employer
    const employer = await userModel.findById(employerId);
    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(
      currentPassword,
      employer.userPassword
    );
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Prevent reusing same password
    const isSamePassword = await bcrypt.compare(
      newPassword,
      employer.userPassword
    );
    if (isSamePassword) {
      return res
        .status(400)
        .json({ message: "New password cannot be same as old password" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    employer.userPassword = hashedPassword;
    await employer.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Error in employerChangeMyPassword:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/referral-link/:userId
const getReferralLink = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await userModel.findById(userId);
    if (!user || !user.referralCode) {
      return res.status(404).json({ message: "Referral code not found." });
    }

    // This can be dynamic based on your frontend deployment
    const referralUrl = `https://yourapp.com/signup?ref=${user.referralCode}`;

    res.json({ referralUrl });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// const sendOtpToEmail = async (req, res) => {
//   const { userEmail } = req.body;

//   try {
//     // Find existing user or create new
//     let employer = await userModel.findOne({ userEmail });

//     if (!employer) {
//       // If not found, create a new user with just the email
//       employer = new userModel({ userEmail });
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
//       await sendEmail(userEmail, "Your OTP Code", `Your OTP is: ${otp}`);
//       console.log("OTP email sent successfully");
//     } catch (emailErr) {
//       console.error("Failed to send OTP email:", emailErr);
//       return res
//         .status(500)
//         .json({ message: "Failed to send OTP email", error: emailErr });
//     }

//     return res.status(200).json({ message: "OTP sent successfully" });
//   } catch (error) {
//     console.error("Error in sendOtpToEmail:", error);
//     return res.status(500).json({ message: "Error sending OTP", error });
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

const decreaseResumeDownload = async (req, res) => {
  try {
    const { employerId, employeeId } = req.params;

    // Find employer by ID
    const employer = await userModel.findById(employerId);
    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    // Check if this employee's resume has already been downloaded
    const alreadyDownloaded = employer.resumedownload.some(
      (item) => item.employeeId.toString() === employeeId
    );

    if (alreadyDownloaded) {
      return res.status(200).json({
        message: "Resume already downloaded, count not decreased",
        totalRemaining: employer.totaldownloadresume,
      });
    }

    // If first time downloading, check if downloads are available
    if (employer.totaldownloadresume <= 0) {
      return res.status(400).json({ message: "No resume downloads remaining" });
    }

    // Decrease totaldownloadresume
    employer.totaldownloadresume -= 1;

    // Add the new resume download record
    employer.resumedownload.push({
      employeeId,
      viewedAt: new Date(),
    });

    // Mark modified paths for Mongoose
    employer.markModified("totaldownloadresume");
    employer.markModified("resumedownload");

    // Save the updated employer document
    await employer.save();

    return res.status(200).json({
      message: "Resume download count decreased successfully",
      totalRemaining: employer.totaldownloadresume,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const decreaseProfileView = async (req, res) => {
  try {
    const { employerId, employeeId } = req.params;

    // Find employer
    const employer = await userModel.findById(employerId);
    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    // Check if already viewed (no decrement if already viewed)
    const alreadyViewed = employer.viewedEmployees.some(
      (view) => view.employeeId.toString() === employeeId
    );

    if (alreadyViewed) {
      return res.status(200).json({
        message: "Employee already viewed",
        totalRemaining: employer.totalprofileviews,
        firstView: false,
      });
    }

    // Check global total profile views
    if (employer.totalprofileviews <= 0) {
      return res.status(400).json({ message: "No profile views remaining" });
    }

    // ---- Check daily limit ----
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Midnight today

    // Count how many profiles have been viewed today
    const todayViews = employer.viewedEmployees.filter((view) => {
      const viewedDate = new Date(view.viewedAt);
      viewedDate.setHours(0, 0, 0, 0);
      return viewedDate.getTime() === today.getTime();
    }).length;

    if (todayViews >= employer.totalperdaylimit) {
      return res
        .status(400)
        .json({ message: "Daily profile view limit reached" });
    }

    // ---- Decrease global count and record today's view ----
    employer.totalprofileviews -= 1;
    employer.viewedEmployees.push({
      employeeId,
      viewedAt: new Date(),
    });

    await employer.save();

    return res.status(200).json({
      message: "Profile view count decreased successfully",
      totalRemaining: employer.totalprofileviews,
      firstView: true,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const getJobAndEmployerCount = async (req, res) => {
  try {
    const employerCount = await userModel.countDocuments();
    const jobCount = await jobModel.countDocuments();

    return res.status(200).json({
      success: true,
      employerCount,
      jobCount,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: err.message,
    });
  }
};


const getDashboardData = async (req, res) => {
  try {
    const { employerId } = req.params;

    if (!employerId) {
      return res.status(400).json({ message: "Employer ID is required" });
    }

    // Active Jobs Count
    const activeJobCount = await jobModel.countDocuments({
      employId: employerId,
      isActive: true,
    });

    // Applications + Hired Count
    const applicationStats = await jobModel.aggregate([
      { $match: { employId: employerId } },
      { $unwind: "$applications" },
      {
        $group: {
          _id: null,
          totalApplications: { $sum: 1 },
          hiredCount: {
            $sum: {
              $cond: [
                { $eq: ["$applications.employApplicantStatus", "Selected"] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const totalApplicationCount =
      applicationStats.length > 0 ? applicationStats[0].totalApplications : 0;

    const hiredCount =
      applicationStats.length > 0 ? applicationStats[0].hiredCount : 0;

    // Most Recent Application
    const recentApplication = await jobModel.aggregate([
      { $match: { employId: employerId } },
      { $unwind: "$applications" },
      { $sort: { "applications.appliedDate": -1 } },
      { $limit: 1 },
      {
        $project: {
          _id: 1,
          jobId: 1,
          jobTitle: 1,
          appliedDate: "$applications.appliedDate",
          candidate: {
            applicantId: "$applications.applicantId",
            firstName: "$applications.firstName",
            email: "$applications.email",
            phone: "$applications.phone",
            status: "$applications.status",
            employApplicantStatus:
              "$applications.employApplicantStatus",
            resume: "$applications.resume",
            coverLetter: "$applications.coverLetter",
          },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        activeJobCount,
        totalApplicationCount,
        hiredCount,
        recentApplication: recentApplication[0] || null,
      },
    });
  } catch (err) {
    console.error("Error fetching dashboard data:", err);

    return res.status(500).json({
      message: "Error fetching dashboard data",
      error: err.message,
    });
  }
};


const getInterviewDetails = async (req, res) => {
  try {
    const { employerId } = req.params;

    if (!employerId) {
      return res.status(400).json({
        success: false,
        message: "Employer ID is required",
      });
    }

    const interviews = await jobModel.aggregate([
      // 1️⃣ Match employer jobs
      {
        $match: {
          employId: employerId,
        },
      },

      // 2️⃣ Break applications array
      {
        $unwind: "$applications",
      },

      // 3️⃣ Filter only scheduled interviews
      {
        $match: {
          "applications.interviewDate": { $ne: null },
        },
      },

      // 4️⃣ Convert applicantId string → ObjectId
      {
        $addFields: {
          applicantObjectId: {
            $toObjectId: "$applications.applicantId",
          },
        },
      },

      // 5️⃣ Lookup employee details
      {
        $lookup: {
          from: "employees", // collection name
          localField: "applicantObjectId",
          foreignField: "_id",
          as: "employeeDetails",
        },
      },

      // 6️⃣ Flatten employee array
      {
        $unwind: {
          path: "$employeeDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

      // 7️⃣ Shape final output
      {
        $project: {
          _id: 0,

          // Job Details
          jobId: "$_id",
          jobTitle: 1,
          companyName: 1,
          location: 1,

          // Interview Details
          interviewType: "$applications.interviewType",
          interviewDate: "$applications.interviewDate",
          interviewTime: "$applications.interviewTime",
          interviewLink: "$applications.interviewLink",
          interviewVenue: "$applications.interviewVenue",
          applicationStatus: "$applications.status",
          employApplicantStatus:
            "$applications.employApplicantStatus",

          // Employee Details
          employee: {
            id: "$employeeDetails._id",
            userName: "$employeeDetails.userName",
            userEmail: "$employeeDetails.userEmail",
            userMobile: "$employeeDetails.userMobile",
            currentrole: "$employeeDetails.currentrole",
            totalExperience: "$employeeDetails.totalExperience",
            skills: "$employeeDetails.skills",
            city: "$employeeDetails.city",
            resume: "$employeeDetails.resume",
            profileImage: "$employeeDetails.profileImage",
            profileVideo: "$employeeDetails.profileVideo",
          },
        },
      },

      // 8️⃣ Sort upcoming interviews first
      {
        $sort: { interviewDate: 1 },
      },
    ]);

    return res.status(200).json({
      success: true,
      totalInterviews: interviews.length,
      data: interviews,
    });
  } catch (err) {
    console.error("Error fetching interview details:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching interview details",
      error: err.message,
    });
  }
};





const getSuggestedCandidates = async (req, res) => {
  try {
    const { employerId } = req.params;



    const jobData = await jobModel.findOne({ employId: employerId });
    if (!jobData) {
      return res.status(404).json({
        success: false,
        message: "Job not found or does not belong to this employer",
      });
    }

    const candidateData = await employeeModel.find(
      {},
      {
        userPassword: 0,
        otp: 0,
        otpExpires: 0,
        employeefcmtoken: 0,
        googleId: 0,
        appleId: 0,
        audioFiles: 0,
        videoFiles: 0,
      }
    ).lean();
    console.log("candidate", candidateData)

    const AI_LIMIT = 15;
    const reducedCandidates = candidateData.slice(0, AI_LIMIT).map((c) => ({
      _id: c._id,
      name: c.userName,
      skills: c.skills,
      experience: c.totalExperience,
      currentrole: c.currentrole,
      specialization: c.specialization,
      city: c.city,
      expectedSalary: c.expectedSalary,
      education: c.education ? c.education.map(e => `${e.degree} from ${e.institution}`) : [],
    }));

    if (reducedCandidates.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const jobDetailsForAI = {
      jobTitle: jobData.jobTitle,
      description: jobData.jobDescription || jobData.description,
      requiredSkills: jobData.skills,
      experienceLevel: jobData.experienceLevel,
      location: jobData.location,
      isRemote: jobData.isRemote,
    };

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "GEMINI_API_KEY is not defined in the server environment.",
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
      },
    });

    const prompt = `
      You are an expert HR recruitment AI.
      I will provide a 'JobDescription' and a list of 'Candidates'.
      Your task is to analyze each candidate and calculate a match score (0 to 100) based on how well their skills, experience, and details align with the JobDescription.
      
      JobDescription:
      ${JSON.stringify(jobDetailsForAI, null, 2)}

      Candidates:
      ${JSON.stringify(reducedCandidates, null, 2)}

      Output exactly a JSON array of objects without any markdown wrappers. Each object must have these properties:
      - "candidateId" (must match the _id of the candidate exactly)
      - "score" (a number between 0 and 100)
      - "matchReason" (Max 1 short sentence explanation of the match)
      Ensure the output array is sorted in descending order by score.
    `;

    const result = await model.generateContent(prompt);
    let aiResponseText = result.response.text();

    let scoresMap;
    try {
      scoresMap = JSON.parse(aiResponseText);
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiResponseText);
      return res.status(500).json({
        success: false,
        message: "AI response format was invalid",
        error: parseError.message
      });
    }

    const finalSuggested = [];
    scoresMap.forEach((aiScore) => {
      // Only include candidates with a score of 40 or above
      if (aiScore.score >= 40) {
        const dbCandidate = candidateData.find(
          (c) => c._id.toString() === aiScore.candidateId
        );
        if (dbCandidate) {
          finalSuggested.push({
            ...dbCandidate,
            aiScore: aiScore.score,
            aiMatchReason: aiScore.matchReason,
          });
        }
      }
    });

    // Explicitly sort it here too, just to be sure
    finalSuggested.sort((a, b) => b.aiScore - a.aiScore);

    return res.status(200).json({
      success: true,
      data: finalSuggested,
    });
  } catch (err) {
    console.log("Error in getting the suggested candidates", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
}











const updateCoverPicture = async (req, res) => {
  try {
    const { employid } = req.params;

    if (!employid || !mongoose.isValidObjectId(employid)) {
      return res.status(400).json({ message: "Valid employee ID is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = req.file;

    const fileUrl = result.secure_url || result.url || result.path;
    if (!fileUrl) {
      return res.status(500).json({
        message: "Cloudinary upload failed: No URL returned",
        details: result,
      });
    }

    const currentEmployee = await userModel.findById(employid);
    if (!currentEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (currentEmployee.userCoverPic) {
      try {
        const publicId = currentEmployee.userCoverPic
          .split("/")
          .slice(-2)
          .join("/")
          .split(".")[0];
        // Note: cloudinary.uploader.destroy(publicId) could be called here
      } catch (err) {
        console.error("Failed to parse old cover picture:", err);
      }
    }

    currentEmployee.userCoverPic = fileUrl;
    await currentEmployee.save();

    res.status(200).json({
      success: true,
      message: "Cover picture updated successfully",
      file: {
        name: result.originalname || result.filename || "Unnamed",
        url: fileUrl,
      },
    });
  } catch (error) {
    console.error("Error updating cover picture:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating cover picture",
      error: error.message,
    });
  }
};

module.exports = {
  getSuggestedCandidates,
  getInterviewDetails,
  getDashboardData,
  getEmployerDetailsTopBar,
  getJobAndEmployerCount,
  signUp,
  decreaseProfileView,
  decreaseResumeDownload,
  employerForgotPassword,
  employerverifyOTP,
  employerChangePassword,
  login,
  googleAuth,
  getReferralLink,
  appleAuth,
  sendOtpToEmail,
  verifyEmailOtp,
  listAllEmployees,
  getEmployerDetails,
  updateEmployerDetails,
  updateProfilePicture,
  updateCoverPicture,
  employerChangeMyPassword,
};
