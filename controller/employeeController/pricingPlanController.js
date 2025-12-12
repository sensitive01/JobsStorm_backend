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
      id: plan._id,
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
      billingType: plan.billingType || 'one-time',
      interviewCount: plan.interviewCount,
      documentVerificationLevel: plan.documentVerificationLevel,
      eProfileType: plan.eProfileType,
      profileVisibility: plan.profileVisibility,
      accountSupport: plan.accountSupport,
      featuresList: plan.featuresList || [],
      features: plan.features,
      isCustom: plan.planId === 'special', // Special plan is custom pricing
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
 * Note: Comparison table is now optional since features are shown in plan cards
 */
exports.getComparisonTable = async (req, res) => {
  try {
    const plans = await EmployeePlan.find({ isActive: true }).sort({ price: 1 });
    
    // Build comparison table from database plans (using new plan IDs)
    const starterPlan = plans.find(p => p.planId === "starter");
    const premiumPlan = plans.find(p => p.planId === "premium");
    const specialPlan = plans.find(p => p.planId === "special");
    
    // Build features comparison based on featuresList if available, otherwise use legacy features
    const features = [];
    
    // If plans have featuresList, use that
    if (starterPlan?.featuresList?.length > 0 || premiumPlan?.featuresList?.length > 0) {
      // Get all unique features from all plans
      const allFeatures = new Set();
      [starterPlan, premiumPlan, specialPlan].forEach(plan => {
        if (plan?.featuresList) {
          plan.featuresList.forEach(f => {
            if (f.text) allFeatures.add(f.text);
          });
        }
      });
      
      // Build comparison for each feature
      allFeatures.forEach(featureText => {
        features.push({
          name: featureText,
          starter: starterPlan?.featuresList?.find(f => f.text === featureText)?.included ? "✓" : "-",
          premium: premiumPlan?.featuresList?.find(f => f.text === featureText)?.included ? "✓" : "-",
          special: specialPlan?.featuresList?.find(f => f.text === featureText)?.included ? "✓" : "-",
        });
      });
    } else {
      // Fallback to legacy features structure
      features.push(
        {
          name: "Subscription validity",
          starter: starterPlan?.validity || "-",
          premium: premiumPlan?.validity || "-",
          special: specialPlan?.validity || "-",
        },
        {
          name: "Interview count",
          starter: starterPlan?.interviewCount || "-",
          premium: premiumPlan?.interviewCount || "-",
          special: specialPlan?.interviewCount || "-",
        },
        {
          name: "Document verification",
          starter: starterPlan?.documentVerificationLevel || "-",
          premium: premiumPlan?.documentVerificationLevel || "-",
          special: specialPlan?.documentVerificationLevel || "-",
        },
        {
          name: "e-Profile type",
          starter: starterPlan?.eProfileType || "-",
          premium: premiumPlan?.eProfileType || "-",
          special: specialPlan?.eProfileType || "-",
        },
        {
          name: "Profile visibility",
          starter: starterPlan?.profileVisibility || "-",
          premium: premiumPlan?.profileVisibility || "-",
          special: specialPlan?.profileVisibility || "-",
        },
        {
          name: "Account support",
          starter: starterPlan?.accountSupport || "-",
          premium: premiumPlan?.accountSupport || "-",
          special: specialPlan?.accountSupport || "-",
        }
      );
    }

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


