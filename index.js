require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dbConnect = require("./config/dbConnect.js");
const employeeRoute = require("./routes/employee/employeeRoute.js");
const employerRoute = require("./routes/employer/employerRoute.js");
const mainadminRoute = require("./routes/mainadmin/mainadmin.js");
const employeradminRoute = require("./routes/admin/employeradminRoute.js");
const Employer = require("./models/employerSchema.js");
const Employee = require("./models/employeeschema.js");
const paymentRoute = require("./routes/paymentRoute/paymentRoute.js")
const app = express();
const { PORT } = require("./config/variables.js");
const cron = require('node-cron');
const { initializeAdmin } = require("./controller/adminController/adminlogin.js");
app.set("trust proxy", true);

// DATABASE CONNECTION
dbConnect();
initializeAdmin();


app.use(cookieParser());
// Increase body parser limits for large file uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
// Increase timeout for long-running requests (file uploads)
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 minutes timeout
  res.setTimeout(300000);
  next();
});

const allowedOrigins = ["http://localhost:5174","https://www.jobsstorm.com", "http://localhost:5173", "https://job-storm-frontend.vercel.app", "https://job-strom-employer.vercel.app", "https://job-strom-employer.vercel.app", "https://jobsstorm-admin-panel.vercel.app", "https://jobsstorm.com", "https://admin.jobsstorm.com", "https://employer.jobsstorm.com", "https://test.payu.in", "http://localhost:4000","https://api.jobsstorm.com","https://secure.payu.in"];
const corsOptions = {
  origin: function (origin, callback) {
    // Check if origin is in allow list or if it is undefined (direct server to server or local tool) or "null" (some redirect scenarios)
    if (!origin || allowedOrigins.includes(origin) || origin === "null") {
      callback(null, true);
    } else {
      console.error(`Blocked by CORS: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

app.disable("x-powered-by");

app.use("/", employeeRoute);
app.use("/employer", employerRoute);
app.use("/employeradmin", employeradminRoute);
app.use("/admin", mainadminRoute);
app.use("/payment", paymentRoute);
app.use('/api', paymentRoute);
// 404 Route Handling
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});
cron.schedule("59 23 * * *", async () => {
  console.log("⏰ Running daily employer subscription & trial check...");

  try {
    const today = new Date();

    // 1. TRIAL CHECK: Employers still in trial mode
    const trialEmployers = await Employer.find({
      trial: "false", // Assuming "false" means trial is active
      'currentSubscription.isTrial': true,
      'currentSubscription.startDate': { $exists: true }
    });

    for (const employer of trialEmployers) {
      const trialStart = new Date(employer.currentSubscription.startDate);
      const diffDays = Math.floor((today - trialStart) / (1000 * 60 * 60 * 24));

      if (diffDays >= 30) {
        employer.trial = "true"; // Trial completed
        employer.subscription = "false";
        employer.subscriptionleft = 0;
        employer.currentSubscription = null; // Clear current subscription
        console.log(`✅ Trial ended for employer: ${employer.schoolName || employer.uuid}`);
        await employer.save();
      }
    }

    // 2. SUBSCRIPTION DECREMENT: Active subscriptions
    const activeEmployers = await Employer.find({
      subscription: "true",
      subscriptionleft: { $gt: 0 }
    });

    for (const employer of activeEmployers) {
      let left = parseInt(employer.subscriptionleft);
      left -= 1;
      employer.subscriptionleft = left.toString();

      if (employer.subscriptionleft <= 0) {
        employer.subscription = "false";
        employer.subscriptionleft = 0; // Ensure no negative values
        employer.currentSubscription = null; // Clear current subscription
        console.log(`🚫 Subscription expired for employer: ${employer.schoolName || employer.uuid}`);
      } else {
        console.log(`📉 Decremented subscription for: ${employer.schoolName || employer.uuid} (${employer.subscriptionleft} days left)`);
      }

      await employer.save();
    }

    console.log("✅ Daily employer subscription & trial check completed.");
  } catch (error) {
    console.error("❌ Error in cron job:", error);
  }
}, {
  timezone: "Asia/Kolkata" // Set timezone to IST
});

// Daily check for employee subscription expiration
cron.schedule("59 23 * * *", async () => {
  console.log("⏰ Running daily employee subscription check...");

  try {
    const today = new Date();

    // Find employees with active subscriptions that may have expired
    const employeesWithSubscriptions = await Employee.find({
      'subscription.status': 'active',
      'subscription.endDate': { $exists: true }
    });

    let expiredCount = 0;
    for (const employee of employeesWithSubscriptions) {
      const endDate = new Date(employee.subscription.endDate);

      // If subscription has expired, update status and subscriptionActive
      if (endDate <= today) {
        employee.subscription.status = 'expired';
        employee.subscriptionActive = false;
        await employee.save();
        expiredCount++;
        console.log(`🚫 Subscription expired for employee: ${employee.userName || employee._id}`);
      } else {
        // Ensure subscriptionActive is true if subscription is still active
        if (!employee.subscriptionActive) {
          employee.subscriptionActive = true;
          await employee.save();
        }
      }
    }

    console.log(`✅ Daily employee subscription check completed. ${expiredCount} subscriptions expired.`);
  } catch (error) {
    console.error("❌ Error in employee subscription cron job:", error);
  }
}, {
  timezone: "Asia/Kolkata" // Set timezone to IST
});

console.log('Cron jobs scheduled.'); // To confirm that the jobs are scheduled

// Process-level error handlers to prevent HTML errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process in production, just log
  if (process.env.NODE_ENV === 'production') {
    console.error('Uncaught exception logged, continuing...');
  }
});

// Error Handling Middleware - Always return JSON, never HTML
app.use((err, req, res, next) => {
  console.error('Error caught by middleware:', {
    message: err.message,
    stack: err.stack,
    status: err.status || 500,
    path: req.path,
    method: req.method
  });
  
  // Ensure we always send JSON response
  if (!res.headersSent) {
    res.status(err.status || 500).json({ 
      success: false,
      message: err.message || "Internal Server Error",
      error: err.name || "SERVER_ERROR",
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack,
        details: err 
      })
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
