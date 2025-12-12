require("dotenv").config();

module.exports = {
    PORT: process.env.PORT || 4001,
    MONGO_USERNAME_JOB: process.env.MONGO_USERNAME_JOB,
    MONGO_PASSWORD_JOB: process.env.MONGO_PASSWORD_JOB,
    MONGO_DATABASE_NAME_JOB: process.env.MONGO_DATABASE_NAME_JOB,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    PAYU_MERCHANT_KEY: process.env.PAYU_MERCHANT_KEY,
    PAYU_SALT: process.env.PAYU_SALT,
    PAYU_BASE_URL: process.env.PAYU_BASE_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    BACKEND_URL: process.env.BACKEND_URL
};