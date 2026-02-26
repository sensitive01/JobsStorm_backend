const Notification = require('../models/notificationSchema');

const getNotifications = async (req, res) => {
    try {
        const { userId } = req.params;
        const notifications = await Notification.find({
            recipientId: userId,
            isRead: false
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: notifications
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const notification = await Notification.findByIdAndUpdate(
            notificationId,
            { isRead: true, readAt: Date.now() },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Notification marked as read'
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

const createNotification = async (data) => {
    try {
        const newNotification = new Notification(data);
        await newNotification.save();
        return newNotification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    createNotification
};
