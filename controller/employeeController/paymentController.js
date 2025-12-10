const Order = require('../../models/orderSchema');
const crypto = require('crypto');
const Candidate = require('../../models/employeeschema');
const CandidatePlan = require('../../models/employeePlansSchema');

// PayU Configuration
const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
const PAYU_SALT = process.env.PAYU_SALT;
const PAYU_BASE_URL = process.env.PAYU_BASE_URL;

/**
 * Generate PayU payment hash
 */
function generatePayUHash(params) {
    const hashString = [
        params.key,
        params.txnid,
        params.amount,
        params.productinfo,
        params.firstname,
        params.email,
        params.udf1 || '',
        params.udf2 || '',
        params.udf3 || '',
        params.udf4 || '',
        params.udf5 || '',
        '', '', '', '', '',
    ].join('|') + '|' + PAYU_SALT;

    return crypto.createHash('sha512').update(hashString).digest('hex');
}

/**
 * NEW: Handle POST response from PayU and redirect to Frontend
 * Route: POST /payment/payu-response
 */
exports.handlePayUResponse = (req, res) => {
    try {
        console.log("📥 Received PayU POST Response:", req.body);

        // 1. Extract data from PayU's POST request
        const { txnid, status, hash, amount, productinfo, firstname, email, errorMessage } = req.body;

        // 2. Construct Query Params for Frontend
        // We pass these back to the React app so it can call verifyPayment
        const queryParams = new URLSearchParams({
            txnid,
            status,
            amount,
            productinfo,
            firstname,
            email,
            hash,
            errorMessage: errorMessage || ''
        }).toString();

        // 3. Redirect to Frontend (Port 5173)
        // This converts the POST to a GET request for the React app
        const frontendUrl = `${process.env.FRONTEND_URL}/price-page`;
        res.redirect(`${frontendUrl}?${queryParams}`);

    } catch (error) {
        console.error("❌ Error in PayU redirect:", error);
        res.redirect(`${process.env.FRONTEND_URL}/price-page?status=failure`);
    }
};

/**
 * Create order for Candidate subscription
 * Route: POST /payment/order/create
 */
exports.createOrder = async (req, res) => {
    const { amount, employeeId, planType, firstName, email, phone } = req.body;
    const candidateId = employeeId;

    console.log('📥 Received Candidate Order:', { amount, candidateId, planType });

    if (!amount || !candidateId || !planType) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        const txnid = `TXN${Date.now()}${candidateId.substring(0, 5)}`;
        const productInfo = `${planType} Subscription`;
        const amountNumber = Number(amount).toFixed(2);

        const newOrder = new Order({
            orderId: txnid,
            amount: Number(amount),
            currency: 'INR',
            status: 'created',
            employeeId: candidateId,
            planType,
            type: 'candidate_subscription',
            createdAt: new Date(),
        });

        await newOrder.save();

        const hashParams = {
            key: PAYU_MERCHANT_KEY,
            txnid: txnid,
            amount: amountNumber,
            productinfo: productInfo,
            firstname: firstName || 'User',
            email: email || '',
        };

        const hash = generatePayUHash(hashParams);

        // Backend URL (for surl/furl)
        // This must match the route you defined in your backend router
        const backendUrl = process.env.BACKEND_URL;
        console.log('Backend URL:', backendUrl);

        res.status(200).json({
            success: true,
            order: { id: txnid, amount: amountNumber },
            paymentData: {
                key: PAYU_MERCHANT_KEY,
                txnid: txnid,
                amount: amountNumber,
                productinfo: productInfo,
                firstname: firstName || 'User',
                email: email || '',
                phone: phone || '',
                // UPDATED: Point to BACKEND for the initial POST response
                surl: `${backendUrl}/payment/payu-response`,
                furl: `${backendUrl}/payment/payu-response`,
                hash: hash,
                service_provider: 'payu_paisa',
                payuBaseUrl: PAYU_BASE_URL,
            },
        });
    } catch (error) {
        console.error('❌ Error creating order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Verify PayU payment hash
 */
function verifyPayUHash(params, receivedHash) {
    const hashString = [
        params.status,
        params.udf5 || '',
        params.udf4 || '',
        params.udf3 || '',
        params.udf2 || '',
        params.udf1 || '',
        params.email,
        params.firstname,
        params.productinfo,
        params.amount,
        params.txnid,
        params.key
    ].join('|') + '|' + PAYU_SALT;

    return crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase() === receivedHash.toLowerCase();
}

/**
 * Verify payment and activate subscription
 * Route: POST /payment/order/verify
 */
exports.verifyPayment = async (req, res) => {
    const { txnid, status, hash, amount, productinfo, firstname, email, employeeId, planType } = req.body;
    const candidateId = employeeId;

    console.log('📥 Verifying Payment:', { txnid, status });

    try {
        if (hash) {
            const hashParams = {
                status, key: PAYU_MERCHANT_KEY, txnid, amount, productinfo, firstname, email,
                udf1: '', udf2: '', udf3: '', udf4: '', udf5: ''
            };
            if (!verifyPayUHash(hashParams, hash)) {
                console.warn('⚠️ Hash Mismatch!');
            }
        }

        const order = await Order.findOne({ orderId: txnid });
        if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

        if (status !== 'success') {
            order.status = 'failed';
            await order.save();
            return res.status(400).json({ success: false, error: 'Payment failed' });
        }

        const candidate = await Candidate.findById(candidateId);
        if (!candidate) return res.status(404).json({ success: false, error: 'Candidate not found' });

        const plan = await CandidatePlan.findOne({ planId: planType });

        const currentDate = new Date();
        const validityMonths = plan?.validityMonths || 1;

        let startDate = currentDate;
        if (candidate.subscription?.status === "active" && candidate.subscription.endDate > currentDate) {
            startDate = new Date(candidate.subscription.endDate);
        }

        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + validityMonths);

        order.status = 'paid';
        order.subscriptionStart = startDate;
        order.subscriptionEnd = endDate;
        await order.save();

        const cardNumber = "45" + Math.floor(Math.random() * 10000000000);

        candidate.subscription = {
            planType,
            startDate,
            endDate,
            status: "active",
            cardNumber,
            paymentId: txnid,
            amount: Number(amount)
        };
        candidate.subscriptionActive = true;

        await candidate.save();
        console.log('✅ Candidate Subscription Activated');

        return res.status(200).json({ success: true, message: 'Activated' });

    } catch (error) {
        console.error('❌ Verification Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};