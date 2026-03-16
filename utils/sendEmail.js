const nodemailer = require("nodemailer");
require("dotenv").config();
const path = require("path");

const sendEmail = async (to, subject, html) => {
  let transportConfig;

  // Use custom SMTP settings if provided (for custom domain emails like Hostinger, cPanel, etc.)
  if (process.env.SMTP_HOST) {
    transportConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    };
  } else {
    // Fallback to Gmail SMTP
    transportConfig = {
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    };
  }

  const transporter = nodemailer.createTransport(transportConfig);

  const mailOptions = {
    from: `"JobsStorm – Global Career Partner" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    attachments: [
      {
        filename: "jobsstorm-logo.png",
        path: path.join(__dirname, "../assets/logo-light.png"),
        cid: "jobsstormlogo",
      },
    ],
  };

  await transporter.sendMail(mailOptions);
  console.log(`Email sent to ${to}`);
};

module.exports = sendEmail;
