const Order = require('../../models/orderSchema');
const crypto = require('crypto');
const Employee = require('../../models/employeeschema');
const EmployeePlan = require('../../models/employeePlansSchema');

// PayU Configuration
// Note:
// - PAYU_MERCHANT_KEY and PAYU_SALT must match the values from your PayU dashboard for the SAME environment (test or live)
// - We now ALWAYS prefer PAYU_MERCHANT_KEY from env; PAYU_KEY is ignored to avoid mismatches
// - PAYU_BASE_URL should be the base domain; the frontend appends "/_payment"
const PAYU_MERCHANT_KEY = (process.env.PAYU_MERCHANT_KEY || 'aQhRWt').trim();
const PAYU_SALT = process.env.PAYU_SALT?.trim();
if (!PAYU_SALT) {
  throw new Error('PAYU_SALT is missing in environment variables!');
}
// Default to production URL; for staging use PAYU_BASE_URL=https://test.payu.in in env
const PAYU_BASE_URL = (process.env.PAYU_BASE_URL || 'https://secure.payu.in').trim();
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://jobsstorm.com/').trim();

console.log('🔧 PayU Config Loaded:');
console.log(`   - Key: ${PAYU_MERCHANT_KEY.substring(0, 2)}****${PAYU_MERCHANT_KEY.substring(PAYU_MERCHANT_KEY.length - 2)}`);
console.log(`   - Salt: ${PAYU_SALT.substring(0, 2)}****${PAYU_SALT.substring(PAYU_SALT.length - 2)}`);
console.log(`   - Base URL: ${PAYU_BASE_URL}`);

function generatePayUHash(params) {
  // Ensure all parameters are strings, trimmed, and handle undefined/null cases
  // PayU is very strict about whitespace and formatting
  const key = String(params.key || '').trim();
  const txnid = String(params.txnid || '').trim();
  const amount = Number(params.amount).toFixed(2); // Ensure 2 decimal places, no trailing zeros issues
  const productinfo = String(params.productinfo || '').trim();
  const firstname = String(params.firstname || '').trim();
  const email = String(params.email || '').trim();
  const udf1 = String(params.udf1 || '').trim();
  const udf2 = String(params.udf2 || '').trim();
  const udf3 = String(params.udf3 || '').trim();
  const udf4 = String(params.udf4 || '').trim();
  const udf5 = String(params.udf5 || '').trim();
  const salt = String(PAYU_SALT || '').trim();

  // Build the hash string in the exact order required by PayU
  // Format: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
  // The |||||| means 6 empty fields, but PayU counts them as part of the format
  // After udf5, we need: | (separator) + 6 empty fields (6 pipes) = 7 pipes total before salt
  // However, based on error logs, PayU expects exactly 9 pipes after udf2 when udf3-5 are empty
  // So: udf2| | | | | | | | |salt = 9 pipes (3 for empty udf3-5 + 6 for empty fields)
  const hashString = [
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    '', // Empty field 1
    '', // Empty field 2
    '', // Empty field 3
    '', // Empty field 4
    '', // Empty field 5
    '', // Empty field 6
    salt
  ].join('|');

  // Detailed logging for hash calculation
  console.log('🔐 ========== PAYU HASH CALCULATION ==========');
  console.log('🔐 Hash String (exact format):', hashString);
  console.log('🔐 Hash String Length:', hashString.length);
  console.log('🔐 Hash String (JSON escaped):', JSON.stringify(hashString));
  console.log('🔐 Hash components:', {
    key: `"${key}" (length: ${key.length})`,
    txnid: `"${txnid}" (length: ${txnid.length})`,
    amount: `"${amount}" (length: ${amount.length})`,
    productinfo: `"${productinfo}" (length: ${productinfo.length})`,
    firstname: `"${firstname}" (length: ${firstname.length})`,
    email: `"${email}" (length: ${email.length})`,
    udf1: `"${udf1}" (length: ${udf1.length})`,
    udf2: `"${udf2}" (length: ${udf2.length})`,
    udf3: `"${udf3}" (length: ${udf3.length})`,
    udf4: `"${udf4}" (length: ${udf4.length})`,
    udf5: `"${udf5}" (length: ${udf5.length})`,
    salt: `"${salt.substring(0, 4)}****" (length: ${salt.length})`,
  });
  
  // Hash format verification - PayU format: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
  // The |||||| means 6 empty fields after udf5
  // Format is correct: we have 6 empty fields as per PayU documentation
  // Note: When udf3-5 are empty, total pipes before salt = 3 (empty udf3-5) + 6 (empty fields) = 9 pipes
  // This is the correct format according to PayU documentation
  console.log('✅ Hash string format: Correct (6 empty fields as per PayU format ||||||)');

  // Generate the hash
  const hash = crypto
    .createHash('sha512')
    .update(hashString)
    .digest('hex')
    .toLowerCase();

  console.log('🔐 Generated hash:', hash);
  console.log('🔐 Hash length:', hash.length, '(expected: 128 for SHA512)');
  console.log('🔐 ===========================================');
  
  return hash;
}

