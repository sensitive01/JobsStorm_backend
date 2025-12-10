const Order = require('../../models/orderSchema');
const crypto = require('crypto');
const Employee = require('../../models/employeeschema');
const EmployeePlan = require('../../models/employeePlansSchema');

// PayU Configuration
const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY || '25UP9m';
const PAYU_SALT = process.env.PAYU_SALT || '4q63imYb3r3nzbLdmv6BCroviER1i6ZR';
const PAYU_CLIENT_KEY = process.env.PAYU_CLIENT_KEY || 'f8c5c5dd367c0f9b37aa8d4eeca161d5da0d935b7ee354288c8e73daffc101a9';
const PAYU_CLIENT_SECRET = process.env.PAYU_CLIENT_SECRET || 'd96786e86282837050c2e882053ebef929f06f58e1e1256a53e2c33724294926';
// Default to PayU test environment if env not set
const PAYU_BASE_URL = process.env.PAYU_BASE_URL || 'https://test.payu.in'; // set to https://secure.payu.in in production

/**
 * Generate PayU payment hash
 * PayU requires hash in specific format: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
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
    '', // udf6
    '', // udf7
    '', // udf8
    '', // udf9
    '', // udf10
  ].join('|') + '|' + PAYU_SALT;
  
  const hash = crypto
    .createHash('sha512')
    .update(hashString)
    .digest('hex');
  return hash;
}

/**
 * Create order for employee subscription
 * POST /employee/order/create
 */
exports.createOrder = async (req, res) => {
  const { amount, employeeId, planType, firstName, email, phone } = req.body;
  console.log('📥 Received order request:', { amount, employeeId, planType });

  if (!amount || !employeeId || !planType) {
    return res.status(400).json({
      success: false,
      error: 'Amount, employeeId, and planType are required',
    });
  }

  try {
    // Generate unique transaction ID
    const txnid = `TXN${Date.now()}${employeeId.substring(0, 5)}`;
    const productInfo = `${planType} Subscription`;
    const amountNumber = Number(amount);
    const amountFormatted = amountNumber.toFixed(2); // PayU expects 2-decimal format
    
    // Create order in database
    const newOrder = new Order({
      orderId: txnid,
      amount: amountNumber,
      currency: 'INR',
      status: 'created',
      employeeId,
      planType,
      type: 'employee_subscription',
      createdAt: new Date(),
    });

    await newOrder.save();

    // Generate PayU hash
    const hashParams = {
      key: PAYU_MERCHANT_KEY,
      txnid: txnid,
      amount: amountFormatted,
      productinfo: productInfo,
      firstname: firstName || 'Customer',
      email: email || '',
    };

    const hash = generatePayUHash(hashParams);

    console.log('✅ PayU order created:', txnid);
    res.status(200).json({ 
      success: true, 
      order: {
        id: txnid,
        amount: amountFormatted,
        currency: 'INR',
        productInfo: productInfo,
      },
      paymentData: {
        key: PAYU_MERCHANT_KEY,
        txnid: txnid,
        amount: amountFormatted,
        productinfo: productInfo,
        firstname: firstName || 'Customer',
        email: email || '',
        phone: phone || '',
        surl: `${process.env.BASE_URL || 'http://localhost:3000'}/employee/order/success`,
        furl: `${process.env.BASE_URL || 'http://localhost:3000'}/employee/order/failure`,
        hash: hash,
        service_provider: 'payu_paisa',
        payuBaseUrl: PAYU_BASE_URL, // pass base URL so frontend form action matches env
      },
    });
  } catch (error) {
    console.error('❌ Error creating PayU order:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create PayU order',
      message: error.message,
    });
  }
};

/**
 * Verify PayU payment hash
 * PayU response hash format: status|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key|SALT
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
  ].join('|') + '|' + PAYU_SALT;
  
  const calculatedHash = crypto
    .createHash('sha512')
    .update(hashString)
    .digest('hex');
  
  return calculatedHash.toLowerCase() === receivedHash.toLowerCase();
}

/**
 * Verify payment and activate subscription
 * POST /employee/order/verify
 */
