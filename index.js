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
const app = express();
const { PORT } = require("./config/variables.js");
const cron = require('node-cron');
const { initializeAdmin } = require("./controller/adminController/adminlogin.js");
app.set("trust proxy", true);

// DATABASE CONNECTION
dbConnect();
initializeAdmin();


app.use(cookieParser());
app.use(express.json());

const allowedOrigins = ["http://localhost:5174","http://localhost:5173","https://job-storm-frontend.vercel.app","https://job-strom-employer.vercel.app","https://job-strom-employer.vercel.app","https://jobsstorm-admin-panel.vercel.app","https://jobsstorm.com"];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`CORS error for origin: ${origin}`);
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
console.log('Cron job scheduled.'); // To confirm that the job is scheduled

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
