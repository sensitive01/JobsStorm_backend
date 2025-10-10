const Event = require('../../models/calenderschema');
const mongoose = require('mongoose');

// Create Event
const createEvent = async (req, res) => {
  const { employerId, title, description, location, start, end, color } = req.body;

  if (!employerId || !title || !start || !end) {
    return res.status(400).json({ success: false, message: 'Employer ID, title, start time, and end time are required' });
  }

  if (new Date(start) >= new Date(end)) {
    return res.status(400).json({ success: false, message: 'End time must be after start time' });
  }

  try {
    const event = await Event.create({
      employerId,
      title,
      location,
      description,
      start: new Date(start),
      end: new Date(end),
      color: color || '#6C63FF',
    });

    res.status(201).json({
      success: true,
      data: {
        id: event._id,
        employerId: event.employerId,
        title: event.title,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        color: event.color,
        allDay: false,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error creating event: ${error.message}` });
  }
};

// Get All Events
const getEvents = async (req, res) => {
  const { employerId, start, end } = req.query;

  if (!employerId) {
    return res.status(400).json({ success: false, message: 'Employer ID is required' });
  }

  const query = { employerId };

  if (start && end) {
    query.start = { $gte: new Date(start) };
    query.end = { $lte: new Date(end) };
  }

  try {
    const events = await Event.find(query).sort({ start: 1 }).lean();

    res.status(200).json({
      success: true,
      count: events.length,
      data: events.map(event => ({
        id: event._id,
        title: event.title,
         location: event.location,
        description: event.description,
        start: event.start,
        end: event.end,
        color: event.color,
        allDay: false,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error fetching events: ${error.message}` });
  }
};

// Update Event
const updateEvent = async (req, res) => {
  const { id } = req.params;
  const { employerId, title, description, start, end, color } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid event ID' });
  }

  if (!employerId) {
    return res.status(400).json({ success: false, message: 'Employer ID is required' });
  }

  if (start && end && new Date(start) >= new Date(end)) {
    return res.status(400).json({ success: false, message: 'End time must be after start time' });
  }

  try {
    const event = await Event.findOneAndUpdate(
      { _id: id, employerId },
      { title, description, start: start ? new Date(start) : undefined, end: end ? new Date(end) : undefined, color },
      { new: true, runValidators: true }
    );

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.status(200).json({ success: true, data: {
      id: event._id,
      employerId: event.employerId,
      title: event.title,
      description: event.description,
      start: event.start,
      end: event.end,
      color: event.color,
      allDay: false,
    } });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error updating event: ${error.message}` });
  }
};

// Delete Event
const deleteEvent = async (req, res) => {
  const { id } = req.params;
  const { employerId } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid event ID' });
  }

  if (!employerId) {
    return res.status(400).json({ success: false, message: 'Employer ID is required' });
  }

  try {
    const event = await Event.findOneAndDelete({ _id: id, employerId });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error deleting event: ${error.message}` });
  }
};

module.exports = {
  createEvent,
  getEvents,
  updateEvent,
  deleteEvent,
};