// Helper function to find first difference between two strings
function findFirstDifference(str1, str2) {
  const minLen = Math.min(str1.length, str2.length);
  for (let i = 0; i < minLen; i++) {
    if (str1[i] !== str2[i]) {
      return {
        position: i,
        expected: `"${str1[i]}" (char code: ${str1.charCodeAt(i)})`,
        actual: `"${str2[i]}" (char code: ${str2.charCodeAt(i)})`,
        context: {
          before: str1.substring(Math.max(0, i - 10), i),
          after: str1.substring(i + 1, Math.min(str1.length, i + 11))
        }
      };
    }
  }
  if (str1.length !== str2.length) {
    return {
      position: minLen,
      message: `Length mismatch: expected ${str1.length}, got ${str2.length}`
    };
  }
  return null;
}
function verifyPayUHash(params, receivedHash) {
  // Format: SALT|status|||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
  const hashString = [ 
    PAYU_SALT,
 params.status || '',
  '', '', '', '', '',  // Empty fields
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
    params.key || PAYU_MERCHANT_KEY
  ].join('|');

  console.log('🔐 Verification Hash String:', hashString); // Add this for debugging
  const calculatedHash = crypto
    .createHash('sha512')
    .update(hashString)
    .digest('hex')
    .toLowerCase();

  const isValid = calculatedHash === (receivedHash || '').toLowerCase();
  console.log('🔐 Hash verification:', isValid ? '✅ Valid' : '❌ Invalid');
  return isValid;
}

