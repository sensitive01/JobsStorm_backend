const Order = require("../../models/orderSchema");
const Candidate = require("../../models/employeeschema");
const CandidatePlan = require("../../models/employeePlansSchema");
const crypto = require("crypto");

const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
const PAYU_SALT = process.env.PAYU_SALT;
const PAYU_BASE_URL = process.env.PAYU_BASE_URL || "https://test.payu.in";
const FRONTEND_URL = process.env.FRONTEND_URL;
const BACKEND_URL = process.env.BACKEND_URL;

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

    order.status = "paid";
    order.subscriptionStart = startDate;
    order.subscriptionEnd = endDate;
    await order.save();

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

    console.log("Subscription Activated:", candidate._id);
}

exports.createOrder = async (req, res) => {
    try {
        const { amount, employeeId, planType, firstName, email, phone } = req.body;
        if (!amount || !employeeId || !planType) {
            return res.status(400).json({ success: false, error: "Missing required fields" });
        }
        const txnid = `TXN${Date.now()}`;
        const productinfo = planType.replace(/[^a-zA-Z0-9]/g, "");
        const udf1 = "123456";

        await Order.create({
            orderId: txnid,
            amount,
            employeeId,
            planType,
            status: "created",
            currency: "INR",
        });

        const surl = `${BACKEND_URL}/payment/payu/success`;
        const furl = `${BACKEND_URL}/payment/payu/failure`;

        const hashString = `${PAYU_MERCHANT_KEY}|${txnid}|${amount}|${productinfo}|${firstName}|${email}|${udf1}||||||||||${PAYU_SALT}`;
        const hash = crypto.createHash("sha512").update(hashString).digest("hex");

        return res.json({
            success: true,
            paymentData: {
                key: PAYU_MERCHANT_KEY,
                txnid,
                amount,
                productinfo,
                firstname: firstName,
                email,
                phone,
                surl,
                furl,
                hash,
                service_provider: "payu_paisa",
                payuBaseUrl: PAYU_BASE_URL,
                udf1: udf1,
            },
        });
    } catch (err) {
        console.error("createOrder Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.handlePayUSuccess = async (req, res) => {
    try {
        const posted = req.body;
        console.log("PayU Success Callback Received:", posted);

        const reverseHashStr = `${PAYU_SALT}|${posted.status}||||||||||${posted.udf1}|${posted.email}|${posted.firstname}|${posted.productinfo}|${posted.amount}|${posted.txnid}|${PAYU_MERCHANT_KEY}`;
        const calcHash = crypto.createHash("sha512").update(reverseHashStr).digest("hex");

        if (calcHash !== posted.hash) {
            console.log("HASH MISMATCH");
            console.log("Calculated:", calcHash);
            console.log("Received:", posted.hash);
            return res.redirect(`${FRONTEND_URL}/price-page?status=failure&msg=hash_error`);
        }

        const order = await Order.findOne({ orderId: posted.txnid });
        const candidate = await Candidate.findById(order.employeeId);
        const plan = await CandidatePlan.findOne({ planId: order.planType });

        if (order && candidate && plan) {
            await activateSubscription(order, candidate, plan, posted.txnid, posted.amount);
        }
        return res.redirect(`${FRONTEND_URL}/price-page?status=success&txnid=${posted.txnid}`);
    } catch (err) {
        console.error("PayU Success Handler Error:", err);
        return res.redirect(`${FRONTEND_URL}/price-page?status=failure`);
    }
};

exports.handlePayUFailure = async (req, res) => {
    const posted = req.body;
    await Order.updateOne({ orderId: posted.txnid }, { status: "failed" });

    return res.redirect(`${FRONTEND_URL}/price-page?status=failure&txnid=${posted.txnid}`);
};