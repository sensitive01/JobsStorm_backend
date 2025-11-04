const Admin = require('../../models/adminloginschema');
const bcrypt = require('bcrypt');
const EmployerAdmin = require('../../models/employeradminSchema');
const jwt = require("jsonwebtoken");



exports.getAllEmployerAdmins = async (req, res) => {
  try {
    // Fetch all documents
    const admins = await EmployerAdmin.find();

    res.status(200).json({
      success: true,
      count: admins.length,
      data: admins
    });
  } catch (error) {
    console.error("Error fetching employer admins:", error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching employer admins'
    });
  }
};
exports.adminSignup = async (req, res) => {
  const { adminid, username, password } = req.body;

  // Validate input
  if (!adminid || !username || !password) {
    return res.status(400).json({ success: false, message: 'Admin ID, username, and password are required' });
  }

  try {
    // Check if adminid already exists
    const existingAdminId = await Admin.findOne({ adminid });
    if (existingAdminId) {
      return res.status(400).json({ success: false, message: 'Admin ID already exists' });
    }

    // Check if username already exists
    const existingUsername = await Admin.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ success: false, message: 'Username already taken' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new admin
    const newAdmin = new Admin({ adminid, username, password: hashedPassword });
    await newAdmin.save();

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      data: { adminid, username }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.adminLogin = async (req, res) => {
  const { adminid, username, password } = req.body;

  if ((!adminid && !username) || !password) {
    return res.status(400).json({ success: false, message: 'Admin ID/Username and password are required' });
  }

  try {
    // Find by adminid or username
    const admin = await Admin.findOne({
      $or: [
        { adminid: adminid || '' },
        { username: username || '' }
      ]
    });

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Compare hashed passwords
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { adminid: admin.adminid, username: admin.username }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


exports.initializeAdmin = async () => {
  try {
    const existingAdmin = await Admin.findOne();
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      const newAdmin = new Admin({
        email: process.env.ADMIN_EMAIL,
        password: hashedPassword,
      });
      await newAdmin.save();
      console.log("✅ Default admin created:", newAdmin.email);
    } else {
      console.log("ℹ️ Admin already exists:", existingAdmin.email);
    }
  } catch (error) {
    console.error("❌ Error initializing admin:", error);
  }
};

// ✅ Admin Login
exports.adminVerification = async (req, res) => {
  try {
    const { userEmail, userPassword } = req.body;

    if (!userEmail || !userPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password required." });
    }

    const admin = await Admin.findOne({ email: userEmail });
    if (!admin) {
      return res
        .status(400)
        .json({ success: false, message: "Admin not found." });
    }

    const isPasswordMatch = await bcrypt.compare(userPassword, admin.password);
    if (!isPasswordMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid password." });
    }

    // ✅ Generate JWT
    const token = jwt.sign(
      { email: admin.email, role: "admin" },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "2h" }
    );

    console.log("✅ Admin login successful");
    return res.status(200).json({
      success: true,
      message: "Admin login successful.",
      token,
    });
  } catch (err) {
    console.error("❌ Error in admin verification:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during admin verification.",
      error: err.message,
    });
  }
};