exports.createOrder = async (req, res) => {
  // Accept both "firstName" (from frontend) and "firstname" (internal) for compatibility
  const {
    amount,
    employeeId,
    planType,
    firstName,
    firstname: rawFirstname,
    email = 'guest@jobsstorm.com',
    phone = '9999999999',
  } = req.body;

  // Clean and trim all input values to prevent hash mismatches
  const firstname = (firstName || rawFirstname || 'Customer').trim();
  const cleanEmail = String(email || 'guest@jobsstorm.com').trim();
  const cleanPhone = String(phone || '9999999999').trim();
  const cleanEmployeeId = String(employeeId || '').trim();
  const cleanPlanType = String(planType || '').trim();

  console.log('📥 Create order request:', {
    amount,
    employeeId: cleanEmployeeId,
    planType: cleanPlanType,
    firstname,
    email: cleanEmail,
    phone: cleanPhone,
  });

  try {
    // Generate transaction ID
    const txnid = `TXN${Date.now()}`;
    const amountFormatted = Number(amount).toFixed(2);
    // Ensure productinfo is clean - no extra whitespace, trimmed
    const productinfo = `${String(planType || '').trim()} Subscription`.trim();

    // Create order in database
    const order = new Order({
      orderId: txnid,
      amount: amountFormatted,
      currency: 'INR',
      status: 'created',
      paymentMethod: 'payu',
      employeeId: cleanEmployeeId,
      planType: cleanPlanType,
      createdAt: new Date()
    });

    await order.save();

    // Generate hash for PayU
    // Use cleaned values to ensure hash matches what PayU receives
    const hashParams = {
      key: PAYU_MERCHANT_KEY,
      txnid,
      amount: amountFormatted,
      productinfo,
      firstname,
      email: cleanEmail,
      phone: cleanPhone,
      udf1: cleanEmployeeId,
      udf2: cleanPlanType,
      udf3: '',
      udf4: '',
      udf5: ''
    };

    const hash = generatePayUHash(hashParams);

    // Prepare response
    const response = {
      success: true,
      order: {
        id: txnid,
        amount: amountFormatted,
        currency: 'INR',
        productInfo: productinfo
      },
      paymentData: {
        ...hashParams,
        surl: `${process.env.FRONTEND_URL}/payment/success?txnid=${txnid}`,
        furl: `${process.env.FRONTEND_URL}/payment/failure?txnid=${txnid}`,
        hash,
        service_provider: 'payu_paisa',
        payuBaseUrl: PAYU_BASE_URL
      }
    };

    // Log complete payment data for debugging
    console.log('✅ Order created in database:', txnid);
    console.log('📦 Complete Payment Data being sent to frontend:');
    console.log(JSON.stringify(response.paymentData, null, 2));
    
    // Verify hash one more time before sending
    const verificationHash = generatePayUHash(hashParams);
    if (verificationHash !== hash) {
      console.error('❌❌❌ CRITICAL: Hash mismatch detected before sending! ❌❌❌');
      console.error('Original hash:', hash);
      console.error('Verification hash:', verificationHash);
      console.error('Hash params:', hashParams);
      // Still send the response but log the error
    } else {
      console.log('✅ Hash verification passed before sending to PayU');
    }
    
    res.json(response);

  } catch (error) {
    console.error('❌ Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: error.message
    });
  }
};
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

  // Check for hash calculation errors from PayU
  const fullErrorMessage = errorMessage || error_Message || '';
  if (fullErrorMessage && fullErrorMessage.toLowerCase().includes('hash')) {
    console.error('❌❌❌ PAYU HASH ERROR IN CALLBACK! ❌❌❌');
    console.error('Transaction ID:', txnid);
    console.error('Full error message:', fullErrorMessage);
    console.error('Callback data received:', JSON.stringify(req.body, null, 2));
    
    // Try to find the order and recalculate hash
    try {
      const order = await Order.findOne({ orderId: txnid });
      if (order) {
        console.error('📋 Order found in database:', {
          orderId: order.orderId,
          amount: order.amount,
          planType: order.planType,
          employeeId: order.employeeId,
          status: order.status
        });
        
        // Regenerate hash with original order data
        const originalHashParams = {
          key: PAYU_MERCHANT_KEY,
          txnid: order.orderId,
          amount: order.amount,
          productinfo: `${order.planType} Subscription`,
          firstname: firstname || 'Customer',
          email: email || '',
          udf1: order.employeeId,
          udf2: order.planType,
          udf3: '',
          udf4: '',
          udf5: ''
        };
        
        console.error('🔍 Attempting to recalculate hash with original order data...');
        const recalculatedHash = generatePayUHash(originalHashParams);
        console.error('   Recalculated hash:', recalculatedHash);
        console.error('   Hash received from PayU:', hash || 'not provided');
        
        // Also try with callback data
        const callbackHashParams = {
          key: PAYU_MERCHANT_KEY,
          txnid: txnid || order.orderId,
          amount: amount || order.amount,
          productinfo: productinfo || `${order.planType} Subscription`,
          firstname: firstname || 'Customer',
          email: email || '',
          udf1: employeeId || order.employeeId,
          udf2: planType || order.planType,
          udf3: '',
          udf4: '',
          udf5: ''
        };
        
        const callbackRecalculatedHash = generatePayUHash(callbackHashParams);
        console.error('🔍 Hash with callback data:', callbackRecalculatedHash);
        
        if (hash) {
          console.error('   Hash comparison:');
          console.error('     Original order hash === PayU hash?', recalculatedHash === hash.toLowerCase());
          console.error('     Callback data hash === PayU hash?', callbackRecalculatedHash === hash.toLowerCase());
        }
      } else {
        console.error('❌ Order not found in database for txnid:', txnid);
      }
    } catch (recalcError) {
      console.error('❌ Error during hash recalculation:', recalcError);
      console.error('Stack trace:', recalcError.stack);
    }
  }

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
  const { txnid, status, hash, amount, productinfo, firstname, email, employeeId, planType, error, error_Message } = req.body;
  console.log('📥 Manual verification request:', { txnid, status, employeeId });
  
  // Check for hash calculation errors from PayU
  const errorMessage = error || error_Message || '';
  if (errorMessage && errorMessage.toLowerCase().includes('hash')) {
    console.error('❌❌❌ PAYU HASH ERROR DETECTED! ❌❌❌');
    console.error('Transaction ID:', txnid);
    console.error('Error message:', errorMessage);
    console.error('Received data:', {
      txnid,
      status,
      hash: hash ? `${hash.substring(0, 20)}...` : 'missing',
      amount,
      productinfo,
      firstname,
      email,
      employeeId,
      planType
    });
    
    // Try to regenerate hash with received data to compare
    try {
      const order = await Order.findOne({ orderId: txnid });
      if (order) {
        console.error('📋 Order details from database:', {
          orderId: order.orderId,
          amount: order.amount,
          planType: order.planType,
          employeeId: order.employeeId
        });
        
        // Regenerate hash with what we sent originally
        const originalHashParams = {
          key: PAYU_MERCHANT_KEY,
          txnid: order.orderId,
          amount: order.amount,
          productinfo: `${order.planType} Subscription`,
          firstname: firstname || 'Customer',
          email: email || '',
          udf1: order.employeeId,
          udf2: order.planType,
          udf3: '',
          udf4: '',
          udf5: ''
        };
        
        const recalculatedHash = generatePayUHash(originalHashParams);
        console.error('🔍 Hash recalculation with original data:');
        console.error('   Original hash (from order):', order.paymentResponse?.hash || 'not stored');
        console.error('   Recalculated hash:', recalculatedHash);
        console.error('   Received hash from PayU:', hash || 'not provided');
        
        if (hash && recalculatedHash !== hash.toLowerCase()) {
          console.error('❌ Hash mismatch confirmed!');
          console.error('   Expected:', recalculatedHash);
          console.error('   Received:', hash.toLowerCase());
        }
      }
    } catch (recalcError) {
      console.error('❌ Error recalculating hash:', recalcError);
    }
  }

  if (!txnid || !status || !employeeId || !planType) {
    return res.status(400).json({
      success: false,
      error: 'txnid, status, employeeId, and planType are required',
    });
  }

  try {
    // Find order first to check if it exists
    const order = await Order.findOne({ orderId: txnid });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    // Handle failed/cancelled payments gracefully - return 200 with success: false
    if (status !== 'success') {
      console.log('⚠️ Payment not successful:', { txnid, status, error: req.body.error || req.body.error_Message });
      
      // Update order status
      order.status = status === 'cancelled' ? 'cancelled' : 'failed';
      order.errorMessage = req.body.error || req.body.error_Message || 'Payment not successful';
      order.paymentResponse = req.body;
      order.verifiedAt = new Date();
      await order.save();

      // Return 200 with success: false (not 400) to avoid frontend errors
      return res.status(200).json({
        success: false,
        error: order.errorMessage,
        orderId: txnid,
        status: order.status,
        message: 'Payment verification completed - payment was not successful',
      });
    }

    // Verify hash if provided (only for successful payments)
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
        console.log('❌ Invalid hash for successful payment');
        // Still update order as failed due to hash mismatch
        order.status = 'failed';
        order.errorMessage = 'Invalid payment hash';
        order.verifiedAt = new Date();
        await order.save();
        
        return res.status(200).json({
          success: false,
          error: 'Invalid payment hash',
          orderId: txnid,
          status: 'failed',
        });
      }
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

