const OrganizedEvent = require('../../models/events');

// Create a new event
exports.createsEvent = async (req, res) => {
  try {
    console.log('---- Create Event Hit ----');
    console.log('Params:', req.params);
    console.log('Body:', req.body);
    console.log('File:', req.file); // Will include `path` and `secure_url`

    const { organizerId } = req.params;
    const {
      title,
      description,
      category,
      eventDate,
      startTime,
      endTime,
      venue,
      totalattendes,
      eventendDate,
      entryfee,
      coordinator
    } = req.body;

    const bannerImage = req.file?.path || null; // Cloudinary returns URL in `path`

    const event = new OrganizedEvent({
      organizerId,
      title,
      description,
      category,
      eventDate,
      startTime,
      endTime,
      venue,
      coordinator,
      bannerImage,
      totalattendes,
      entryfee,
      eventendDate
    });

    await event.save();
    console.log('✅ Event saved successfully');
    res.status(201).json(event);
  } catch (error) {
    console.error('❌ Error in createEvent:', error);
    res.status(400).json({ message: error.message });
  }
};


// Get all events for an organizer
exports.getOrganizerEvents = async (req, res) => {
  try {
    const { organizerId } = req.params;
    const events = await OrganizedEvent.find({ organizerId }).sort({ eventDate: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Get all events (no organizerId required)
exports.getAllEvents = async (req, res) => {
  try {
    const event = await OrganizedEvent.find().sort({ eventDate: 1 });
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get single event details
exports.getEventDetails = async (req, res) => {
  try {
    const event = await OrganizedEvent.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update an event
exports.updateEvent = async (req, res) => {
  try {
    const updated = await OrganizedEvent.findByIdAndUpdate(
      req.params.eventId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete an event
exports.deleteEvent = async (req, res) => {
  try {
    const event = await OrganizedEvent.findByIdAndDelete(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Register in an event
exports.registerInEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      participantId,
      participantName,
      contactEmail,
      contactPhone,
      resumeLink,
      status,
      profileImage
    } = req.body;

    const event = await OrganizedEvent.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Fix: Check if participantId exists before calling .toString()
    const already = event.registrations.find(
      (r) => r.participantId && r.participantId.toString() === participantId
    );

    if (already) {
      return res.status(400).json({ message: 'Already registered for this event' });
    }

    // Add new registration
    event.registrations.push({
      participantId,
      participantName,
      contactEmail,
      contactPhone,
      status,
      resumeLink,
      profileImage
    });

    event.totalRegistrations = event.registrations.length;
    await event.save();

    res.status(201).json({ message: 'Registered successfully', event });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


// Get event registrations
exports.getEventRegistrations = async (req, res) => {
  try {
    const event = await OrganizedEvent.findById(req.params.eventId)
      .select('title eventDate venue registrations');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({
      event: {
        title: event.title,
        eventDate: event.eventDate,
        venue: event.venue
      },
      registrations: event.registrations
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update registration status
exports.updateRegistrationStatus = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const { registrationStatus } = req.body;

    if (!['Pending', 'Approved', 'Rejected'].includes(registrationStatus)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const event = await OrganizedEvent.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const registration = event.registrations.id(registrationId);
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    registration.registrationStatus = registrationStatus;
    await event.save();

    res.json(registration);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
exports.updateRegistrationStatus = async (req, res) => {
  try {
    const { eventId, participantId } = req.params;
    const { status } = req.body;

    const event = await OrganizedEvent.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const registration = event.registrations.find(
      (r) => r.participantId.toString() === participantId
    );

    if (!registration) {
      return res.status(404).json({ message: 'Participant not registered for this event' });
    }

    registration.status = status;

    await event.save();
    res.status(200).json({ message: 'Status updated successfully', registration });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Check registration status for a participant in an event
exports.checkRegistrationStatus = async (req, res) => {
  try {
    const { eventId, participantId } = req.params;

    const event = await OrganizedEvent.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if participant is registered
const isRegistered = event.registrations.some(
  (r) => r.participantId && r.participantId.toString() === participantId
);


    res.json({ isRegistered });
  } catch (error) {
    console.error('❌ Error in checkRegistrationStatus:', error);
    res.status(500).json({ message: error.message });
  }
};