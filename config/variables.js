require("dotenv").config();

module.exports = {
    PORT: process.env.PORT || 3002,
    MONGO_USERNAME_JOB: process.env.MONGO_USERNAME_JOB,
    MONGO_PASSWORD_JOB: process.env.MONGO_PASSWORD_JOB,
    MONGO_DATABASE_NAME_JOB: process.env.MONGO_DATABASE_NAME_JOB,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET
};