const mongoose = require("mongoose");
const Job = require("../../models/jobSchema");
const Employer = require("../../models/employerSchema");
const SavedCandidate = require('../../models/savedcandiSchema');
const getJobTitleByJobId = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    if (!jobId || jobId.length !== 24) {
      return res.status(400).json({ success: false, message: "Invalid jobId" });
    }
    const job = await Job.findById(jobId).select("jobTitle");
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    res.json({ success: true, jobTitle: job.jobTitle });
  } catch (error) {
    console.error("Error fetching job title:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

const updateJobById = async (req, res) => {
  try {
    const { id } = req.params; // _id from URL
    const updatedData = req.body; // New data to overwrite existing

    const updatedJob = await Job.findByIdAndUpdate(
      id,
      { ...updatedData, updatedAt: Date.now() }, // overwrite all fields, and update timestamp
      { new: true, runValidators: true }
    );

    if (!updatedJob) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(200).json(updatedJob);
  } catch (error) {
    console.error("Error updating job:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

const createJob = async (req, res) => {
  try {
    const jobData = req.body;
    console.log("jobData", jobData);

    console.log("jobData", jobData);

    // Find the employer by employid
    // const employer = await Employer.findOne({ _id: jobData.employid });
    const employer = await Employer.findOne({
      $or: [{ _id: jobData.employid }, { userEmail: jobData.contactEmail }],
    });

    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    // Check if totaljobpostinglimit is greater than 0
    if (employer.totaljobpostinglimit <= 0) {
      return res
        .status(403)
        .json({
          message:
            "Job posting limit reached. Please upgrade your subscription.",
        });
    }

    // Create the new job
    const newJob = new Job(jobData);
    const savedJob = await newJob.save();

    // Decrease the totaljobpostinglimit by 1
    employer.totaljobpostinglimit -= 1;
    await employer.save();

    // Return the saved job
    res.status(201).json(savedJob);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.aggregate([
      {
        $sort: { createdAt: -1 },
      },
      {
        $addFields: {
          employidObject: { $toObjectId: "$employid" },
        },
      },
      {
        $lookup: {
          from: "employers", // match with collection name, which is auto pluralized
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
            $concat: [
              { $ifNull: ["$employerInfo.firstName", ""] },
              " ",
              { $ifNull: ["$employerInfo.lastName", ""] },
            ],
          },
        },
      },
      {
        $project: {
          employidObject: 0,
          employerInfo: 0,
        },
      },
    ]);

    res.status(200).json(jobs);
  } catch (error) {
    console.error("Error in getAllJobs:", error);
    res.status(500).json({ message: error.message });
  }
};

// GET /api/jobs/:id
const getJobById = async (req, res) => {
  try {
    const jobId = req.params.id;

    const jobs = await Job.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(jobId) },
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

    const job = jobs[0];

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(200).json(job);
  } catch (error) {
    console.error("Error in getJobById:", error);
    res.status(500).json({ message: error.message });
  }
};
// GET /api/jobs/employee/:employid
const getJobsByEmployee = async (req, res) => {
  try {
    const jobs = await Job.aggregate([
      {
        $match: { employid: req.params.employid },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $addFields: {
          employidObject: {
            $toObjectId: "$employid",
          },
        },
      },
      {
        $lookup: {
          from: "employers", // MongoDB auto-pluralizes 'Employer' model
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

    res.status(200).json(jobs);
  } catch (error) {
    console.error("Failed to fetch jobs with employer data:", error);
    res.status(500).json({ message: error.message });
  }
};


const getAppliedCandidates = async (req, res) => {
  const jobId = req.params.id;

  try {
    // 1️⃣ Fetch the job with applications and employid
    const job = await Job.findById(jobId).select("applications employid");

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // 2️⃣ Fetch saved candidates for this employer
    const savedCandidatesDoc = await SavedCandidate.findOne({ employerId: job.employid });
    const savedEmployeeIds = savedCandidatesDoc
      ? savedCandidatesDoc.employeeIds.map(id => id.toString())
      : [];

    // 3️⃣ Map applications to mark favourite
    const applications = job.applications.map(app => ({
      ...app.toObject(),
      favourite: savedEmployeeIds.includes(app.applicantId)
    }));

    res.status(200).json({
      success: true,
      applications
    });

  } catch (error) {
    console.error("Error fetching applied candidates:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

//sjsjjs
const shortlistcand = async (req, res) => {
  const jobId = req.params.id;

  try {
    // 1️⃣ Fetch job and applications
    const job = await Job.findById(jobId).select("applications employid");

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // 2️⃣ Fetch saved candidates for this employer (using job.employid)
    const savedCandidatesDoc = await SavedCandidate.findOne({ employerId: job.employid });
    const savedEmployeeIds = savedCandidatesDoc
      ? savedCandidatesDoc.employeeIds.map(id => id.toString())
      : [];

    // 3️⃣ Map applications to mark favourites and filter non-pending
    const applications = job.applications
      .map(app => ({
        ...app.toObject(),
        favourite: savedEmployeeIds.includes(app.applicantId)
      }))
      .filter(app => app.employapplicantstatus !== "Pending");

    res.status(200).json({
      success: true,
      applications
    });

  } catch (error) {
    console.error("Error fetching applied candidates:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getFavouriteCandidates = async (req, res) => {
  const { employid } = req.params;

  try {
    // Find all jobs posted by the employer
    const jobs = await Job.find({ employid }).select("jobTitle applications");

    if (jobs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No jobs found for this employer ID",
      });
    }

    // Extract all favourite candidates from these jobs
    const favouriteCandidates = jobs.flatMap((job) =>
      job.applications
        .filter((app) => app.favourite === true)
        .map((app) => ({
          ...app.toObject(),
          jobTitle: job.jobTitle, // attach job title for context
        }))
    );

    res.status(200).json({
      success: true,
      favouriteCandidates,
    });
  } catch (error) {
    console.error("Error fetching favourite candidates:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
const updateFavoriteStatus = async (req, res) => {
  try {
    const { jobId, applicantId } = req.params;
    const { favourite } = req.body;

    const job = await Job.findOne({ _id: jobId });
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const application = job.applications.find(
      (app) => app.applicantId === applicantId
    );
    if (!application) {
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });
    }

    application.favourite = favourite;
    await job.save();

    res.json({ success: true, message: "Favorite status updated" });
  } catch (error) {
    console.error("Error updating favorite status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
const updateApplicantStatus = async (req, res) => {
  try {
    const { applicationId, applicantId } = req.params;
    const {
      status,
      notes,
      interviewtype,
      interviewdate,
      interviewtime,
      interviewlink,
      interviewvenue,
    } = req.body;

    if (!status || !notes) {
      return res
        .status(400)
        .json({ success: false, message: "Status and notes are required" });
    }

    // ✅ Fix: define `now`
    const now = new Date();

    const result = await Job.updateOne(
      {
        "applications._id": applicationId,
        "applications.applicantId": applicantId,
      },
      {
        $set: {
          "applications.$.employapplicantstatus": status,
          "applications.$.notes": notes,
          "applications.$.interviewtype": interviewtype,
          "applications.$.interviewdate": interviewdate,
          "applications.$.interviewtime": interviewtime,
          "applications.$.interviewlink": interviewlink,
          "applications.$.lastupdatestatusdate": now,
          "applications.$.interviewvenue": interviewvenue,
        },
        $push: {
          "applications.$.statusHistory": {
            status,
            notes,
            interviewtype,
            interviewdate,
            interviewtime,
            interviewlink,
            interviewvenue,
            updatedAt: now,
          },
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Application not found or not updated",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Applicant status, notes, and interview details updated successfully",
    });
  } catch (error) {
    console.error("Error updating applicant status:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateFavStatusforsavecand = async (req, res) => {
  try {
    const { applicationId, employid } = req.params;
    const { favourite } = req.body;

    const result = await Job.updateOne(
      {
        employid: employid,
        "applications._id": applicationId,
      },
      {
        $set: {
          "applications.$.favourite": favourite,
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Application not found or favourite not updated",
        });
    }

    return res.json({
      success: true,
      message: "Favourite status updated successfully",
    });
  } catch (error) {
    console.error("Error updating favourite status:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
const getNonPendingApplicantsByEmployId = async (req, res) => {
  try {
    const { employid } = req.params;

    // 1️⃣ Find saved candidates for this employer
    const savedCandidatesDoc = await SavedCandidate.findOne({ employerId: employid });
    const savedEmployeeIds = savedCandidatesDoc
      ? savedCandidatesDoc.employeeIds.map(id => id.toString())
      : [];

    // 2️⃣ Find jobs by employid and select jobTitle and applications
    const jobs = await Job.find({ employid }).select("jobTitle applications");

    // 3️⃣ Flatten all applications, mark favourite, filter non-pending, attach job info
    const nonPendingApplications = jobs.flatMap((job) =>
      job.applications
        .filter((app) => app.employapplicantstatus !== "Pending")
        .map((app) => ({
          ...app.toObject(),
          favourite: savedEmployeeIds.includes(app.applicantId),
          jobTitle: job.jobTitle,
          jobId: job._id,
        }))
    );

    res.status(200).json({
      success: true,
      data: nonPendingApplications,
    });

  } catch (error) {
    console.error("Error fetching applicants:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
const getAllApplicantsByEmployId = async (req, res) => {
  try {
    const { employid } = req.params;

    // Find jobs by employid and select jobTitle and applications
    const jobs = await Job.find({ employid }).select("jobTitle applications");

    // Flatten all applications from multiple jobs, attaching jobTitle and jobId
    const allApplications = jobs.flatMap((job) =>
      job.applications.map((app) => ({
        ...app.toObject(),
        jobTitle: job.jobTitle,
        jobId: job._id,
      }))
    );

    res.status(200).json({
      success: true,
      data: allApplications,
    });
  } catch (error) {
    console.error("Error fetching applicants:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

const toggleSaveJob = async (req, res) => {
  try {
    const { applicantId, jobId } = req.body;
    console.log("[TOGGLE-SAVE-JOB] incoming:", { applicantId, jobId });

    if (!applicantId || !jobId) {
      console.log("[TOGGLE-SAVE-JOB] missing applicantId or jobId");
      return res
        .status(400)
        .json({ message: "applicantId and jobId are required" });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      console.log("[TOGGLE-SAVE-JOB] job not found");
      return res.status(404).json({ message: "Job not found" });
    }

    if (!Array.isArray(job.saved)) job.saved = [];

    const savedIndex = job.saved.findIndex(
      (s) => String(s.applicantId) === String(applicantId)
    );
    console.log("[TOGGLE-SAVE-JOB] savedIndex:", savedIndex);

    if (savedIndex === -1) {
      // Job is not saved, so save it
      job.saved.push({ applicantId, saved: true });
      await job.save();
      console.log("[TOGGLE-SAVE-JOB] job saved");
      return res
        .status(201)
        .json({ message: "Job saved successfully", isSaved: true });
    } else {
      // Job is already saved, so unsave it
      job.saved.splice(savedIndex, 1);
      await job.save();
      console.log("[TOGGLE-SAVE-JOB] job unsaved");
      return res
        .status(200)
        .json({ message: "Job unsaved successfully", isSaved: false });
    }
  } catch (error) {
    console.error("[TOGGLE-SAVE-JOB] error:", error);
    res
      .status(500)
      .json({ message: "Error toggling job save state", error: error.message });
  }
};

const fetchAllJobs = async (req, res) => {
  try {
    console.log("[FETCH-ALL-JOBS] fetching all jobs");

    const jobs = await Job.aggregate([
      {
        $match: {
          isActive: true, // Only fetch jobs that are active
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $addFields: {
          employidObject: {
            $toObjectId: "$employid",
          },
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
      console.log("[FETCH-ALL-JOBS] no jobs found");
      return res.status(404).json({ message: "No jobs found" });
    }

    console.log("[FETCH-ALL-JOBS] jobs fetched:", jobs.length);
    res.status(200).json(jobs);
  } catch (error) {
    console.error("[FETCH-ALL-JOBS] error:", error);
    res
      .status(500)
      .json({ message: "Error fetching jobs", error: error.message });
  }
};

const fetchSavedJobslist = async (req, res) => {
  try {
    const { employid } = req.params;
    console.log("[FETCH-SAVED-JOBS] incoming:", { employid });

    if (!employid) {
      console.log("[FETCH-SAVED-JOBS] employid not provided");
      return res.status(400).json({ message: "employid is required" });
    }

    const jobs = await Job.aggregate([
      {
        $match: {
          "saved.applicantId": employid,
        },
      },
      {
        $addFields: {
          employidObject: { $toObjectId: "$employid" },
        },
      },
      {
        $lookup: {
          from: "employers", // collection name
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
      console.log(
        "[FETCH-SAVED-JOBS] no saved jobs found for employid:",
        employid
      );
      return res.status(404).json({ message: "No saved jobs found" });
    }

    console.log("[FETCH-SAVED-JOBS] saved jobs fetched:", jobs.length);
    res.status(200).json({ jobs });
  } catch (error) {
    console.error("[FETCH-SAVED-JOBS] error:", error);
    res
      .status(500)
      .json({ message: "Error fetching saved jobs", error: error.message });
  }
};

const getJobsWithNonPendingApplications = async (req, res) => {
  const applicantId = req.params.applicantId;

  try {
    const result = await Job.aggregate([
      {
        $match: {
          applications: {
            $elemMatch: {
              applicantId: applicantId,
              employapplicantstatus: { $ne: "Pending" },
            },
          },
        },
      },
      {
        $addFields: {
          applications: {
            $filter: {
              input: "$applications",
              as: "app",
              cond: {
                $and: [
                  { $eq: ["$$app.applicantId", applicantId] },
                  { $ne: ["$$app.employapplicantstatus", "Pending"] },
                ],
              },
            },
          },
          employidObject: { $toObjectId: "$employid" },
        },
      },
      {
        $lookup: {
          from: "employers", // <- MongoDB uses lowercase/plural collection names
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

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching jobs with non-pending applications:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
// GET /jobs/school-employers
const getSchoolEmployerJobs = async (req, res) => {
  try {
    const jobs = await Job.aggregate([
      // Convert string employid to ObjectId
      {
        $addFields: {
          employidObject: { $toObjectId: "$employid" },
        },
      },
      // Lookup employer info
      {
        $lookup: {
          from: "employers",
          localField: "employidObject",
          foreignField: "_id",
          as: "employerInfo",
        },
      },
      {
        $unwind: "$employerInfo",
      },
      // Match only School employers and active jobs
      {
        $match: {
          "employerInfo.employerType": "School",
          isActive: true, // ✅ Filter active jobs
        },
      },
      // Add user-friendly fields
      {
        $addFields: {
          employerProfilePic: "$employerInfo.userProfilePic",
          employerName: {
            $concat: ["$employerInfo.firstName", " ", "$employerInfo.lastName"],
          },
        },
      },
      // Remove unnecessary fields
      {
        $project: {
          employerInfo: 0,
          employidObject: 0,
        },
      },
      // Sort by latest
      { $sort: { createdAt: -1 } },
    ]);

    if (!jobs.length) {
      return res
        .status(404)
        .json({ message: "No jobs found for school employers" });
    }

    res.status(200).json(jobs);
  } catch (error) {
    console.error("[GET-SCHOOL-EMPLOYER-JOBS] error:", error);
    res.status(500).json({
      message: "Error fetching school employer jobs",
      error: error.message,
    });
  }
};

const getcompnanyEmployerJobs = async (req, res) => {
  try {
    const jobs = await Job.aggregate([
      // Convert string employid to ObjectId
      {
        $addFields: {
          employidObject: { $toObjectId: "$employid" },
        },
      },
      // Lookup employer info
      {
        $lookup: {
          from: "employers",
          localField: "employidObject",
          foreignField: "_id",
          as: "employerInfo",
        },
      },
      {
        $unwind: "$employerInfo",
      },
      // Match only Company employers and active jobs
      {
        $match: {
          "employerInfo.employerType": "Company",
          isActive: true, // ✅ Filter only active jobs
        },
      },
      // Add user-friendly fields
      {
        $addFields: {
          employerProfilePic: "$employerInfo.userProfilePic",
          employerName: {
            $concat: ["$employerInfo.firstName", " ", "$employerInfo.lastName"],
          },
        },
      },
      // Remove unnecessary fields
      {
        $project: {
          employerInfo: 0,
          employidObject: 0,
        },
      },
      // Sort by latest
      { $sort: { createdAt: -1 } },
    ]);

    if (!jobs.length) {
      return res
        .status(404)
        .json({ message: "No jobs found for Company employers" });
    }

    res.status(200).json(jobs);
  } catch (error) {
    console.error("[GET-Company-EMPLOYER-JOBS] error:", error);
    res.status(500).json({
      message: "Error fetching Company employer jobs",
      error: error.message,
    });
  }
};

const updateJobActiveStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be a boolean." });
    }

    const job = await Job.findByIdAndUpdate(
      jobId,
      { isActive, updatedAt: new Date() },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(200).json({
      message: `Job has been ${
        isActive ? "activated" : "deactivated"
      } successfully.`,
      job,
    });
  } catch (error) {
    console.error("Error updating job status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  updateJobActiveStatus,
  toggleSaveJob,
  fetchAllJobs,
  fetchSavedJobslist,
  createJob,
  updateJobById,
  getSchoolEmployerJobs,
  getJobsWithNonPendingApplications,
  getAppliedCandidates,
  getAllJobs,
  getJobsByEmployee,
  getJobById,
  getcompnanyEmployerJobs,
  getAllApplicantsByEmployId,
  getFavouriteCandidates,
  updateFavoriteStatus,
  updateApplicantStatus,
  getJobTitleByJobId,
  shortlistcand,
  getNonPendingApplicantsByEmployId,
  updateFavStatusforsavecand,
};
