const Order = require('../../models/orderSchema');
const Candidate = require('../../models/employeeschema');
const CandidatePlan = require('../../models/employeePlansSchema');
const PayU = require('payu-websdk'); // Official PayU SDK

/* =========================================
   CONFIGURATION
========================================= */
const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
const PAYU_SALT = process.env.PAYU_SALT;

// TEST URL = https://test.payu.in
// PROD URL = https://secure.payu.in
const PAYU_BASE_URL = process.env.PAYU_BASE_URL || "https://test.payu.in";

const FRONTEND_URL = process.env.FRONTEND_URL;   // example: http://localhost:5173
const BACKEND_URL = process.env.BACKEND_URL;     // example: http://localhost:4000

// Determine Environment for SDK
const payuEnv = PAYU_BASE_URL.includes('test') ? "TEST" : "PROD";

// Initialize PayU SDK
const payuClient = new PayU({
    key: PAYU_MERCHANT_KEY,
    salt: PAYU_SALT
}, payuEnv);

console.log(`🔧 PayU SDK Initialized in ${payuEnv} mode`);

/* =========================================
   HELPER: Activate Subscription
========================================= */

async function activateSubscription(order, candidate, plan, txnid, amount) {
    const now = new Date();
    let startDate = now;

    if (
        candidate.subscription?.status === "active" &&
        candidate.subscription.endDate > now
    ) {
        startDate = new Date(candidate.subscription.endDate);
    }

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + (plan.validityMonths || 1));

    order.status = 'paid';
    order.subscriptionStart = startDate;
    order.subscriptionEnd = endDate;
    order.verifiedAt = new Date();
    await order.save();

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
        candidateId: candidate._id,
        plan: order.planType,
        startDate,
        endDate
    });
}

/* =========================================
   CREATE ORDER
   Route: POST /payment/order/create
========================================= */
exports.createOrder = async (req, res) => {
    const { amount, employeeId, planType, firstName, email, phone } = req.body;

    console.log("\n==============================");
    console.log("📥 CREATE ORDER REQUEST RECEIVED");
    console.log("==============================");

    if (!amount || !employeeId || !planType) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields (amount, employeeId, planType)"
        });
    }

    try {
        const txnid = `TXN${Date.now()}`;
        const amountNumber = Number(amount).toFixed(2);
        const productInfo = planType.replace(/[^a-zA-Z0-9]/g, '');

        const newOrder = new Order({
            orderId: txnid,
            amount: Number(amount),
            currency: 'INR',
            status: 'created',
            employeeId,
            planType,
            type: 'candidate_subscription',
            createdAt: new Date()
        });

        await newOrder.save();
        console.log(`🆗 Order saved: ${txnid}`);

        // PAYU HASH PARAMETERS
        const hashParams = {
            txnid,
            amount: amountNumber,
            productinfo: productInfo,
            firstname: firstName || 'User',
            email: email || '',
            udf1: '', udf2: '', udf3: '', udf4: '', udf5: ''
        };

        const hash = payuClient.hasher.generatePaymentHash(hashParams);
        console.log("🔐 Hash generated");

        /* ------------------------------
           🚨 IMPORTANT FIX:
           Test mode cannot POST to localhost backend
           So redirect ALWAYS to frontend
        ------------------------------- */

        const surl = `${FRONTEND_URL}/price-page?status=success&txnid=${txnid}`;
        const furl = `${FRONTEND_URL}/price-page?status=failure&txnid=${txnid}`;

        console.log("🎯 Using Frontend Redirect URLs:");
        console.log("surl:", surl);
        console.log("furl:", furl);

        const paymentData = {
            key: PAYU_MERCHANT_KEY,
            ...hashParams,
            phone: phone || '',
            surl,
            furl,
            hash,
            service_provider: 'payu_paisa',
            payuBaseUrl: PAYU_BASE_URL
        };

        res.status(200).json({
            success: true,
            order: { id: txnid, amount: amountNumber },
            paymentData
        });

    } catch (err) {
        console.error("❌ Order Creation Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

/* =========================================
   VERIFY PAYMENT  
   Route: POST /payment/order/verify/:id
   (Called from FRONTEND only)
========================================= */
exports.verifyPayment = async (req, res) => {
    try {
        console.log("\n==============================");
        console.log("📥 VERIFY PAYMENT REQUEST RECEIVED");
        console.log("==============================");

        const { txnid, status, amount, mihpayid } = req.body;
        console.log("Callback Data:", req.body);

        const order = await Order.findOne({ orderId: txnid });

        if (!order) {
            console.log("❌ Order not found");
            return res.status(400).json({ success: false, error: "Order not found" });
        }

        // No hash validation here because PayU didn’t POST to backend.
        // React triggers verification, then backend updates DB.

        if (status !== "success") {
            order.status = "failed";
            await order.save();
            return res.json({ success: false, message: "Payment failed" });
        }

        const candidate = await Candidate.findById(order.employeeId);
        const plan = await CandidatePlan.findOne({ planId: order.planType });

        if (!candidate || !plan) {
            return res.status(400).json({ success: false, error: "Candidate or Plan not found" });
        }

        await activateSubscription(order, candidate, plan, txnid, amount);

        return res.json({ success: true, message: "Payment verified & subscription activated" });

    } catch (err) {
        console.error("❌ Verification Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};
