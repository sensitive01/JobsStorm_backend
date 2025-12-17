const Order = require('../../models/orderSchema');
const crypto = require('crypto');
const Employee = require('../../models/employeeschema');
const EmployeePlan = require('../../models/employeePlansSchema');

// PayU Configuration
// PayU Configuration
const PAYU_MERCHANT_KEY = (process.env.PAYU_KEY || process.env.PAYU_MERCHANT_KEY || '25UP9m').trim();
const PAYU_SALT = (process.env.PAYU_SALT || '4q63imYb3r3nzbLdmv6BCroviER1i6ZR').trim();
const PAYU_BASE_URL = (process.env.PAYU_BASE_URL || 'https://test.payu.in').trim();
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();

// Log PayU Configuration (Safe check)
console.log('🔧 PayU Config Loaded:');
console.log(`   - Key: ${PAYU_MERCHANT_KEY.substring(0, 2)}****${PAYU_MERCHANT_KEY.substring(PAYU_MERCHANT_KEY.length - 2)}`);
console.log(`   - Salt: ${PAYU_SALT.substring(0, 2)}****${PAYU_SALT.substring(PAYU_SALT.length - 2)}`);
console.log(`   - Base URL: ${PAYU_BASE_URL}`);

/**
 * Generate PayU payment hash
 * Format: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
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
    '', '', '', '', '', // udf6-10
  ].join('|') + '|' + PAYU_SALT;

  const hash = crypto.createHash('sha512').update(hashString).digest('hex');
  console.log('🔐 Generated hash string:', hashString);
  console.log('🔐 Generated hash:', hash);
  return hash;
}

/**
 * Verify PayU response hash
 * Format: SALT|status|||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
 */
function verifyPayUHash(params, receivedHash) {
  const hashString = [
    params.status || '',
    params.udf5 || '',
    params.udf4 || '',
    params.udf3 || '',
    params.udf2 || '',
    params.udf1 || '',
    params.email || '',
    params.firstname || '',
    params.productinfo || '',
    params.amount || '',
    params.txnid || '',
    params.key || PAYU_MERCHANT_KEY,
  ].reverse().join('|');

  const calculatedHash = crypto
    .createHash('sha512')
    .update(PAYU_SALT + '|' + hashString)
    .digest('hex');

  const isValid = calculatedHash.toLowerCase() === receivedHash.toLowerCase();
  console.log('🔐 Hash verification:', isValid ? '✅ Valid' : '❌ Invalid');
  return isValid;
}

/**
 * Create order and generate payment hash
 * POST /employee/order/create
 */
exports.createOrder = async (req, res) => {
  const { amount, employeeId, planType, firstname, email, phone, txnid } = req.body;
  console.log('📥 Create order request:', { amount, employeeId, planType, txnid });

  if (!amount || !employeeId || !planType) {
    return res.status(400).json({
      success: false,
      error: 'Amount, employeeId, and planType are required',
    });
  }

  try {
    // Use provided txnid or generate new one
    const transactionId = txnid || `TXN${Date.now()}${employeeId.substring(0, 5)}`;
    const productInfo = `${planType} Subscription`;
    const amountFormatted = Number(amount).toFixed(2);

    // Check if order already exists
    const existingOrder = await Order.findOne({ orderId: transactionId });
    if (existingOrder) {
      console.log('⚠️ Order already exists:', transactionId);
      return res.status(400).json({
        success: false,
        error: 'Order already exists',
      });
    }

    // Create order in database
    const newOrder = new Order({
      orderId: transactionId,
      amount: Number(amount),
      currency: 'INR',
      status: 'pending',
      employeeId,
      planType,
      type: 'employee_subscription',
      createdAt: new Date(),
    });

    await newOrder.save();
    console.log('✅ Order created in database:', transactionId);

    // Sanitize and default inputs
    const sanitizedFirstname = (firstname || 'Customer').trim();
    const sanitizedEmail = (email || 'guest@jobsstorm.com').trim();
    const sanitizedPhone = (phone || '9999999999').trim();

    // Generate PayU hash with UDF fields
    const hashParams = {
      key: PAYU_MERCHANT_KEY,
      txnid: transactionId,
      amount: amountFormatted,
      productinfo: productInfo,
      firstname: sanitizedFirstname,
      email: sanitizedEmail,
      udf1: employeeId,     // Store employeeId for verification
      udf2: planType,       // Store planType for verification
      udf3: '',
      udf4: '',
      udf5: '',
    };

    const hash = generatePayUHash(hashParams);

    // Return payment data to frontend
    res.status(200).json({
      success: true,
      order: {
        id: transactionId,
        amount: amountFormatted,
        currency: 'INR',
        productInfo: productInfo,
      },
      paymentData: {
        key: PAYU_MERCHANT_KEY,
        txnid: transactionId,
        amount: amountFormatted,
        productinfo: productInfo,
        firstname: sanitizedFirstname,
        email: sanitizedEmail,
        phone: sanitizedPhone,
        // Frontend success/failure URLs
        surl: `${FRONTEND_URL}/payment/success?txnid=${transactionId}`,
        furl: `${FRONTEND_URL}/payment/failure?txnid=${transactionId}`,
        hash: hash,
        service_provider: 'payu_paisa',
        udf1: employeeId,
        udf2: planType,
        udf3: '',
        udf4: '',
        udf5: '',
        payuBaseUrl: PAYU_BASE_URL,
      },
    });

    console.log('✅ Payment data sent to frontend');
  } catch (error) {
    console.error('❌ Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: error.message,
    });
  }
};

