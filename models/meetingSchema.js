const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema({
    name: {
        type: String
    },
    department: {
        type: String
    },
    email: {
        type: String
    },
    mobile: {
        type: String
    },
    businessURL: {
        type: String
    },
    callbackTime: {
        type: String
    },
    employerid:{
        type: String
    }
});

module.exports = mongoose.model("Meeting", meetingSchema);
