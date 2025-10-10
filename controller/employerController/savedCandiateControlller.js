const SavedCandidate = require("../../models/savedcandiSchema");


exports.toggleSaveCandidate = async (req, res) => {
  try {
    const { employerId, employeeId } = req.params;

    if (!employerId || !employeeId) {
      return res.status(400).json({ success: false, message: "employerId and employeeId are required" });
    }

    // Find existing saved record
    let saved = await SavedCandidate.findOne({ employerId });

    if (!saved) {
      // Create new record if none exists
      saved = new SavedCandidate({
        employerId,
        employeeIds: [employeeId],
      });
      await saved.save();
      return res.status(201).json({ success: true, message: "Candidate saved", data: saved });
    }

    // Check if employee is already saved
    const exists = saved.employeeIds.some(id => id.toString() === employeeId);

    if (exists) {
      // Remove employeeId
      saved.employeeIds = saved.employeeIds.filter(id => id.toString() !== employeeId);
      await saved.save();
      return res.status(200).json({ success: true, message: "Candidate removed", data: saved });
    } else {
      // Add employeeId
      saved.employeeIds.push(employeeId);
      await saved.save();
      return res.status(200).json({ success: true, message: "Candidate saved", data: saved });
    }

  } catch (error) {
    console.error("Error saving/removing candidate:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getSavedCandidates = async (req, res) => {
  try {
    const { employerId } = req.params;

    if (!employerId) {
      return res.status(400).json({ success: false, message: "employerId is required" });
    }

    // Fetch saved candidates with populated employee objects
    const saved = await SavedCandidate.findOne({ employerId }).populate("employeeIds");

    if (!saved) {
      return res.status(200).json({
        success: true,
        message: "No saved candidates found",
        data: { employeeIds: [] },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Saved candidates retrieved",
      data: saved,
    });

  } catch (error) {
    console.error("Error fetching saved candidates:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