exports.verifyPayment = async (req, res) => {
  const { txnid, status, hash, amount, productinfo, firstname, email, employeeId, planType } = req.body;
  console.log('📥 Verifying PayU payment:', { txnid, status, employeeId, planType });

  if (!txnid || !status || !employeeId || !planType) {
    return res.status(400).json({
      success: false,
      error: 'txnid, status, employeeId, and planType are required',
    });
  }
  
  // Hash is optional but recommended for security
  const paymentHash = hash || '';

  try {
    // Verify hash if provided (recommended for security)
    if (paymentHash) {
      const hashParams = {
        key: PAYU_MERCHANT_KEY,
        txnid: txnid,
        amount: amount || '',
        productinfo: productinfo || '',
        firstname: firstname || '',
        email: email || '',
        status: status,
        udf1: '',
        udf2: '',
        udf3: '',
        udf4: '',
        udf5: '',
      };

      if (!verifyPayUHash(hashParams, paymentHash)) {
        console.log('❌ Invalid PayU hash');
        // Still proceed if status is success, but log the warning
        if (status !== 'success') {
          return res.status(400).json({
            success: false,
            error: 'Invalid payment hash',
          });
        }
      }
    }

    // Check payment status
    if (status !== 'success') {
      console.log('❌ Payment not successful:', status);
      return res.status(400).json({
        success: false,
        error: 'Payment not successful',
      });
    }

    // Update order status
    const order = await Order.findOne({ orderId: txnid });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    if (order.status === 'paid') {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        data: {
          orderId: txnid,
          paymentId: order.paymentId,
        },
      });
    }

    order.status = 'paid';
    order.paymentId = txnid;
    await order.save();

    // Activate subscription
    const subscriptionController = require('./subscriptionController');
    
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
    }

    const plan = await EmployeePlan.findOne({ planId: planType, isActive: true });
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found',
      });
    }

    // Calculate validity period
    const startDate = new Date();
    const validityMonths = plan.validityMonths;
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + validityMonths);
    const finalAmount = parseFloat(amount || order.amount);

    // Generate unique card number
    const generateUniqueCardNumber = async () => {
      const randomDigits = (length) =>
        crypto.randomInt(0, Math.pow(10, length))
          .toString()
          .padStart(length, "0");

      let cardNumber = null;
      let prefix = 45;
      let exists = true;
      let attempts = 0;

      while (exists && attempts < 100) {
        const number = `${prefix}${randomDigits(10)}`;
        const found = await Employee.findOne({ "subscription.cardNumber": number });
        if (!found) {
          cardNumber = number;
          exists = false;
        } else {
          prefix++;
        }
        attempts++;
      }

      if (!cardNumber) {
        throw new Error("Failed to generate unique card number");
      }

      return cardNumber;
    };

    const cardNumber = await generateUniqueCardNumber();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 12);

    // Update subscription
    employee.subscription = {
      planType,
      startDate,
      endDate,
      status: "active",
      cardNumber,
      expiryMonth: expiryDate.getMonth().toString().padStart(2, "0"),
      expiryYear: expiryDate.getFullYear().toString(),
      issuedAt: startDate,
      paymentId: txnid,
      amount: finalAmount,
      immediateInterviewCall: plan.features?.immediateInterviewCall || false,
    };

    await employee.save();
    console.log('✅ Subscription activated successfully');

    return res.status(200).json({
      success: true,
      message: 'Payment verified and subscription activated',
      data: {
        orderId: txnid,
        paymentId: txnid,
        subscription: {
          planType: employee.subscription.planType,
          endDate: employee.subscription.endDate,
          immediateInterviewCall: employee.subscription.immediateInterviewCall,
          cardNumber: employee.subscription.cardNumber,
        },
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
      return res.status(400).json({ success: false, message: 'employeeId is required' });
    }

    const orders = await Order.find({ employeeId })
      .sort({ createdAt: -1 })
      .select('orderId paymentId amount currency status planType createdAt');

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('❌ Error fetching employee orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
      error: error.message,
    });
  }
};

