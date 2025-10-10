const createError = require('http-errors');
const Plan = require('../../models/employerplans.js');
const Employer = require('../../models/employerSchema.js');
// Get plans for a specific employer
exports.getPlansByEmployer = async (req, res, next) => {
  try {
    const { employerId } = req.params; // or req.query if you prefer query params

    if (!employerId) {
      return next(createError(400, 'Employer ID is required'));
    }

    // Match either plans with this specific employerId OR plans with no employerId (default plans)
    const plans = await Plan.find({
      $or: [
        { employerid: employerId, isActive: true },
        { employerid: { $exists: false }, isActive: true }
      ]
    }).sort({ price: 1 });

    if (!plans.length) {
      return next(createError(404, 'No plans found for this employer'));
    }

    res.json({
      success: true,
      data: plans,
      count: plans.length
    });
  } catch (error) {
    next(createError(500, `Error fetching employer plans: ${error.message}`));
  }
};

// Get all plans
exports.getAllPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ price: 1 });
    res.json({
      success: true,
      data: plans,
      count: plans.length
    });
  } catch (error) {
    next(createError(500, `Error fetching plans: ${error.message}`));
  }
};

// Get single plan by ID
exports.getPlanById = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan || !plan.isActive) {
      return next(createError(404, 'Plan not found or inactive'));
    }
    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    next(createError(500, `Error fetching plan: ${error.message}`));
  }
};

// Create new plan
exports.createPlan = async (req, res, next) => {
  try {
    const plan = new Plan(req.body);
    await plan.save();
    res.status(201).json({
      success: true,
      data: plan,
      message: 'Plan created successfully'
    });
  } catch (error) {
    next(createError(400, `Error creating plan: ${error.message}`));
  }
};

// Update plan
exports.updatePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    if (!plan) {
      return next(createError(404, 'Plan not found'));
    }
    res.json({
      success: true,
      data: plan,
      message: 'Plan updated successfully'
    });
  } catch (error) {
    next(createError(400, `Error updating plan: ${error.message}`));
  }
};

// Delete plan (soft delete)
exports.deletePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );
    if (!plan) {
      return next(createError(404, 'Plan not found'));
    }
    res.json({
      success: true,
      data: plan,
      message: 'Plan deactivated successfully'
    });
  } catch (error) {
    next(createError(500, `Error deactivating plan: ${error.message}`));
  }
};



exports.activateSubscription = async (req, res) => {
  try {
    const { employerId, planId } = req.body;

    // Validate input
    if (!employerId || !planId) {
      return res.status(400).json({ success: false, message: 'Employer ID and Plan ID are required' });
    }

    // Find the employer and plan
    const employer = await Employer.findById(employerId);
    const plan = await Plan.findById(planId);
    
    if (!employer) return res.status(404).json({ success: false, message: 'Employer not found' });
    if (!plan || !plan.isActive) return res.status(404).json({ success: false, message: 'Plan not found or inactive' });

    const isFreeTrial = plan.price === 0;
    const currentDate = new Date();
    let subscriptionEndDate;

    // Check for free trial stacking
    if (isFreeTrial && employer.currentSubscription && 
        !employer.currentSubscription.isTrial && 
        new Date(employer.currentSubscription.endDate) > currentDate) {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply a free trial on top of an active paid subscription'
      });
    }

    // Calculate end date
    if (employer.currentSubscription && new Date(employer.currentSubscription.endDate) > currentDate) {
      // Extend existing subscription
      subscriptionEndDate = new Date(employer.currentSubscription.endDate);
      subscriptionEndDate.setDate(subscriptionEndDate.getDate() + plan.validityDays);
    } else {
      // New subscription
      subscriptionEndDate = new Date();
      subscriptionEndDate.setDate(subscriptionEndDate.getDate() + plan.validityDays);
    }

    // Create subscription record
    const subscriptionRecord = {
      planId: plan._id,
      planDetails: plan.toObject(), // Store complete plan details
      isTrial: isFreeTrial,
      startDate: currentDate,
      endDate: subscriptionEndDate,
      status: 'active'
    };

    // Update employer's subscription totals by adding the new plan's limits
    employer.totalperdaylimit += plan.perDayLimit || 0;
    employer.totalprofileviews += plan.profileViews || 0;
    employer.totaldownloadresume += plan.downloadResume || 0;
    employer.totaljobpostinglimit += plan.jobPostingLimit || 0;

    // Update subscription information
    employer.subscriptions.push(subscriptionRecord);
    employer.currentSubscription = subscriptionRecord;
    
    // Maintain backward compatibility
    employer.subscription = "true";
    employer.trial = isFreeTrial ? 'true' : 'false';
    employer.subscriptionenddate = subscriptionEndDate.toISOString();
    employer.subscriptionleft = Math.ceil((subscriptionEndDate - currentDate) / (1000 * 60 * 60 * 24));

    await employer.save();

    return res.status(200).json({
      success: true,
      message: `Subscription plan "${plan.name}" activated successfully`,
      data: {
        employerId: employer._id,
        currentSubscription: employer.currentSubscription,
        subscriptionLeft: employer.subscriptionleft,
        newLimits: {
          totalperdaylimit: employer.totalperdaylimit,
          totalprofileviews: employer.totalprofileviews,
          totaldownloadresume: employer.totaldownloadresume,
          totaljobpostinglimit: employer.totaljobpostinglimit
        }
      }
    });
  } catch (error) {
    console.error('Error activating subscription:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
