const nodemailer = require("nodemailer");
require("dotenv").config();
const path = require("path");

const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    from: `"JobsStorm – Global Career Partner" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    attachments: [
      {
        filename: "jobsstorm-logo.png",
        path: path.join(__dirname, "../assets/logo-light.png"), 
        cid: "jobsstormlogo", // ✅ Use CID for embedding inline
      },
    ],
  };

  await transporter.sendMail(mailOptions);
  console.log(`Email sent to ${to}`);
};

module.exports = sendEmail;
