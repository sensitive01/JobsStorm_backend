const Employee = require("../../models/employeeschema");
const EmployeePlan = require("../../models/employeePlansSchema");
const crypto = require("crypto");
const sendEmail = require("../../utils/sendEmail");
const { cloudinary } = require("../../config/cloudinary");

/**
 * Get subscription status for an employee
 * GET /employee/subscription/status/:employeeId
 */
exports.getSubscriptionStatus = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await Employee.findById(employeeId).select("subscription userName userEmail");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const subscription = employee.subscription || {};
    const now = new Date();
    const isActive = 
      subscription.status === "active" &&
      subscription.endDate &&
      new Date(subscription.endDate) > now;

    return res.status(200).json({
      success: true,
      data: {
        planType: subscription.planType || "silver",
        status: isActive ? "active" : "expired",
        endDate: subscription.endDate,
        immediateInterviewCall: subscription.immediateInterviewCall || false,
        isActive,
      },
    });
  } catch (error) {
    console.error("❌ Error in getSubscriptionStatus:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Create subscription after payment
 * POST /employee/subscription/create
 */
exports.createSubscription = async (req, res) => {
  try {
    const {
      employeeId,
      planType,
      paymentId,
      amount,
    } = req.body;

    if (!employeeId || !planType || !paymentId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: employeeId, planType, paymentId",
      });
    }

    // Validate plan type against available plans in database
    const availablePlan = await EmployeePlan.findOne({ planId: planType, isActive: true });
    if (!availablePlan) {
      const allPlans = await EmployeePlan.find({ isActive: true });
      const availablePlanIds = allPlans.map((p) => p.planId);
      return res.status(400).json({
        success: false,
        message: `Invalid plan type. Must be one of: ${availablePlanIds.join(", ")}`,
      });
    }
    
    // Only allow paid plans (not silver/free)
    if (planType === "silver") {
      return res.status(400).json({
        success: false,
        message: "Silver plan is free and does not require payment",
      });
    }

    const employee = await Employee.findById(employeeId);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Get plan details from database
    const plan = await EmployeePlan.findOne({ planId: planType, isActive: true });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }
    
    // Calculate validity period from plan details
    const startDate = new Date();
    const validityMonths = plan.validityMonths;
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + validityMonths);
    
    // Use amount from plan details if not provided
    const finalAmount = amount || plan.totalAmount || plan.amount;

    // Generate unique card number
    const cardNumber = await generateUniqueCardNumber();

    // Generate expiry date (2-12 months from now)
    const expiryDate = generateExpiryDate();

    // Get immediateInterviewCall from plan features
    const immediateInterviewCall = plan.features?.immediateInterviewCall || false;

    // Update subscription
    employee.subscription = {
      planType,
      startDate,
      endDate,
      status: "active",
      cardNumber,
      expiryMonth: expiryDate.expiryMonth,
      expiryYear: expiryDate.expiryYear,
      issuedAt: startDate,
      paymentId,
      amount: finalAmount,
      immediateInterviewCall,
    };

    await employee.save();

    // Generate subscription card and send email
    try {
      await generateAndSendSubscriptionCard(employee);
    } catch (cardError) {
      console.error("❌ Error generating subscription card:", cardError);
      // Continue even if card generation fails
    }

    return res.status(200).json({
      success: true,
      message: "Subscription created successfully",
      data: {
        planType: employee.subscription.planType,
        endDate: employee.subscription.endDate,
        immediateInterviewCall: employee.subscription.immediateInterviewCall,
        cardNumber: employee.subscription.cardNumber,
      },
    });
  } catch (error) {
    console.error("❌ Error in createSubscription:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


/**
 * Generate unique card number
 */
async function generateUniqueCardNumber() {
  const randomDigits = (length) =>
    crypto.randomInt(0, Math.pow(10, length))
      .toString()
      .padStart(length, "0");

  let cardNumber = null;
  let prefix = 45;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 100) {
    const number = `${prefix}${randomDigits(10)}`; // 12-digit
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
}

/**
 * Generate expiry date (2-12 months from now)
 */
function generateExpiryDate() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  let year = now.getFullYear();

  let minMonth = currentMonth + 2;
  if (minMonth > 12) {
    minMonth = 12;
    year = year + 1;
  }

  const expiryMonth = Math.floor(Math.random() * (12 - minMonth + 1)) + minMonth;

  return {
    expiryMonth: expiryMonth.toString().padStart(2, "0"),
    expiryYear: year.toString(),
  };
}

/**
 * Generate subscription card image and send email
 */
async function generateAndSendSubscriptionCard(employee) {
  try {
    // Create card image using HTML/CSS (you can use a library like puppeteer or canvas)
    // For now, we'll create a simple text-based card representation
    const cardData = {
      name: employee.userName || "Employee",
      cardNumber: employee.subscription.cardNumber,
      expiryMonth: employee.subscription.expiryMonth,
      expiryYear: employee.subscription.expiryYear,
      planType: employee.subscription.planType.toUpperCase(),
      validUntil: employee.subscription.endDate.toISOString().split("T")[0],
    };

    // Generate card HTML (you can use a template engine or create an image)
    const cardHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .card { 
            width: 400px; 
            height: 250px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            padding: 30px;
            color: white;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          }
          .card-header { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
          .card-number { font-size: 18px; letter-spacing: 3px; margin: 20px 0; }
          .card-footer { display: flex; justify-content: space-between; margin-top: 30px; }
          .plan-type { font-size: 16px; font-weight: bold; }
          .expiry { font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="card-header">JobsStorm Membership Card</div>
          <div class="card-number">${cardData.cardNumber}</div>
          <div style="margin-top: 20px;">
            <div>${cardData.name.toUpperCase()}</div>
            <div class="plan-type">${cardData.planType} MEMBER</div>
          </div>
          <div class="card-footer">
            <div class="expiry">Valid Until: ${cardData.validUntil}</div>
            <div class="expiry">${cardData.expiryMonth}/${cardData.expiryYear}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email with card
    const emailSubject = `Your JobsStorm ${cardData.planType} Membership Card`;
    const emailBody = `
      <h2>Welcome to JobsStorm ${cardData.planType} Membership!</h2>
      <p>Dear ${cardData.name},</p>
      <p>Thank you for subscribing to JobsStorm ${cardData.planType} plan.</p>
      <p>Your membership card details:</p>
      <ul>
        <li><strong>Card Number:</strong> ${cardData.cardNumber}</li>
        <li><strong>Plan Type:</strong> ${cardData.planType}</li>
        <li><strong>Valid Until:</strong> ${cardData.validUntil}</li>
      </ul>
      ${cardHtml}
      <p>Best regards,<br>JobsStorm Team</p>
    `;

    await sendEmail(employee.userEmail, emailSubject, emailBody);

    console.log("✅ Subscription card email sent successfully");
  } catch (error) {
    console.error("❌ Error in generateAndSendSubscriptionCard:", error);
    throw error;
  }
}

/**
 * Check if employee has immediate interview call eligibility
 * GET /employee/subscription/check-interview-eligibility/:employeeId
 */
exports.checkInterviewEligibility = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await Employee.findById(employeeId).select("subscription");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const subscription = employee.subscription || {};
    const now = new Date();
    const isActive = 
      subscription.status === "active" &&
      subscription.endDate &&
      new Date(subscription.endDate) > now;

    // Get plan features from database
    const plan = await EmployeePlan.findOne({ 
      planId: subscription.planType || "silver",
      isActive: true 
    });
    const hasImmediateCall = 
      isActive && 
      plan?.features?.immediateInterviewCall === true &&
      subscription.immediateInterviewCall;

    return res.status(200).json({
      success: true,
      data: {
        hasImmediateCall,
        planType: subscription.planType || "silver",
        isActive,
      },
    });
  } catch (error) {
    console.error("❌ Error in checkInterviewEligibility:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

