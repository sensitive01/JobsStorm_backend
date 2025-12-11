const Order = require("../../models/orderSchema");
const Candidate = require("../../models/employeeschema");
const CandidatePlan = require("../../models/employeePlansSchema");
const crypto = require("crypto");

const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
const PAYU_SALT = process.env.PAYU_SALT;
const PAYU_BASE_URL = process.env.PAYU_BASE_URL || "https://test.payu.in";
const FRONTEND_URL = process.env.FRONTEND_URL;
const BACKEND_URL = process.env.BACKEND_URL;

/* ======================================================
    🔐 HELPER: Activate Subscription
====================================================== */
async function activateSubscription(order, candidate, plan, txnid, amount, paymentResponse) {
    const now = new Date();
    let startDate = now;

    // If user has an active subscription, extend it
    if (
        candidate.subscription?.status === "active" &&
        candidate.subscription.endDate > now
    ) {
        startDate = new Date(candidate.subscription.endDate);
    }

    // Calculate end date based on plan validity
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + (plan.validityMonths || 1));

    // Update order
    order.status = "paid";
    order.subscriptionStart = startDate;
    order.subscriptionEnd = endDate;
    order.paymentResponse = paymentResponse; // Store payment response
    await order.save();

    // Update candidate subscription
    candidate.subscription = {
        planType: order.planType,
        startDate,
        endDate,
        status: "active",
        paymentId: txnid,
        amount: Number(amount),
    };
    candidate.subscriptionActive = true;
    await candidate.save();

    console.log("✅ Subscription Activated:", {
        candidateId: candidate._id,
        planType: order.planType,
        startDate,
        endDate,
    });
}

