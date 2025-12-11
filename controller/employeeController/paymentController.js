const Order = require('../../models/orderSchema');
const Candidate = require('../../models/employeeschema');
const CandidatePlan = require('../../models/employeePlansSchema');
const PayU = require('payu-websdk'); // Official PayU SDK

/* =========================================
   CONFIGURATION
   ========================================= */
const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
const PAYU_SALT = process.env.PAYU_SALT;
const PAYU_BASE_URL = process.env.PAYU_BASE_URL || "https://test.payu.in";
const FRONTEND_URL = process.env.FRONTEND_URL;
const BACKEND_URL = process.env.BACKEND_URL;

// Determine Environment for SDK
const payuEnv = (PAYU_BASE_URL && PAYU_BASE_URL.indexOf('test') !== -1) ? "TEST" : "PROD";

// Initialize SDK
const payuClient = new PayU({
    key: PAYU_MERCHANT_KEY,
    salt: PAYU_SALT
}, payuEnv);

console.log(`🔧 PayU SDK Initialized in ${payuEnv} mode`);

/* =========================================
   HELPER FUNCTIONS
   ========================================= */

/**
 * Activate subscription logic
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
    // Assuming plan.validityMonths is available in the plan model
    endDate.setMonth(endDate.getMonth() + (plan.validityMonths || 1));

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

    console.log("✅ Subscription Activated Details:", {
        candidateId: candidate._id,
        plan: order.planType,
        startDate,
        endDate
    });
}

/* =========================================
   CONTROLLER FUNCTIONS
   ========================================= */

/**
 * Create order and generate Hash using SDK
 * Route: POST /payment/order/create
 */
exports.createOrder = async (req, res) => {
    const { amount, employeeId, planType, firstName, email, phone } = req.body;

    console.log('\n' + '='.repeat(60));
    console.log('📥 SDK CREATE ORDER REQUEST');
    console.log('='.repeat(60));

    if (!amount || !employeeId || !planType) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields (amount, employeeId, planType)'
        });
    }

    try {
        // 1. Prepare Data
        const txnid = `TXN${Date.now()}`; // Unique Transaction ID
        const amountNumber = Number(amount).toFixed(2);
        // Clean product info to avoid hash mismatches (remove special chars)
        const productInfo = planType.replace(/[^a-zA-Z0-9]/g, '');

        // 2. Save Order to DB
        const newOrder = new Order({
            orderId: txnid,
            amount: Number(amount),
            currency: 'INR',
            status: 'created',
            employeeId: employeeId,
            planType: planType, // Original Plan Name
            type: 'candidate_subscription',
            createdAt: new Date(),
        });
        await newOrder.save();
        console.log(`✅ Order saved: ${txnid}`);

        // 3. Generate Hash using PayU SDK
        // Define standard hash parameters expected by PayU
        const hashParams = {
            txnid: txnid,
            amount: amountNumber,
            productinfo: productInfo,
            firstname: firstName || 'User',
            email: email || '',
            udf1: '', udf2: '', udf3: '', udf4: '', udf5: ''
        };

        console.log('🗝️ SDK Generating Hash for:', hashParams);
        const hash = payuClient.hasher.generatePaymentHash(hashParams);
        console.log('🔐 Hash Generated:', hash);

        // 4. Construct Response for Frontend
        const surl = `${FRONTEND_URL}/price-page?status=success&txnid=${txnid}`;
        const furl = `${FRONTEND_URL}/price-page?status=failure&txnid=${txnid}`;


        const paymentData = {
            key: PAYU_MERCHANT_KEY,
            ...hashParams,      // includes txnid, amount, productinfo, firstname, email, udfs
            phone: phone || '', // Phone is form field, but not in hash
            surl: surl,
            furl: furl,
            hash: hash,
            service_provider: 'payu_paisa',
            payuBaseUrl: PAYU_BASE_URL
        };

        res.status(200).json({
            success: true,
            order: { id: txnid, amount: amountNumber },
            paymentData: paymentData
        });

    } catch (error) {
        console.error('\n❌ Error creating order:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Verify Payment Response (Callback)
 * Route: POST /payment/order/verify/:id
 */
exports.verifyPayment = async (req, res) => {
    try {
        console.log('\n' + '='.repeat(60));
        console.log("📥 PAYU CALLBACK RECEIVED (SDK Verification)");
        console.log('='.repeat(60));

        const { txnid, status, amount, mihpayid } = req.body;
        console.log('💳 Callback Details:', { txnid, status, amount, mihpayid });

        // 1. Find order
        const order = await Order.findOne({ orderId: txnid });
        if (!order) {
            console.error('❌ Order not found:', txnid);
            return res.redirect(`${FRONTEND_URL}/price-page?status=failure&error=order_not_found`);
        }

        // 2. Validate Hash using SDK
        // req.body contains the full POST data from PayU
        const isValidHash = payuClient.hasher.validateResponseHash(req.body);

        if (!isValidHash) {
            console.error("❌ CRITICAL: PayU SDK Hash Verification Failed! Potential Tampering.");
            // In strict mode, we should fail the payment.
            // For now, we allow debugging or redirection to failure.
            return res.redirect(`${FRONTEND_URL}/price-page?status=failure&error=hash_mismatch`);
        } else {
            console.log("✅ SDK Hash Verification Passed");
        }

        // 3. Check Payment Status
        if (status !== 'success') {
            console.log('❌ Payment failed status from gateway:', status);
            order.status = 'failed';
            await order.save();
            return res.redirect(`${FRONTEND_URL}/price-page?status=failure&txnid=${txnid}`);
        }

        // 4. Activate Subscription
        console.log('✅ Payment successful, activating subscription...');
        const candidate = await Candidate.findById(order.employeeId);
        const plan = await CandidatePlan.findOne({ planId: order.planType });

        if (!candidate || !plan) {
            console.error('❌ Candidate or Plan not found');
            return res.redirect(`${FRONTEND_URL}/price-page?status=failure&error=data_not_found`);
        }

        await activateSubscription(order, candidate, plan, txnid, amount);

        // 5. Redirect to Success
        console.log('🔄 Redirecting to success page...');
        res.redirect(`${FRONTEND_URL}/price-page?status=success&txnid=${txnid}&plan=${order.planType}`);

    } catch (err) {
        console.error('\n❌ Payment Verification Error:', err);
        res.redirect(`${FRONTEND_URL}/price-page?status=failure&error=${encodeURIComponent(err.message)}`);
    }
};