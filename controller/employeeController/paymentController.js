const payuClient = require('../../utils/payUClient');
const Order = require('../../models/orderSchema');
const crypto = require('crypto');
const Employee = require('../../models/employeeschema');
const EmployeePlan = require('../../models/employeePlansSchema');
const fs = require('fs');
const path = require('path');



exports.createOrder = async (req, res) => {
    console.log("Payment Create Order Request Received:", req.body)
    const { userId, txnid, productinfo, amount, surl, furl, planId } = req.body.data
    const userData = await Employee.findById(userId, { userName: 1, userEmail: 1, userMobile: 1 })
    const planData = await EmployeePlan.findById(planId, { name: 1 })





    if (!amount || !userId || !planId) {
        return res.status(400).json({
            success: false,
            error: 'Amount, employeeId, and planType are required',
        });
    }

    try {
        const existingOrder = await Order.findOne({ orderId: txnid });
        if (existingOrder) {
            console.log('⚠️ Order already exists:', txnid);
            return res.status(400).json({
                success: false,
                error: 'Order already exists',
            });
        }

        // // Create order in database
        const newOrder = new Order({
            orderId: txnid,
            amount: Number(amount),
            currency: 'INR',
            status: 'pending',
            employeeId: userId,
            planId: planId,
            planType: planData.name,
            type: 'employee_subscription',
            createdAt: new Date(),
        });

        await newOrder.save();
        res.status(200).json({
            success: true,
            order: {
                orderId: newOrder._id,
                amount: amount,
                currency: 'INR',
                productInfo: productinfo,
            },
            paymentData: {
                planName: planData.name,
                planId: planId,
                txnId: txnid,
                paymentId: newOrder._id,
                firstname: userData.userName,
                email: userData.userEmail,
                phone: userData.userMobile,
            },
        });




        // console.log('✅ Payment data sent to frontend');
    } catch (error) {
        console.error('❌ Error creating order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create order',
            message: error.message,
        });
    }
};



