const Razorpay = require('razorpay');
const Order = require('../../models/orderSchema');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
exports.createOrder = async (req, res) => {
  const { amount, employerid, plan_id } = req.body;
  console.log('Received request:', { amount, employerid, plan_id });

  if (!amount || !employerid || !plan_id) {
    return res.status(400).json({
      success: false,
      error: 'Amount, employerid, and plan_id are required',
    });
  }

  try {
    const options = {
      amount: parseInt(amount) * 100, // In paise
      currency: 'INR',
      receipt: `rcptid_${Date.now()}`,
      notes: {
        employerid,
        plan_id,
      },
    };

    const order = await razorpay.orders.create(options);
    const newOrder = new Order({
      orderId: order.id,
      amount: parseInt(amount),
      currency: order.currency,
      status: order.status,
      employerid, // Store employer
      plan_id,
      created_at: new Date(),
    });

    await newOrder.save();
    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ success: false, error: 'Failed to create Razorpay order' });
  }
};

