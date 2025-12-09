const EmployeePlan = require("../../models/employeePlansSchema");

/**
 * Get pricing plans from database
 * GET /employee/pricing-plans
 */
exports.getPricingPlans = async (req, res) => {
  try {
    const plans = await EmployeePlan.find({ isActive: true }).sort({ price: 1 });
    
    // Transform to match frontend expected format
    const formattedPlans = plans.map(plan => ({
      id: plan.planId,
      name: plan.name,
      price: plan.price,
      amount: plan.amount,
      gst: plan.gst,
      totalAmount: plan.totalAmount,
      priceText: plan.priceText,
      displayPrice: plan.displayPrice,
      validity: plan.validity,
      validityMonths: plan.validityMonths,
      color: plan.color,
      features: plan.features,
    }));

    return res.status(200).json({
      success: true,
      data: formattedPlans,
    });
  } catch (error) {
    console.error("❌ Error in getPricingPlans:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Get comparison table data from database
 * GET /employee/pricing-plans/comparison
 */
exports.getComparisonTable = async (req, res) => {
  try {
    const plans = await EmployeePlan.find({ isActive: true }).sort({ price: 1 });
    
    // Build comparison table from database plans
    const features = [
      {
        name: "Apply to jobs",
        silver: plans.find(p => p.planId === "silver")?.features?.applyToJobs ? "✓" : "-",
        gold: plans.find(p => p.planId === "gold")?.features?.applyToJobs ? "✓" : "-",
        platinum: plans.find(p => p.planId === "platinum")?.features?.applyToJobs ? "✓" : "-",
      },
      {
        name: "Priority to recruiters",
        silver: plans.find(p => p.planId === "silver")?.features?.priorityToRecruiters === "none" ? "-" : plans.find(p => p.planId === "silver")?.features?.priorityToRecruiters || "-",
        gold: plans.find(p => p.planId === "gold")?.features?.priorityToRecruiters === "none" ? "-" : plans.find(p => p.planId === "gold")?.features?.priorityToRecruiters || "-",
        platinum: plans.find(p => p.planId === "platinum")?.features?.priorityToRecruiters === "none" ? "-" : plans.find(p => p.planId === "platinum")?.features?.priorityToRecruiters || "-",
      },
      {
        name: "Immediate interview call",
        silver: plans.find(p => p.planId === "silver")?.features?.immediateInterviewCall ? "Yes" : "No",
        gold: plans.find(p => p.planId === "gold")?.features?.immediateInterviewCall ? "Yes" : "No (priority pass)",
        platinum: plans.find(p => p.planId === "platinum")?.features?.immediateInterviewCall ? "Yes" : "No",
      },
      {
        name: "Profile boosted in listings",
        silver: plans.find(p => p.planId === "silver")?.features?.profileBoosted ? "Yes" : "-",
        gold: plans.find(p => p.planId === "gold")?.features?.profileBoosted ? "Yes" : "-",
        platinum: plans.find(p => p.planId === "platinum")?.features?.profileBoosted ? "Yes (top)" : "-",
      },
      {
        name: "Dedicated account manager",
        silver: plans.find(p => p.planId === "silver")?.features?.dedicatedAccountManager ? "Yes" : "-",
        gold: plans.find(p => p.planId === "gold")?.features?.dedicatedAccountManager ? "Yes" : "-",
        platinum: plans.find(p => p.planId === "platinum")?.features?.dedicatedAccountManager ? "Yes" : "-",
      },
      {
        name: "Subscription validity",
        silver: plans.find(p => p.planId === "silver")?.validity || "-",
        gold: plans.find(p => p.planId === "gold")?.validity || "-",
        platinum: plans.find(p => p.planId === "platinum")?.validity || "-",
      },
      {
        name: "Resume review & optimization",
        silver: plans.find(p => p.planId === "silver")?.features?.resumeReview > 0 ? `${plans.find(p => p.planId === "silver")?.features?.resumeReview} review` : "-",
        gold: plans.find(p => p.planId === "gold")?.features?.resumeReview > 0 ? `${plans.find(p => p.planId === "gold")?.features?.resumeReview} review` : "-",
        platinum: plans.find(p => p.planId === "platinum")?.features?.resumeReview > 0 ? `${plans.find(p => p.planId === "platinum")?.features?.resumeReview} reviews` : "-",
      },
      {
        name: "Email & SMS confirmation",
        silver: plans.find(p => p.planId === "silver")?.features?.emailSmsConfirmation ? "✓" : "-",
        gold: plans.find(p => p.planId === "gold")?.features?.emailSmsConfirmation ? (plans.find(p => p.planId === "gold")?.features?.subscriptionCard ? "✓ + subscription card" : "✓") : "-",
        platinum: plans.find(p => p.planId === "platinum")?.features?.emailSmsConfirmation ? (plans.find(p => p.planId === "platinum")?.features?.subscriptionCard ? "✓ + subscription card" : "✓") : "-",
      },
    ];

    return res.status(200).json({
      success: true,
      data: { features },
    });
  } catch (error) {
    console.error("❌ Error in getComparisonTable:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