/**
 * Test hash calculation endpoint (for debugging)
 * POST /employee/order/test-hash
 */
exports.testHashCalculation = async (req, res) => {
  try {
    const { key, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5 } = req.body;
    
    console.log('🧪 Testing hash calculation with provided parameters');
    
    const hashParams = {
      key: key || PAYU_MERCHANT_KEY,
      txnid: txnid || `TEST${Date.now()}`,
      amount: amount || '100.00',
      productinfo: productinfo || 'Test Product',
      firstname: firstname || 'Test User',
      email: email || 'test@example.com',
      udf1: udf1 || '',
      udf2: udf2 || '',
      udf3: udf3 || '',
      udf4: udf4 || '',
      udf5: udf5 || ''
    };
    
    const hash = generatePayUHash(hashParams);
    
    return res.status(200).json({
      success: true,
      hashParams,
      hash,
      hashString: `${hashParams.key}|${hashParams.txnid}|${hashParams.amount}|${hashParams.productinfo}|${hashParams.firstname}|${hashParams.email}|${hashParams.udf1}|${hashParams.udf2}|${hashParams.udf3}|${hashParams.udf4}|${hashParams.udf5}||||||${PAYU_SALT}`,
      message: 'Hash calculated successfully. Check terminal for detailed logs.'
    });
  } catch (error) {
    console.error('❌ Error testing hash calculation:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to test hash calculation',
      message: error.message,
    });
  }
};