const meetingModel = require("../../models/meetingSchema");

const create = async (req, res) => {
  try {
      const {
          name,
          department,
          email,
          mobile,
          businessURL,
          callbackTime,
          employerid,
      } = req.body;

      if (!name || !department || !email || !mobile  || !callbackTime || !employerid) {
          return res.status(400).json({ message: "All fields are required" });
      }

      const newMeeting = new meetingModel({
          name,
          department,
          email,
          mobile,
          businessURL,
          callbackTime,
          employerid,
      });

      await newMeeting.save();

      res.status(200).json({
          message: "Meeting created successfully",
          meeting: newMeeting,
      });
  } catch (error) {
      res.status(500).json({ message: "Error creating meeting", error: error.stack });
  }
};

const getMeetingsByVendor = async (req, res) => {
  try {
    const { id } = req.params; 

    if (!id) {
      return res.status(400).json({ message: "employerid  is required" });
    }

    const meetings = await meetingModel.find({ employerid: id });

    if (!meetings || meetings.length === 0) {
      return res.status(404).json({ message: "No meetings found for this vendor" });
    }

    res.status(200).json({ meetings });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving meetings", error: error.stack });
  }
};

module.exports = { create, getMeetingsByVendor };