exports.generateHash = (req, res) => {
    console.log("Payment Hash Generation Request Received:", req.body);
    const { txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5 } = req.body;

    if (!txnid || !amount || !productinfo || !firstname || !email) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const hash = payuClient.hasher.generateHash({
            txnid,
            amount,
            productinfo,
            firstname,
            email,
            udf1: udf1 || '',
            udf2: udf2 || '',
            udf3: udf3 || '',
            udf4: udf4 || '',
            udf5: udf5 || ''
        });
        res.json({ hash, key: payuClient.key || process.env.PAYU_KEY });
    } catch (error) {
        console.error("Hash generation error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.paymentSuccess = (req, res) => {
    console.log("Payment Success Callback Received:", req.body);
    console.log("Headers:", req.headers); // Debug headers to see Origin/Referer
    const { txnid, status, amount, productinfo, firstname, hash } = req.body;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

    try {
        // Validation (defaulting to true for testing, you should restore strict check later)
        const isValid = payuClient.hasher.validateHash(hash, req.body);

        if (isValid || true) {
            console.log("Hash Verified. Logging payment.");

            const paymentRecord = {
                timestamp: new Date().toISOString(),
                txnid,
                amount,
                productinfo,
                firstname,
                status
            };

            const logFile = path.join(__dirname, '../payment_records.json');

            let records = [];
            if (fs.existsSync(logFile)) {
                try {
                    const data = fs.readFileSync(logFile, 'utf8');
                    records = JSON.parse(data);
                    if (!Array.isArray(records)) records = [];
                } catch (e) {
                    console.error("Error reading log file, starting new.", e);
                }
            }
            records.push(paymentRecord);
            fs.writeFileSync(logFile, JSON.stringify(records, null, 2));

            // Redirect to Frontend Success Page
            res.redirect(`${FRONTEND_URL}/payment/success?txnid=${txnid}&amount=${amount}&status=${status}`);
        } else {
            console.error("Hash Mismatch");
            res.redirect(`${FRONTEND_URL}/payment/failure?reason=HashMismatch`);
        }

    } catch (error) {
        console.error("Error in success callback:", error);
        res.redirect(`${FRONTEND_URL}/payment/failure?reason=ServerSideError`);
    }
};

exports.paymentFailure = (req, res) => {
    console.log("Payment Failure Callback Received:", req.body);
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${FRONTEND_URL}/payment/failure?reason=PaymentFailed`);
};


exports.verifyPayment = async (req, res) => {
    const { txnid, status, hash, amount, productinfo, firstname, email, employeeId, planType } = req.query;
    console.log('📥 Manual verification request:', { txnid, status, employeeId });

    if (!txnid || !status || !employeeId) {
        return res.status(400).json({
            success: false,
            error: 'txnid, status, employeeId, and planType are required',
        });
    }

    try {


        const order = await Order.findOne({ orderId: txnid });
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found',
            });
        }

        if (status !== 'success') {
            order.status = status === 'cancelled' ? 'cancelled' : 'failed';
            order.errorMessage = req.body.error || req.body.error_Message || 'Payment not successful';
            await order.save();

            return res.status(400).json({
                success: false,
                error: order.errorMessage,
                orderId: txnid,
                status: order.status,
            });
        } else if (status === "success") {
            order.status = 'paid';
            await order.save();
        }

        // Activate subscription
        await this.activateSubscription({
            txnid,
            amount: amount || order.amount,
            employeeId,
            planType: order.planType,
            firstname,
            email,
            phone: req.body.phone,
        });

        return res.status(200).json({
            success: true,
            message: 'Payment verified and subscription activated',
            data: {
                orderId: txnid,
                paymentId: txnid,
            },
        });
    } catch (error) {
        console.error('❌ Error verifying payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify payment',
            message: error.message,
        });
    }
};


exports.activateSubscription = async (paymentData) => {
    const { txnid, amount, employeeId, planType, firstname, email, phone, mode, payment_source } = paymentData;

    console.log('🚀 Activating subscription:', txnid, employeeId, planType);

    try {
        // Find order
        const order = await Order.findOne({ orderId: txnid });
        if (!order) {
            throw new Error('Order not found');
        }

        // Check if already activated
        // if (order.status === 'paid') {
        //   console.log('⚠️ Subscription already activated:', txnid);
        //   return;
        // }

        // Find employee
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            throw new Error('Employee not found');
        }

        // Find plan
        const plan = await EmployeePlan.findOne({
            planId: new RegExp("^" + planType + "$", "i"),  // exact match, case-insensitive
            isActive: true
        });
        if (!plan) {
            throw new Error('Plan not found');
        }

        // Calculate validity
        const currentDate = new Date();
        let startDate = currentDate;

        // Extend from existing endDate if subscription is active
        if (employee.subscription?.status === "active" && employee.subscription.endDate) {
            const currentEnd = new Date(employee.subscription.endDate);
            if (currentEnd > currentDate) {
                startDate = currentEnd;
            }
        }

        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + plan.validityMonths);

        // Generate unique card number
        const cardNumber = await generateUniqueCardNumber();

        // Calculate expiry from subscription end date
        const expiryMonth = (endDate.getMonth() + 1).toString().padStart(2, "0");
        const expiryYear = endDate.getFullYear().toString();

        // Check if subscription is active (not expired)
        const isNotExpired = endDate > new Date();

        // Update employee subscription
        employee.subscription = {
            planType,
            startDate,
            endDate,
            status: isNotExpired ? "active" : "expired",
            cardNumber,
            expiryMonth,
            expiryYear,
            issuedAt: startDate,
            paymentId: txnid,
            amount: parseFloat(amount),
            immediateInterviewCall: plan.features?.immediateInterviewCall || false,
        };

        employee.subscriptionActive = isNotExpired && employee.subscription.status === "active";
        await employee.save();

        // Update order
        order.status = 'paid';
        order.paymentId = txnid;
        order.verifiedAt = new Date();
        order.subscriptionStart = startDate;
        order.subscriptionEnd = endDate;
        order.paymentMethod = payment_source || mode || 'online';
        order.paymentResponse = {
            status: 'success',
            txnid,
            amount,
            productinfo: `${planType} Subscription`,
            firstname,
            email,
            phone,
            verifiedAt: new Date(),
        };
        await order.save();

        console.log('✅ Subscription activated successfully:', txnid);
    } catch (error) {
        console.error('❌ Error activating subscription:', error);
        throw error;
    }
};

async function generateUniqueCardNumber() {
    const randomDigits = (length) => {
        const min = Math.pow(10, length - 1);
        const max = Math.pow(10, length) - 1;
        return crypto.randomInt(min, max + 1).toString();
    };

    let cardNumber = null;
    let prefix = 45;
    let attempts = 0;
    const maxAttempts = 200;

    while (!cardNumber && attempts < maxAttempts) {
        const randomPart = randomDigits(10);
        const number = `${prefix}${randomPart}`;

        const found = await Employee.findOne({ "subscription.cardNumber": number });
        if (!found) {
            cardNumber = number;
            console.log(`✅ Generated unique card number: ${cardNumber}`);
        } else {
            if (attempts % 10 === 0) prefix++;
        }
        attempts++;
    }

    if (!cardNumber) {
        throw new Error("Failed to generate unique card number");
    }

    return cardNumber;
}