/* ======================================================
    🚀 CREATE ORDER (Initiate Payment)
====================================================== */
exports.createOrder = async (req, res) => {
    try {
        const { amount, employeeId, planType, firstName, email, phone } = req.body;

        // Validate required fields
        if (!amount || !employeeId || !planType) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: amount, employeeId, or planType",
            });
        }

        // Verify candidate exists
        const candidate = await Candidate.findById(employeeId);
        if (!candidate) {
            return res.status(404).json({
                success: false,
                error: "Candidate not found",
            });
        }

        // Verify plan exists
        const plan = await CandidatePlan.findOne({ planId: planType });
        if (!plan) {
            return res.status(404).json({
                success: false,
                error: "Plan not found",
            });
        }

        // Generate unique transaction ID
        const txnid = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // Clean productinfo (no special characters)
        const productinfo = planType.replace(/[^a-zA-Z0-9]/g, "");

        // Format amount to 2 decimal places
        const formattedAmount = Number(amount).toFixed(2);

        // Store employeeId and planType in UDF fields
        const udf1 = employeeId;
        const udf2 = planType;

        // Create order in database
        const order = await Order.create({
            orderId: txnid,
            amount: Number(amount),
            employeeId,
            planType,
            status: "created",
            currency: "INR",
        });

        console.log("✅ Order created:", {
            orderId: order.orderId,
            employeeId,
            planType,
            amount: formattedAmount,
        });

        // Prepare callback URLs
        const surl = `${BACKEND_URL}/payment/payu/callback`;
        const furl = `${BACKEND_URL}/payment/payu/callback`;

        // ✅ CORRECT HASH FORMAT - EXACTLY 9 pipes after udf2
        // Format: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
        // After udf2: ||| (for udf3,udf4,udf5) + |||||| (6 empty fields) = 9 pipes total
        const hashString = `${PAYU_MERCHANT_KEY}|${txnid}|${formattedAmount}|${productinfo}|${firstName}|${email}|${udf1}|${udf2}|||||||||${PAYU_SALT}`;
        const hash = crypto.createHash("sha512").update(hashString).digest("hex");

        console.log("🔐 Hash String:", hashString);
        console.log("✅ Hash Generated:", hash);

        // Return payment data to frontend
        return res.json({
            success: true,
            paymentData: {
                key: PAYU_MERCHANT_KEY,
                txnid,
                amount: formattedAmount,
                productinfo,
                firstname: firstName || candidate.firstName || "User",
                email: email || candidate.email,
                phone: phone || candidate.phone || "9999999999",
                surl,
                furl,
                hash,
                service_provider: "payu_paisa",
                payuBaseUrl: PAYU_BASE_URL,
                udf1,
                udf2,
                udf3: "", // ✅ Explicitly set empty UDF fields
                udf4: "",
                udf5: "",
            },
        });
    } catch (err) {
        console.error("❌ createOrder Error:", err);
        res.status(500).json({
            success: false,
            error: err.message,
        });
    }
};
/* ======================================================
    🚀 UNIFIED PAYU CALLBACK (Success + Failure)
====================================================== */
exports.handlePayUCallback = async (req, res) => {
    try {
        const posted = req.body;
        console.log("📥 PayU Callback Received:", {
            txnid: posted.txnid,
            status: posted.status,
            amount: posted.amount,
            mihpayid: posted.mihpayid,
        });

        // ✅ CORRECT REVERSE HASH - Format: SALT|status|||||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
        // After status: ||||||||| (9 pipes for 6 empty fields + udf5,udf4,udf3)
        const reverseHashStr = `${PAYU_SALT}|${posted.status}|||||||||${posted.udf5 || ""}|${posted.udf4 || ""}|${posted.udf3 || ""}|${posted.udf2}|${posted.udf1}|${posted.email}|${posted.firstname}|${posted.productinfo}|${posted.amount}|${posted.txnid}|${PAYU_MERCHANT_KEY}`;
        const calcHash = crypto.createHash("sha512").update(reverseHashStr).digest("hex");

        console.log("🔐 Reverse Hash String:", reverseHashStr);
        console.log("🔐 Calculated Hash:", calcHash);
        console.log("🔐 Received Hash:", posted.hash);

        // Verify hash
        if (calcHash !== posted.hash) {
            console.error("❌ HASH MISMATCH");
            return res.redirect(
                `${FRONTEND_URL}/price-page?status=failed&txnid=${posted.txnid}&error=hash_verification_failed`
            );
        }

        console.log("✅ Hash verified successfully");

        // Find order
        const order = await Order.findOne({ orderId: posted.txnid });
        if (!order) {
            console.error("❌ Order not found for txnid:", posted.txnid);
            return res.redirect(
                `${FRONTEND_URL}/price-page?status=error&txnid=${posted.txnid}&error=order_not_found`
            );
        }

        // Handle based on payment status
        if (posted.status === "success") {
            const candidate = await Candidate.findById(order.employeeId);
            const plan = await CandidatePlan.findOne({ planId: order.planType });

            if (!candidate || !plan) {
                return res.redirect(
                    `${FRONTEND_URL}/price-page?status=error&txnid=${posted.txnid}&error=data_not_found`
                );
            }

            // Activate subscription
            await activateSubscription(
                order,
                candidate,
                plan,
                posted.txnid,
                posted.amount,
                {
                    mihpayid: posted.mihpayid,
                    mode: posted.mode,
                    status: posted.status,
                }
            );

            console.log("✅ Payment successful - Redirecting to frontend");
            return res.redirect(
                `${FRONTEND_URL}/price-page?status=success&txnid=${posted.txnid}`
            );
        } else if (posted.status === "failure" || posted.status === "failed") {
            order.status = "failed";
            await order.save();

            console.log("❌ Payment failed");
            return res.redirect(
                `${FRONTEND_URL}/price-page?status=failed&txnid=${posted.txnid}`
            );
        } else {
            console.log("⚠️ Unknown payment status:", posted.status);
            return res.redirect(
                `${FRONTEND_URL}/price-page?status=error&txnid=${posted.txnid}`
            );
        }
    } catch (err) {
        console.error("❌ PayU Callback Error:", err);
        const txnid = req.body?.txnid || "unknown";
        return res.redirect(
            `${FRONTEND_URL}/price-page?status=error&txnid=${txnid}`
        );
    }
};
/* ======================================================
    📊 GET USER SUBSCRIPTION (Optional - for dashboard)
====================================================== */
exports.getUserSubscription = async (req, res) => {
    try {
        const { employeeId } = req.params;

        const candidate = await Candidate.findById(employeeId);
        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: "Candidate not found",
            });
        }

        if (!candidate.subscription || candidate.subscription.status !== "active") {
            return res.status(404).json({
                success: false,
                message: "No active subscription found",
            });
        }

        res.status(200).json({
            success: true,
            subscription: candidate.subscription,
        });
    } catch (error) {
        console.error("Error fetching subscription:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch subscription",
            error: error.message,
        });
    }
};


// Add this route to handle the PayU test page redirect
exports.handlePayURedirect = async (req, res) => {
    try {
        const { txnRefId, status, txnAmount } = req.query;

        console.log("📥 PayU Test Page Redirect:", req.query);

        // Find the order
        const order = await Order.findOne({ orderId: txnRefId });

        if (!order) {
            return res.redirect(`${FRONTEND_URL}/price-page?status=error&txnid=${txnRefId}`);
        }

        // Handle based on status code
        if (status === "000") { // Success in test mode
            const candidate = await Candidate.findById(order.employeeId);
            const plan = await CandidatePlan.findOne({ planId: order.planType });

            if (candidate && plan) {
                await activateSubscription(order, candidate, plan, txnRefId, txnAmount, {});
            }

            return res.redirect(`${FRONTEND_URL}/price-page?status=success&txnid=${txnRefId}`);
        } else {
            order.status = "failed";
            await order.save();
            return res.redirect(`${FRONTEND_URL}/price-page?status=failed&txnid=${txnRefId}`);
        }
    } catch (err) {
        console.error("❌ Redirect Handler Error:", err);
        return res.redirect(`${FRONTEND_URL}/price-page?status=error`);
    }
};