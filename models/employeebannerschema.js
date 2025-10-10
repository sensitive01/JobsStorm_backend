const mongoose = require("mongoose");

const employeebannerSchema = new mongoose.Schema({
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

module.exports = mongoose.model("employeebanner", employeebannerSchema);