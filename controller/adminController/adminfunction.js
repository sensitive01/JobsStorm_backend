// controllers/employerController.js
const express = require("express");
const router = express.Router();
const employerController = require('../../controller/adminController/adminfunction');   
const Employer = require('../../models/employerSchema');
const Employee = require('../../models/employeeschema');
const Employeradmin = require('../../models/employeradminSchema');

const Job = require('../../models/jobSchema');
// Approve a single employer
exports.approveSingleEmployer = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationstatus } = req.body; // Accept from client

    if (!verificationstatus) {
      return res.status(400).json({ message: 'Verification status is required' });
    }

    const employer = await Employer.findByIdAndUpdate(
      id,
      { verificationstatus },
      { new: true }
    );

    if (!employer) {
      return res.status(404).json({ message: 'Employer not found' });
    }

    res.json({
      message: `Employer verification status updated to ${verificationstatus}`,
      employer
    });
  } catch (error) {
    console.error('Error updating employer verification status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Approve all employers
exports.approveAllEmployers = async (req, res) => {
  try {
    const result = await Employer.updateMany(
      {},
      { verificationstatus: 'approved' }
    );

    res.json({
      message: `Verification status updated to approved for ${result.modifiedCount} employers`
    });
  } catch (error) {
    console.error('Error approving all employers:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.approveSingleEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationstatus } = req.body; // Accept from request body

    if (!verificationstatus) {
      return res.status(400).json({ message: 'Verification status is required' });
    }

    const employee = await Employee.findByIdAndUpdate(
      id,
      { verificationstatus },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({
      message: `Employee verification status updated to ${verificationstatus}`,
      employee
    });
  } catch (error) {
    console.error('Error updating employee verification status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Approve all employers
exports.approveAllEmployee = async (req, res) => {
  try {
    const result = await Employee.updateMany(
      {},
      { verificationstatus: 'approved' }
    );

    res.json({
      message: `Verification status updated to approved for ${result.modifiedCount} employee`
    });
  } catch (error) {
    console.error('Error approving all employee:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.approveSingleEmployeradmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationstatus } = req.body; // Get status from request body

    if (!verificationstatus) {
      return res.status(400).json({ message: 'Verification status is required' });
    }

    const employerAdmin = await Employeradmin.findByIdAndUpdate(
      id,
      { verificationstatus },
      { new: true }
    );

    if (!employerAdmin) {
      return res.status(404).json({ message: 'Employer admin not found' });
    }

    res.json({
      message: `Employer admin verification status updated to ${verificationstatus}`,
      employerAdmin
    });
  } catch (error) {
    console.error('Error updating employer admin verification status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Approve all employers
exports.approveAllEmployeradmin = async (req, res) => {
  try {
    const result = await Employeradmin.updateMany(
      {},
      { verificationstatus: 'approved' }
    );

    res.json({
      message: `Verification status updated to approved for ${result.modifiedCount} employee`
    });
  } catch (error) {
    console.error('Error approving all employee:', error);
    res.status(500).json({ message: 'Server error' });
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
    const approvedJobs = await Job.find({ postingstatus: "approved" })
      .sort({ createdAt: -1 });

    console.log("Approved Jobs:", approvedJobs);

    res.status(200).json({
      message: "All jobs updated to approved successfully",
      updatedCount: result.modifiedCount,
      approvedJobs
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
      return res.status(400).json({ message: "Please provide a postingstatus value" });
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
      updatedJob
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
      return res.status(400).json({ message: 'Verification status is required' });
    }

    const employer = await Employer.findByIdAndUpdate(
      id,
      { blockstatus },
      { new: true }
    );

    if (!employer) {
      return res.status(404).json({ message: 'Employer not found' });
    }

    res.json({
      message: `Employer verification status updated to ${blockstatus}`,
      employer
    });
  } catch (error) {
    console.error('Error updating employer verification status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.updateallblock = async (req, res) => {
  try {
    const result = await Employeradmin.updateMany(
      {},
      { blockstatus: 'unblock' }
    );

    res.json({
      message: `Verification status updated to approved for ${result.modifiedCount} employers`
    });
  } catch (error) {
    console.error('Error approving all employers:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.blockunblockemployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { blockstatus } = req.body; // Accept from client

    if (!blockstatus) {
      return res.status(400).json({ message: 'Verification status is required' });
    }

    const employer = await Employee.findByIdAndUpdate(
      id,
      { blockstatus },
      { new: true }
    );

    if (!employer) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({
      message: `Employee verification status updated to ${blockstatus}`,
      employer
    });
  } catch (error) {
    console.error('Error updating employer verification status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.blockunblockemployeradmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { blockstatus } = req.body; // Accept from client

    if (!blockstatus) {
      return res.status(400).json({ message: 'Verification status is required' });
    }

    const employer = await Employeradmin.findByIdAndUpdate(
      id,
      { blockstatus },
      { new: true }
    );

    if (!employer) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({
      message: `Employee verification status updated to ${blockstatus}`,
      employer
    });
  } catch (error) {
    console.error('Error updating employer verification status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.getAllEmployers = async (req, res) => {
  try {
    const employers = await Employer.find().sort({ createdAt: -1 }); // latest first
    res.status(200).json({
      success: true,
      count: employers.length,
      data: employers
    });
  } catch (error) {
    console.error("Error fetching employers:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};
exports.getSubscribedEmployers = async (req, res) => {
  try {
    const subscribedEmployers = await Employer.find({ subscription: "true" })
      .sort({ createdAt: -1 }); // latest first

    res.status(200).json({
      success: true,
      count: subscribedEmployers.length,
      data: subscribedEmployers
    });
  } catch (error) {
    console.error("Error fetching subscribed employers:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};