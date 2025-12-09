const Razorpay = require('razorpay');
const Order = require('../../models/orderSchema');
const crypto = require('crypto');
const Employee = require('../../models/employeeschema');
const EmployeePlan = require('../../models/employeePlansSchema');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Create order for employee subscription
 * POST /employee/order/create
 */
exports.createOrder = async (req, res) => {
  const { amount, employeeId, planType } = req.body;
  console.log('📥 Received order request:', { amount, employeeId, planType });

  if (!amount || !employeeId || !planType) {
    return res.status(400).json({
      success: false,
      error: 'Amount, employeeId, and planType are required',
    });
  }

  try {
    const options = {
      amount: parseInt(amount) * 100, // In paise
      currency: 'INR',
      receipt: `emp_${Date.now()}_${employeeId}`,
      notes: {
        employeeId,
        planType,
        type: 'employee_subscription',
      },
    };

    const order = await razorpay.orders.create(options);
    const newOrder = new Order({
      orderId: order.id,
      amount: parseInt(amount),
      currency: order.currency,
      status: 'created',
      employeeId, // Store employee ID
      planType,
      type: 'employee_subscription',
      createdAt: new Date(),
    });

    await newOrder.save();
    console.log('✅ Order created:', order.id);
    res.status(200).json({ 
      success: true, 
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      },
      keyId: process.env.RAZORPAY_KEY_ID, // Return key for frontend
    });
  } catch (error) {
    console.error('❌ Error creating Razorpay order:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create Razorpay order',
      message: error.message,
    });
  }
};

/**
 * Verify payment and activate subscription
 * POST /employee/order/verify
 */
exports.verifyPayment = async (req, res) => {
  const { orderId, paymentId, signature, employeeId, planType } = req.body;
  console.log('📥 Verifying payment:', { orderId, paymentId, employeeId, planType });

  if (!orderId || !paymentId || !signature || !employeeId || !planType) {
    return res.status(400).json({
      success: false,
      error: 'orderId, paymentId, signature, employeeId, and planType are required',
    });
  }

  try {
    // Verify signature
    const text = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    if (generatedSignature !== signature) {
      console.log('❌ Invalid signature');
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature',
      });
    }

    // Verify payment with Razorpay
    const payment = await razorpay.payments.fetch(paymentId);
    
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      console.log('❌ Payment not captured:', payment.status);
      return res.status(400).json({
        success: false,
        error: 'Payment not successful',
      });
    }

    // Update order status
    const order = await Order.findOne({ orderId });
    if (order) {
      order.status = 'paid';
      order.paymentId = paymentId;
      await order.save();
    }

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
    const finalAmount = payment.amount / 100; // Convert from paise

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
      paymentId,
      amount: finalAmount,
      immediateInterviewCall: plan.features?.immediateInterviewCall || false,
    };

    await employee.save();
    console.log('✅ Subscription activated successfully');

    return res.status(200).json({
      success: true,
      message: 'Payment verified and subscription activated',
      data: {
        orderId,
        paymentId,
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

