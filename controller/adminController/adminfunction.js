// controllers/employerController.js
const express = require("express");
const router = express.Router();
const employerController = require("../../controller/adminController/adminfunction");
const Employer = require("../../models/employerSchema");
const Employee = require("../../models/employeeschema");
const Employeradmin = require("../../models/employeradminSchema");
const Blog = require("../../models/blogSchema");

const Job = require("../../models/jobSchema");
// Approve a single employer
exports.approveSingleEmployer = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationstatus } = req.body; // Accept from client

    if (!verificationstatus) {
      return res
        .status(400)
        .json({ message: "Verification status is required" });
    }

    const employer = await Employer.findByIdAndUpdate(
      id,
      { verificationstatus },
      { new: true }
    );

    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    res.json({
      message: `Employer verification status updated to ${verificationstatus}`,
      employer,
    });
  } catch (error) {
    console.error("Error updating employer verification status:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Approve all employers
exports.approveAllEmployers = async (req, res) => {
  try {
    const result = await Employer.updateMany(
      {},
      { verificationstatus: "approved" }
    );

    res.json({
      message: `Verification status updated to approved for ${result.modifiedCount} employers`,
    });
  } catch (error) {
    console.error("Error approving all employers:", error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.approveSingleEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationstatus } = req.body; // Accept from request body

    if (!verificationstatus) {
      return res
        .status(400)
        .json({ message: "Verification status is required" });
    }

    const employee = await Employee.findByIdAndUpdate(
      id,
      { verificationstatus },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({
      message: `Employee verification status updated to ${verificationstatus}`,
      employee,
    });
  } catch (error) {
    console.error("Error updating employee verification status:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Approve all employers
exports.approveAllEmployee = async (req, res) => {
  try {
    const result = await Employee.updateMany(
      {},
      { verificationstatus: "approved" }
    );

    res.json({
      message: `Verification status updated to approved for ${result.modifiedCount} employee`,
    });
  } catch (error) {
    console.error("Error approving all employee:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.approveSingleEmployeradmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationstatus } = req.body; // Get status from request body

    if (!verificationstatus) {
      return res
        .status(400)
        .json({ message: "Verification status is required" });
    }

    const employerAdmin = await Employeradmin.findByIdAndUpdate(
      id,
      { verificationstatus },
      { new: true }
    );

    if (!employerAdmin) {
      return res.status(404).json({ message: "Employer admin not found" });
    }

    res.json({
      message: `Employer admin verification status updated to ${verificationstatus}`,
      employerAdmin,
    });
  } catch (error) {
    console.error("Error updating employer admin verification status:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Approve all employers
exports.approveAllEmployeradmin = async (req, res) => {
  try {
    const result = await Employeradmin.updateMany(
      {},
      { verificationstatus: "approved" }
    );

    res.json({
      message: `Verification status updated to approved for ${result.modifiedCount} employee`,
    });
  } catch (error) {
    console.error("Error approving all employee:", error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.updateapproved = async (req, res) => {
  try {
    // Update all jobs to approved
    const result = await Job.updateMany(
      { postingstatus: { $ne: "approved" } }, // only update non-approved jobs
      { $set: { postingstatus: "approved" } }
    );

    console.log("Update Result:", result);

    // Fetch all approved jobs after update
    const approvedJobs = await Job.find({ postingstatus: "approved" }).sort({
      createdAt: -1,
    });

    console.log("Approved Jobs:", approvedJobs);

    res.status(200).json({
      message: "All jobs updated to approved successfully",
      updatedCount: result.modifiedCount,
      approvedJobs,
    });
  } catch (error) {
    console.error("Error updating jobs to approved:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateJobStatus = async (req, res) => {
  try {
    const { id } = req.params; // single job ID from URL
    const { postingstatus } = req.body; // status from request body

    if (!id) {
      return res.status(400).json({ message: "Please provide a job ID" });
    }

    if (!postingstatus) {
      return res
        .status(400)
        .json({ message: "Please provide a postingstatus value" });
    }

    // Update the job's postingstatus
    const updatedJob = await Job.findByIdAndUpdate(
      id,
      { $set: { postingstatus } },
      { new: true } // return updated document
    );

    if (!updatedJob) {
      return res.status(404).json({ message: "Job not found" });
    }

    console.log(`Updated Job (${id}) to status: ${postingstatus}`, updatedJob);

    res.status(200).json({
      message: `Job updated to status: ${postingstatus} successfully`,
      updatedJob,
    });
  } catch (error) {
    console.error("Error updating job status:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.blockunblockemployer = async (req, res) => {
  try {
    const { id } = req.params;
    const { blockstatus } = req.body; // Accept from client

    if (!blockstatus) {
      return res
        .status(400)
        .json({ message: "Verification status is required" });
    }

    const employer = await Employer.findByIdAndUpdate(
      id,
      { blockstatus },
      { new: true }
    );

    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    res.json({
      message: `Employer verification status updated to ${blockstatus}`,
      employer,
    });
  } catch (error) {
    console.error("Error updating employer verification status:", error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.updateallblock = async (req, res) => {
  try {
    const result = await Employeradmin.updateMany(
      {},
      { blockstatus: "unblock" }
    );

    res.json({
      message: `Verification status updated to approved for ${result.modifiedCount} employers`,
    });
  } catch (error) {
    console.error("Error approving all employers:", error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.blockunblockemployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { blockstatus } = req.body; // Accept from client

    if (!blockstatus) {
      return res
        .status(400)
        .json({ message: "Verification status is required" });
    }

    const employer = await Employee.findByIdAndUpdate(
      id,
      { blockstatus },
      { new: true }
    );

    if (!employer) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({
      message: `Employee verification status updated to ${blockstatus}`,
      employer,
    });
  } catch (error) {
    console.error("Error updating employer verification status:", error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.blockunblockemployeradmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { blockstatus } = req.body; // Accept from client

    if (!blockstatus) {
      return res
        .status(400)
        .json({ message: "Verification status is required" });
    }

    const employer = await Employeradmin.findByIdAndUpdate(
      id,
      { blockstatus },
      { new: true }
    );

    if (!employer) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({
      message: `Employee verification status updated to ${blockstatus}`,
      employer,
    });
  } catch (error) {
    console.error("Error updating employer verification status:", error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.getAllEmployers = async (req, res) => {
  try {
    const employers = await Employer.find(
      {},
      {
        companyName: 1,
        contactEmail: 1,
        contactPerson: 1,
        isVerified: 1,
        verificationstatus: 1,
        createdAt: 1,
      }
    ).sort({ createdAt: -1 }); // latest first
    res.status(200).json({
      success: true,
      count: employers.length,
      data: employers,
    });
  } catch (error) {
    console.error("Error fetching employers:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.approveEmployer = async (req, res) => {
  try {
    const { employerId } = req.params;

    if (!employerId) {
      return res
        .status(400)
        .json({ success: false, message: "Employer ID is required" });
    }

    const updatedEmployer = await Employer.findByIdAndUpdate(
      employerId,
      {
        isVerified: true,
        verificationstatus: "approved",
      },
      { new: true }
    );

    if (!updatedEmployer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer not found" });
    }

    res.status(200).json({
      success: true,
      message: "Employer approved successfully",
      data: updatedEmployer,
    });
  } catch (error) {
    console.error("Error approving employer:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.rejectEmployer = async (req, res) => {
  try {
    const { employerId } = req.params;

    if (!employerId) {
      return res
        .status(400)
        .json({ success: false, message: "Employer ID is required" });
    }

    const updatedEmployer = await Employer.findByIdAndUpdate(
      employerId,
      {
        isVerified: false,
        verificationstatus: "rejected",
      },
      { new: true }
    );

    if (!updatedEmployer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer not found" });
    }

    res.status(200).json({
      success: true,
      message: "Employer rejected successfully",
      data: updatedEmployer,
    });
  } catch (error) {
    console.error("Error rejecting employer:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getSubscribedEmployers = async (req, res) => {
  try {
    const subscribedEmployers = await Employer.find({
      subscription: "true",
    }).sort({ createdAt: -1 }); // latest first

    res.status(200).json({
      success: true,
      count: subscribedEmployers.length,
      data: subscribedEmployers,
    });
  } catch (error) {
    console.error("Error fetching subscribed employers:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.getEmployerDetails = async (req, res) => {
  try {
    const { employerId } = req.params;

    if (!employerId) {
      return res.status(400).json({
        success: false,
        message: "Employer ID is required",
      });
    }

    const employer = await Employer.findById(employerId, { password: 0 });

    if (!employer) {
      return res.status(404).json({
        success: false,
        message: "Employer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: employer,
    });
  } catch (error) {
    console.error("Error fetching employer details:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.getRegisteredCandidates = async (req, res) => {
  try {
    const candidates = await Employee.find(
      {},
      {
        userName: 1,
        userEmail: 1,
        blockstatus: 1,
        isVerified: 1,
        verificationstatus: 1,
        emailverifedstatus: 1,
        createdAt: 1,
      }
    ).sort({ createdAt: -1 }); // latest first

    res.status(200).json({
      success: true,
      count: candidates.length,
      data: candidates,
    });
  } catch (error) {
    console.error("Error fetching registered candidates:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.getCandidateDetails = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const candidates = await Employee.findOne(
      { _id: candidateId },
      { userPassword: 0 }
    );

    res.status(200).json({
      success: true,

      data: candidates,
    });
  } catch (error) {
    console.error("Error fetching registered candidates:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.getRegisteredCompanyData = async (req, res) => {
  try {
    const employers = await Employer.aggregate([
      {
        $project: {
          companyName: 1,
          contactEmail: 1,
          contactPerson: 1,
          isVerified: 1,
          verificationstatus: 1,
          createdAt: 1,
          _idStr: { $toString: "$_id" }, // convert ObjectId to string
        },
      },
      {
        $lookup: {
          from: "jobs",
          localField: "_idStr",
          foreignField: "employId",
          as: "jobsPosted",
        },
      },
      {
        $addFields: {
          totalJobsPosted: { $size: "$jobsPosted" },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $project: { jobsPosted: 0, _idStr: 0 },
      },
    ]);

    res.status(200).json({
      success: true,
      count: employers.length,
      data: employers,
    });
  } catch (error) {
    console.error("Error fetching employers:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.getAllJobsPostedByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    // Fetch jobs where employId matches companyId
    const jobs = await Job.find(
      { employId: companyId },
      {
        companyName: 1,
        jobId: 1,
        jobTitle: 1,
        deadline: 1,
        vacancy: 1,
        createdAt: 1,
      }
    ).sort({ createdAt: -1 }); // latest first

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs,
    });
  } catch (error) {
    console.error("Error fetching jobs for company:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.getJobDetails = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error("Error fetching job details:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};


exports.updateJobDetails = async (req, res) => {
  try {
    const { jobId } = req.params; // _id from URL
    const { updatedData } = req.body; // New data to overwrite existing
    console.log("updatedData", updatedData)

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
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



exports.postBlogs = async (req, res) => {
  try {
    const { data } = req.body;
    console.log("Received Blog Data:", data);

    // Validate
    if (!data.title || !data.category || !data.description || !data.author || !data.authorRole) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // Create & Save
    const newBlog = await Blog.create({
      title: data.title,
      category: data.category,
      description: data.description,
      author: data.author,
      authorRole: data.authorRole,
      image: data.image,
      authorImage: data.authorImage
    });

    return res.status(201).json({
      success: true,
      message: "Blog posted successfully",
      blog: newBlog
    });

  } catch (err) {
    console.error("❌ Error blog post", err);
    return res.status(500).json({
      success: false,
      message: "Server error during blog post.",
      error: err.message,
    });
  }
};

exports.getAllBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find();
    return res.status(200).json({
      success: true,
      message: "Blogs fetched successfully",
      blogs: blogs
    });

  } catch (err) {
    console.error("❌ Error getting blog", err);
    return res.status(500).json({
      success: false,
      message: "Server error during getting blog data.",
      error: err.message,
    });
  }
};

exports.getBlogData = async (req, res) => {
  try {
    const { id } = req.params;
    const blogs = await Blog.findOne({ _id: id });
    return res.status(200).json({
      success: true,
      message: "Blogs fetched successfully",
      blogs: blogs
    });

  } catch (err) {
    console.error("❌ Error getting blog", err);
    return res.status(500).json({
      success: false,
      message: "Server error during getting blog data.",
      error: err.message,
    });
  }
};

exports.updateBlogdata = async (req, res) => {
  try {
    const { id } = req.params;
    const { data } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Blog ID is required"
      });
    }

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No data provided for update"
      });
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      id,
      {
        $set: {
          title: data.title,
          category: data.category,
          description: data.description,
          author: data.author,
          authorRole: data.authorRole,
          image: data.image,
          authorImage: data.authorImage
        }
      },
      { new: true } // returns updated document
    );

    if (!updatedBlog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      blog: updatedBlog
    });

  } catch (err) {
    console.error("❌ Error updating blog", err);
    return res.status(500).json({
      success: false,
      message: "Server error during update.",
      error: err.message,
    });
  }
};


exports.deleteBlogData = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Blog ID is required",
      });
    }

    const deletedBlog = await Blog.findByIdAndDelete(id);

    if (!deletedBlog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
      deletedBlog,
    });

  } catch (err) {
    console.error("❌ Error deleting blog", err);
    return res.status(500).json({
      success: false,
      message: "Server error during delete.",
      error: err.message,
    });
  }
};
