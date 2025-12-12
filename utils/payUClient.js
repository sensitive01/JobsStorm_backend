const PayU = require('../config/lib/index.js');
const dotenv = require('dotenv');

dotenv.config();

const payuClient = PayU({
    key: process.env.PAYU_KEY || 'TEST_KEY',
    salt: process.env.PAYU_SALT || 'TEST_SALT'
});

module.exports = payuClient;
