const mongoose = require("mongoose");

const eventbannerSchema = new mongoose.Schema({
    id: {
        type: String,
    },
    name: {
        type: String,
    },
    page: {
        type: String,
    },
    image: {
        type: String,
    }
})

module.exports = mongoose.model("eventsbanner", eventbannerSchema);