/**
 * PayU Callback Handler (Webhook)
 * POST /employee/order/payu-callback
 * This receives payment response from PayU
 */
exports.payuCallback = async (req, res) => {
  console.log('📥 PayU Callback received:', req.body);

  const {
    txnid,
    status,
    hash,
    amount,
    productinfo,
    firstname,
    email,
    phone,
    udf1: employeeId,
    udf2: planType,
    error: errorMessage,
    error_Message,
    mode,
    payment_source,
  } = req.body;

  try {
    // Verify hash
    if (hash) {
      const hashParams = {
        key: PAYU_MERCHANT_KEY,
        txnid,
        amount: amount || '',
        productinfo: productinfo || '',
        firstname: firstname || '',
        email: email || '',
        status,
        udf1: employeeId || '',
        udf2: planType || '',
        udf3: '',
        udf4: '',
        udf5: '',
      };

      if (!verifyPayUHash(hashParams, hash)) {
        console.log('❌ Invalid hash in callback');
        return res.redirect(
          `${FRONTEND_URL}/payment/failure?txnid=${txnid}&error=${encodeURIComponent('Invalid payment signature')}`
        );
      }
    }

    // Find order
    const order = await Order.findOne({ orderId: txnid });
    if (!order) {
      console.log('❌ Order not found:', txnid);
      return res.redirect(
        `${FRONTEND_URL}/payment/failure?txnid=${txnid}&error=${encodeURIComponent('Order not found')}`
      );
    }

    // Handle based on status
    if (status === 'success') {
      console.log('✅ Payment successful:', txnid);

      // Verify and activate subscription
      await this.activateSubscription({
        txnid,
        amount,
        employeeId: employeeId || order.employeeId,
        planType: planType || order.planType,
        firstname,
        email,
        phone,
        mode,
        payment_source,
      });

      return res.redirect(
        `${FRONTEND_URL}/payment/success?txnid=${txnid}&amount=${amount}&planType=${planType || order.planType}`
      );
    } else {
      // Payment failed or cancelled
      console.log('❌ Payment not successful:', status);

      let orderStatus = 'failed';
      if (status === 'cancelled') orderStatus = 'cancelled';

      order.status = orderStatus;
      order.errorMessage = errorMessage || error_Message || 'Payment not successful';
      order.paymentResponse = req.body;
      order.verifiedAt = new Date();
      await order.save();

      return res.redirect(
        `${FRONTEND_URL}/payment/failure?txnid=${txnid}&status=${status}&error=${encodeURIComponent(order.errorMessage)}`
      );
    }
  } catch (error) {
    console.error('❌ Error in PayU callback:', error);
    return res.redirect(
      `${FRONTEND_URL}/payment/failure?txnid=${txnid}&error=${encodeURIComponent('System error occurred')}`
    );
  }
};

/**
 * Activate subscription after successful payment
 * Internal function called by payuCallback
 */
exports.activateSubscription = async (paymentData) => {
  const { txnid, amount, employeeId, planType, firstname, email, phone, mode, payment_source } = paymentData;

  console.log('🚀 Activating subscription:', { txnid, employeeId, planType });

  try {
    // Find order
    const order = await Order.findOne({ orderId: txnid });
    if (!order) {
      throw new Error('Order not found');
    }

    // Check if already activated
    if (order.status === 'paid') {
      console.log('⚠️ Subscription already activated:', txnid);
      return;
    }

    // Find employee
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Find plan
    const plan = await EmployeePlan.findOne({ planId: planType, isActive: true });
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

/**
 * Generate unique card number
 */
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

/**
 * Verify payment (called from frontend or for manual verification)
 * POST /employee/order/verify
 */
exports.verifyPayment = async (req, res) => {
  const { txnid, status, hash, amount, productinfo, firstname, email, employeeId, planType } = req.body;
  console.log('📥 Manual verification request:', { txnid, status, employeeId });

  if (!txnid || !status || !employeeId || !planType) {
    return res.status(400).json({
      success: false,
      error: 'txnid, status, employeeId, and planType are required',
    });
  }

  try {
    // Verify hash if provided
    if (hash) {
      const hashParams = {
        key: PAYU_MERCHANT_KEY,
        txnid,
        amount: amount || '',
        productinfo: productinfo || '',
        firstname: firstname || '',
        email: email || '',
        status,
        udf1: employeeId,
        udf2: planType,
        udf3: '',
        udf4: '',
        udf5: '',
      };

      if (!verifyPayUHash(hashParams, hash)) {
        console.log('❌ Invalid hash');
        return res.status(400).json({
          success: false,
          error: 'Invalid payment hash',
        });
      }
    }

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
    }

    if (order.status === 'paid') {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        data: { orderId: txnid, paymentId: order.paymentId },
      });
    }

    // Activate subscription
    await this.activateSubscription({
      txnid,
      amount: amount || order.amount,
      employeeId,
      planType,
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

/**
 * Get payment history for an employee
 * GET /employee/order/history/:employeeId
 */
exports.getEmployeeOrders = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'employeeId is required'
      });
    }

    const orders = await Order.find({ employeeId })
      .sort({ createdAt: -1 })
      .select('orderId paymentId amount currency status planType paymentMethod errorMessage verifiedAt createdAt subscriptionStart subscriptionEnd');

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
      error: error.message,
    });
  }
};


exports.clearAllTransactions = async (req, res) => {
  try {
    const { candidateId } = req.params;
    if (!candidateId) {
      return res.status(400).json({
        success: false,
        message: 'candidateId is required'
      });
    }

    const orders = await Order.deleteMany({ employeeId: candidateId });

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
      error: error.message,
    });
  }
};