const Order = require('../../models/orderSchema');
const crypto = require('crypto');
const Candidate = require('../../models/employeeschema');
const CandidatePlan = require('../../models/employeePlansSchema');

// PayU Configuration
const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
const PAYU_SALT = process.env.PAYU_SALT;
const PAYU_BASE_URL = process.env.PAYU_BASE_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;
const BACKEND_URL = process.env.BACKEND_URL;

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
 * Verify PayU payment hash (for response validation)
 */
function verifyPayUHash(params, receivedHash) {
    const hashString = [
        PAYU_SALT,
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
    ].join('|');

    const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');

    console.log('🔐 Hash Verification:');
    console.log('Received Hash:', receivedHash);
    console.log('Calculated Hash:', calculatedHash);

    return calculatedHash.toLowerCase() === receivedHash.toLowerCase();
}

/**
 * Activate subscription after successful payment
 */
async function activateSubscription(order, candidate, plan, txnid, amount) {
    const now = new Date();
    let startDate = now;

    // If user has active subscription, extend it
    if (
        candidate.subscription?.status === "active" &&
        candidate.subscription.endDate > now
    ) {
        startDate = new Date(candidate.subscription.endDate);
    }

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.validityMonths);

    // Update order
    order.status = 'paid';
    order.subscriptionStart = startDate;
    order.subscriptionEnd = endDate;
    order.verifiedAt = new Date();
    await order.save();

    // Update candidate subscription
    candidate.subscription = {
        planType: order.planType,
        startDate,
        endDate,
        status: "active",
        cardNumber: "45" + Math.floor(1e9 + Math.random() * 9e9),
        paymentId: txnid,
        amount: Number(amount)
    };
    candidate.subscriptionActive = true;
    await candidate.save();

    console.log("✅ Subscription Activated:", {
        candidate: candidate._id,
        plan: order.planType,
        startDate,
        endDate
    });
}

/**
 * Create order for Candidate subscription
 * Route: POST /payment/order/create
 */
exports.createOrder = async (req, res) => {
    const { amount, employeeId, planType, firstName, email, phone } = req.body;

    console.log('📥 Create Order Request:', { amount, employeeId, planType });

    if (!amount || !employeeId || !planType) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields (amount, employeeId, planType)'
        });
    }

    try {
        // Generate unique transaction ID
        const txnid = `TXN${Date.now()}${employeeId.substring(0, 5)}`;
        const productInfo = `${planType} Subscription`;
        const amountNumber = Number(amount).toFixed(2);

        // Create order in database
        const newOrder = new Order({
            orderId: txnid,
            amount: Number(amount),
            currency: 'INR',
            status: 'created',
            employeeId: employeeId,
            planType,
            type: 'candidate_subscription',
            createdAt: new Date(),
        });

        await newOrder.save();
        console.log('✅ Order created:', txnid);

        // Prepare hash parameters
        const hashParams = {
            key: PAYU_MERCHANT_KEY,
            txnid: txnid,
            amount: amountNumber,
            productinfo: productInfo,
            firstname: firstName || 'User',
            email: email || '',
        };

        // Generate payment hash
        const hash = generatePayUHash(hashParams);

        // ✅ IMPORTANT: surl and furl must point to BACKEND
        const surl = `${BACKEND_URL}/payment/order/verify`;
        const furl = `${BACKEND_URL}/payment/order/verify`;

        console.log('🔗 Callback URLs:', { surl, furl });

        res.status(200).json({
            success: true,
            order: {
                id: txnid,
                amount: amountNumber
            },
            paymentData: {
                key: PAYU_MERCHANT_KEY,
                txnid: txnid,
                amount: amountNumber,
                productinfo: productInfo,
                firstname: firstName || 'User',
                email: email || '',
                phone: phone || '',
                surl: surl,  // Backend URL
                furl: furl,  // Backend URL
                hash: hash,
                service_provider: 'payu_paisa',
                payuBaseUrl: PAYU_BASE_URL,
            },
        });
    } catch (error) {
        console.error('❌ Error creating order:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Handle PayU response and redirect to frontend
 * Route: POST /payment/order/verify
 * This endpoint receives POST data from PayU
 */
exports.verifyPayment = async (req, res) => {
    try {
        console.log("📥 PayU Response Received:", req.body);

        const {
            txnid,
            status,
            hash,
            amount,
            productinfo,
            firstname,
            email,
            mihpayid,
            field1,
            field2,
            field3,
            field4,
            field5,
            field6,
            field7,
            field8,
            field9,
        } = req.body;

        // 1️⃣ Find order
        const order = await Order.findOne({ orderId: txnid });
        if (!order) {
            console.error('❌ Order not found:', txnid);
            return res.redirect(`${FRONTEND_URL}/price-page?status=failure&error=order_not_found`);
        }

        console.log('📦 Order found:', order._id);

        // 2️⃣ Verify hash
        const hashParams = {
            key: PAYU_MERCHANT_KEY,
            txnid,
            amount,
            productinfo,
            firstname,
            email,
            status,
            udf1: field1 || '',
            udf2: field2 || '',
            udf3: field3 || '',
            udf4: field4 || '',
            udf5: field5 || ''
        };

        const isValidHash = verifyPayUHash(hashParams, hash);

        if (!isValidHash) {
            console.warn("⚠️ Invalid PayU hash - possible tampering");
            // Still proceed but log the warning
        }

        // 3️⃣ Check payment status
        if (status !== 'success') {
            console.log('❌ Payment failed:', status);
            order.status = 'failed';
            await order.save();
            return res.redirect(`${FRONTEND_URL}/price-page?status=failure&txnid=${txnid}`);
        }

        // 4️⃣ Activate subscription
        const candidate = await Candidate.findById(order.employeeId);
        if (!candidate) {
            console.error('❌ Candidate not found:', order.employeeId);
            return res.redirect(`${FRONTEND_URL}/price-page?status=failure&error=candidate_not_found`);
        }

        const plan = await CandidatePlan.findOne({ planId: order.planType });
        if (!plan) {
            console.error('❌ Plan not found:', order.planType);
            return res.redirect(`${FRONTEND_URL}/price-page?status=failure&error=plan_not_found`);
        }

        // Activate the subscription
        await activateSubscription(order, candidate, plan, txnid, amount);

        console.log("✅ Payment Successful & Subscription Activated");

        // 5️⃣ Redirect to frontend with success
        res.redirect(
            `${FRONTEND_URL}/price-page?status=success&txnid=${txnid}&plan=${order.planType}`
        );

    } catch (err) {
        console.error("❌ Payment Verification Error:", err);
        res.redirect(`${FRONTEND_URL}/price-page?status=failure&error=${encodeURIComponent(err.message)}`);
    }
};