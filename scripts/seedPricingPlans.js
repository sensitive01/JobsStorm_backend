const mongoose = require("mongoose");
require("dotenv").config();
const dbConnect = require("../config/dbConnect");
const EmployeePlan = require("../models/employeePlansSchema");

// Connect to database
dbConnect();

// Plan data to insert
const plans = [
  {
    planId: 'starter',
    name: 'STARTER',
    price: 15000,
    amount: 15000,
    gst: 2700, // 18% GST
    totalAmount: 17700,
    priceText: '₹15,000 + GST / 6 month',
    displayPrice: '₹15,000 + GST / 6 month',
    validity: '6 months',
    validityMonths: 6,
    billingType: 'one-time',
    color: '#1976D2',
    isActive: true,
    interviewCount: '3-4',
    documentVerificationLevel: 'standard',
    eProfileType: 'standard',
    profileVisibility: 'priority',
    accountSupport: 'standard',
    featuresList: [
      { text: 'Valid for 6 months', included: true },
      { text: '3-4 interviews can be scheduled', included: true },
      { text: 'Upload CV, Passport, Education, PCC', included: true },
      { text: 'Standard e-Profile generation', included: true },
      { text: 'Priority job recommendations', included: true },
    ],
  },
  {
    planId: 'premium',
    name: 'PREMIUM',
    price: 30000,
    amount: 30000,
    gst: 5400, // 18% GST
    totalAmount: 35400,
    priceText: '₹30,000 + GST / Year',
    displayPrice: '₹30,000 + GST / Year',
    validity: '1 year',
    validityMonths: 12,
    billingType: 'one-time',
    color: '#1976D2',
    isActive: true,
    interviewCount: '8-10',
    documentVerificationLevel: 'advanced',
    eProfileType: 'premium-verified',
    profileVisibility: 'highest',
    accountSupport: 'premium',
    featuresList: [
      { text: 'Valid for 1 year', included: true },
      { text: '8-10 interviews can be scheduled', included: true },
      { text: 'Advanced document verification', included: true },
      { text: 'Premium verified e-Profile', included: true },
      { text: 'Highest profile visibility & support', included: true },
    ],
  },
  {
    planId: 'special',
    name: 'SPECIAL PLAN',
    price: 0,
    amount: 0,
    gst: 0,
    totalAmount: 0,
    priceText: 'Custom Price / month',
    displayPrice: 'Custom Price / month',
    validity: 'Choose your duration',
    validityMonths: 0,
    billingType: 'monthly',
    color: '#1976D2',
    isActive: true,
    interviewCount: 'custom',
    documentVerificationLevel: 'tailored',
    eProfileType: 'personalized',
    profileVisibility: 'highest',
    accountSupport: 'dedicated',
    featuresList: [
      { text: 'Validity: Choose your duration', included: true },
      { text: 'Custom interview count', included: true },
      { text: 'Tailored document verification level', included: true },
      { text: 'Personalized e-Profile features', included: true },
      { text: 'Dedicated account support', included: true },
    ],
  },
];

async function seedPricingPlans() {
  try {
    console.log("🌱 Starting to seed pricing plans...");

    // Wait for database connection
    await new Promise((resolve) => {
      if (mongoose.connection.readyState === 1) {
        resolve();
      } else {
        mongoose.connection.once("connected", resolve);
      }
    });

    // Deactivate old plans (silver, gold, platinum)
    const deactivateResult = await EmployeePlan.updateMany(
      { planId: { $in: ['silver', 'gold', 'platinum'] } },
      { isActive: false }
    );
    console.log(`✅ Deactivated ${deactivateResult.modifiedCount} old plan(s)`);

    // Upsert new plans (create if not exists, update if exists)
    const results = [];
    for (const planData of plans) {
      const result = await EmployeePlan.findOneAndUpdate(
        { planId: planData.planId },
        planData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      results.push(result);
      console.log(`✅ ${result.planId} plan ${result.isNew ? 'created' : 'updated'}`);
    }

    console.log("\n🎉 Successfully seeded pricing plans!");
    console.log(`📊 Total plans: ${results.length}`);
    console.log("\nPlans inserted/updated:");
    results.forEach(plan => {
      console.log(`  - ${plan.name} (${plan.planId}): ₹${plan.totalAmount}`);
    });

    // Close database connection
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding pricing plans:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the seed function
seedPricingPlans();

