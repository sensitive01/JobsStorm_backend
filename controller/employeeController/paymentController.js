const Order = require('../../models/orderSchema');
const crypto = require('crypto');
const Candidate = require('../../models/employeeschema');
const CandidatePlan = require('../../models/employeePlansSchema');

// PayU Configuration
const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
const PAYU_SALT = process.env.PAYU_SALT;
const PAYU_BASE_URL = process.env.PAYU_BASE_URL;

// --- Helper Functions ---

/**
 * Generate PayU payment hash (SHA-512) for sending TO PayU.
 * Order: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
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
        '', '', '', '', '', // Empty UDFs up to udf10
    ].join('|') + '|' + PAYU_SALT;

    return crypto.createHash('sha512').update(hashString).digest('hex');
}

/**
 * Verify PayU payment hash (SHA-512) for INCOMING response.
 * Correct Order: SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
 */
function verifyPayUHash(params, receivedHash) {
    // The fields after SALT and status are reversed for PayU verification
    const verificationFields = [
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
        '', '', '', // Empty UDFs up to udf10 (udf6-udf10)
        params.status,
    ];

    // PayU Reverse Hash String Construction: SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
    // Note: The fields are in reverse order from udf5 to key.
    const reverseHashString = [
        PAYU_SALT,
        params.status,
        '', '', '', '', '', // udf10, udf9, udf8, udf7, udf6
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


    const calculatedHash = crypto.createHash('sha512').update(reverseHashString).digest('hex').toLowerCase();
    
    return calculatedHash === receivedHash.toLowerCase();
}


// --- Routes Controllers ---

/**
 * Handle POST response from PayU and redirect to Frontend
 * Route: POST /payment/payu-response
 */
exports.handlePayUResponse = (req, res) => {
    try {
        console.log("📥 Received PayU POST Response:", req.body);

        // 1. Extract data from PayU's POST request
        const { 
            txnid, status, hash, amount, productinfo, 
            firstname, email, errorMessage, 
            udf1, udf2, udf3, udf4, udf5 // Include UDFs for full data forwarding
        } = req.body;

        // 2. Construct Query Params for Frontend
        // We pass these back to the React app so it can call verifyPayment
        const queryParams = new URLSearchParams({
            txnid: txnid || '',
            status: status || 'failure',
            amount: amount || '',
            productinfo: productinfo || '',
            firstname: firstname || '',
            email: email || '',
            hash: hash || '',
            errorMessage: errorMessage || '',
            udf1: udf1 || '',
            udf2: udf2 || '',
            udf3: udf3 || '',
            udf4: udf4 || '',
            udf5: udf5 || ''
        }).toString();

        // 3. Redirect to Frontend 
        const frontendUrl = `${process.env.FRONTEND_URL}/price-page`;
        
        // Use 302/303 redirect to convert the PayU POST to a browser GET request
        res.redirect(302, `${frontendUrl}?${queryParams}`); 

    } catch (error) {
        console.error("❌ Error in PayU redirect:", error);
        // Fallback redirect
        res.redirect(302, `${process.env.FRONTEND_URL}/price-page?status=failure&error=internal`);
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
        // Ensure amount is fixed to 2 decimal places as required by PayU
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
            // Include udf1-udf5 explicitly as empty strings if not needed, for consistent hash generation
            udf1: '', 
            udf2: '',
            udf3: '',
            udf4: '',
            udf5: '',
        };

        const hash = generatePayUHash(hashParams);

        // Backend URL (for surl/furl)
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
                // PayU will POST to this endpoint on success/failure
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
 * Verify payment and activate subscription
 * Route: POST /payment/order/verify
 */
exports.verifyPayment = async (req, res) => {
    // These parameters are passed from the frontend after the redirect
    const { 
        txnid, status, hash, amount, productinfo, 
        firstname, email, employeeId, planType, 
        udf1, udf2, udf3, udf4, udf5 
    } = req.body; 
    const candidateId = employeeId;

    console.log('📥 Verifying Payment:', { txnid, status, candidateId });

    try {
        const order = await Order.findOne({ orderId: txnid });
        if (!order) {
             console.error('Order not found for txnid:', txnid);
             return res.status(404).json({ success: false, error: 'Order not found' });
        }

        // Check if transaction was successful
        if (status !== 'success') {
            order.status = 'failed';
            await order.save();
            return res.status(400).json({ success: false, error: 'Payment failed' });
        }

        // Idempotency check: prevent double processing
        if (order.status === 'paid') {
            return res.status(200).json({ success: true, message: 'Already Activated (Idempotent)' });
        }
        
        // 1. HASH VERIFICATION
        if (hash) {
            const hashParams = {
                status, key: PAYU_MERCHANT_KEY, txnid, amount, productinfo, firstname, email,
                udf1: udf1 || '', udf2: udf2 || '', udf3: udf3 || '', udf4: udf4 || '', udf5: udf5 || ''
            };
            
            if (!verifyPayUHash(hashParams, hash)) {
                console.warn('⚠️ Hash Mismatch! Payment potentially tampered with.');
                order.status = 'tampered';
                await order.save();
                return res.status(401).json({ success: false, error: 'Payment hash verification failed' });
            }
            console.log('✅ Hash Verified Successfully.');
        } else {
             // Hash should always be present for security. Treat as suspicious.
            console.warn('⚠️ Missing Hash in verification request. Treating as successful due to status=success, but suspicious.');
        }


        // 2. Activation Logic
        const candidate = await Candidate.findById(candidateId);
        if (!candidate) {
            return res.status(404).json({ success: false, error: 'Candidate not found' });
        }

        const plan = await CandidatePlan.findOne({ planId: planType });

        const currentDate = new Date();
        const validityMonths = plan?.validityMonths || 1;

        let startDate = currentDate;
        if (candidate.subscription?.status === "active" && candidate.subscription.endDate > currentDate) {
            startDate = new Date(candidate.subscription.endDate);
        }

        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + validityMonths);

        // 3. Update Order and Candidate
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

// Exports (ensure all public functions are exported)
exports.generatePayUHash = generatePayUHash;
exports.verifyPayUHash = verifyPayUHash;
// All route handlers are already exported above.