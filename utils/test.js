// utils/test-notify-bid-completed.js
import { notifyBidCompleted } from './notifyBidCompleted.js'; // Adjust path as needed
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Shop from '../models/shopModel.js';
import Customer from '../models/customerModel.js';
import Bid from '../models/bidModel.js';

// Load environment variables
dotenv.config();

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

// Test function to see all shops data
const testAllShops = async () => {
  console.log("\n" + "=".repeat(80));
  console.log("🔬 TESTING ALL SHOPS DATA RETRIEVAL");
  console.log("=".repeat(80));
  
  const allShops = await Shop.find({}).select(
    "businessName ownerName phone isSmsBlocked"
  );
  
  console.log(`\n📊 TOTAL SHOPS IN DATABASE: ${allShops.length}`);
  console.log("-".repeat(80));
  
  allShops.forEach((shop, index) => {
    console.log(`\n[${index + 1}] SHOP: ${shop.businessName}`);
    console.log(`   ID: ${shop._id}`);
    console.log(`   Owner: ${shop.ownerName || 'N/A'}`);
    console.log(`   Phone RAW: "${shop.phone || 'MISSING'}"`);
    console.log(`   SMS Blocked: ${shop.isSmsBlocked === true ? 'YES' : 'NO'}`);
  });
};

// Test function to see all bids data
const testAllBids = async () => {
  console.log("\n" + "=".repeat(80));
  console.log("🔬 TESTING ALL BIDS DATA RETRIEVAL");
  console.log("=".repeat(80));
  
  const allBids = await Bid.find({}).select(
    "user_id contactMethod serviceDescription requestCategory vehicleYear vehicleMake vehicleModel vehicleTrim phone isSmsBlocked firstName lastName"
  ).limit(5);
  
  console.log(`\n📊 TOTAL BIDS IN DATABASE: ${allBids.length} (showing first 5)`);
  console.log("-".repeat(80));
  
  allBids.forEach((bid, index) => {
    console.log(`\n[${index + 1}] BID ID: ${bid._id}`);
    console.log(`   User ID: ${bid.user_id}`);
    console.log(`   Category: ${bid.requestCategory}`);
    console.log(`   Contact Method: ${bid.contactMethod || 'email'}`);
    console.log(`   Phone RAW: "${bid.phone || 'MISSING'}"`);
    console.log(`   Vehicle: ${bid.vehicleYear} ${bid.vehicleMake} ${bid.vehicleModel}`);
    console.log(`   First Name: ${bid.firstName || 'N/A'}`);
    console.log(`   Last Name: ${bid.lastName || 'N/A'}`);
    console.log(`   SMS Blocked: ${bid.isSmsBlocked === true ? 'YES' : 'NO'}`);
  });
};

// Test function to see specific bid
const testSpecificBid = async (bidId) => {
  console.log("\n" + "=".repeat(80));
  console.log("🔬 TESTING SPECIFIC BID DATA RETRIEVAL");
  console.log("=".repeat(80));
  
  const bid = await Bid.findById(bidId).select(
    "user_id contactMethod serviceDescription requestCategory vehicleYear vehicleMake vehicleModel vehicleTrim phone isSmsBlocked firstName lastName"
  );
  
  if (!bid) {
    console.log(`❌ Bid not found with ID: ${bidId}`);
    return null;
  }
  
  console.log("\n📦 BID DATA FROM DATABASE:");
  console.log(JSON.stringify(bid, null, 2));
  
  console.log("\n📞 BID PHONE NUMBER DETAILS:");
  console.log(`   Raw from DB: "${bid.phone || 'MISSING'}"`);
  console.log(`   Contact Method: ${bid.contactMethod || 'email'}`);
  console.log(`   SMS Blocked: ${bid.isSmsBlocked === true ? 'YES' : 'NO'}`);
  
  if (bid.phone) {
    const cleaned = bid.phone.replace(/\D/g, '');
    console.log(`   Cleaned (numbers only): "${cleaned}"`);
    console.log(`   Cleaned length: ${cleaned.length} digits`);
    
    console.log("\n🔄 CUSTOMER PHONE FORMATTING STEPS:");
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      console.log(`   → +${cleaned}`);
    } else if (cleaned.length === 10) {
      console.log(`   → +1${cleaned}`);
    } else if (cleaned.length > 11) {
      console.log(`   → +${cleaned} (international)`);
    } else {
      console.log(`   ❌ Invalid length`);
    }
  }
  
  return bid;
};

// Test function to see specific shop
const testSpecificShop = async (shopId) => {
  console.log("\n" + "=".repeat(80));
  console.log("🔬 TESTING SPECIFIC SHOP DATA RETRIEVAL");
  console.log("=".repeat(80));
  
  const shop = await Shop.findById(shopId).select(
    "businessName ownerName phone isSmsBlocked"
  );
  
  if (!shop) {
    console.log(`❌ Shop not found with ID: ${shopId}`);
    return null;
  }
  
  console.log("\n📦 SHOP DATA FROM DATABASE:");
  console.log(JSON.stringify(shop, null, 2));
  
  console.log("\n📞 SHOP PHONE DETAILS:");
  console.log(`   Raw from DB: "${shop.phone || 'MISSING'}"`);
  console.log(`   SMS Blocked: ${shop.isSmsBlocked === true ? 'YES' : 'NO'}`);
  
  if (shop.phone) {
    const cleaned = shop.phone.replace(/\D/g, '');
    console.log(`   Cleaned: "${cleaned}"`);
    console.log(`   Length: ${cleaned.length} digits`);
    
    console.log("\n🔄 SHOP PHONE FORMATTING STEPS:");
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      console.log(`   → +${cleaned}`);
    } else if (cleaned.length === 10) {
      console.log(`   → +1${cleaned}`);
    } else if (cleaned.length > 11) {
      console.log(`   → +${cleaned} (international)`);
    } else {
      console.log(`   → Invalid length`);
    }
  }
  
  return shop;
};

// Test function to see customer data
const testCustomerData = async (customerId) => {
  console.log("\n" + "=".repeat(80));
  console.log("🔬 TESTING CUSTOMER DATA RETRIEVAL");
  console.log("=".repeat(80));
  
  const customer = await Customer.findById(customerId).select("name email phone");
  
  if (!customer) {
    console.log(`❌ Customer not found with ID: ${customerId}`);
    return null;
  }
  
  console.log("\n📦 CUSTOMER DATA FROM DATABASE:");
  console.log(JSON.stringify(customer, null, 2));
  
  console.log("\n📞 CUSTOMER PHONE DETAILS:");
  console.log(`   Raw from DB: "${customer.phone || 'MISSING'}"`);
  
  return customer;
};

// Main test function
const runTests = async () => {
  try {
    await connectDB();
    
    console.log("\n🚀 STARTING BID COMPLETED NOTIFICATION TESTS");
    console.log("=".repeat(80));
    
    // Test 1: Show all shops data
    await testAllShops();
    
    // Test 2: Show all bids data
    await testAllBids();
    
    // Use real IDs from your database
    const TEST_BID_ID = "695be3eaaf4449bcc5f9f859"; // From your previous logs
    const TEST_SHOP_ID = "695bdd84af4449bcc5f9f825"; // From your previous logs
    
    // Test 3: Test specific bid data
    const bid = await testSpecificBid(TEST_BID_ID);
    
    // Test 4: Test specific shop data
    const shop = await testSpecificShop(TEST_SHOP_ID);
    
    if (bid && bid.user_id) {
      // Test 5: Test customer data
      await testCustomerData(bid.user_id.toString());
    }
    
    // Test 6: Test the actual notifyBidCompleted function
    console.log("\n" + "=".repeat(80));
    console.log("🔬 TESTING NOTIFY BID COMPLETED FUNCTION");
    console.log("=".repeat(80));
    
    console.log("\n📋 TEST DATA:");
    console.log(`   Shop ID: ${TEST_SHOP_ID}`);
    console.log(`   Bid ID: ${TEST_BID_ID}`);
    console.log(`   Shop: ${shop?.businessName || 'Unknown'}`);
    console.log(`   Customer: ${bid?.firstName || 'Unknown'} ${bid?.lastName || ''}`);
    console.log(`   Contact Method: ${bid?.contactMethod || 'email'}`);
    
    console.log("\n📤 CALLING NOTIFY BID COMPLETED FUNCTION...");
    console.log("   ⚠️  WARNING: This will attempt to send REAL SMS!");
    console.log("   To prevent actual sending, comment out twilioClient.messages.create lines");
    console.log("   or set TWILIO_TEST_MODE=true in .env\n");
    
    // Call the function
    await notifyBidCompleted(TEST_SHOP_ID, TEST_BID_ID);
    
    console.log("\n✅ FUNCTION EXECUTED");
    
    // Test 7: Test with invalid IDs to see error handling
    console.log("\n" + "=".repeat(80));
    console.log("🔬 TESTING ERROR HANDLING - Invalid IDs");
    console.log("=".repeat(80));
    
    console.log("\n📤 Testing with invalid shop ID...");
    await notifyBidCompleted("invalid-shop-id", TEST_BID_ID);
    
    console.log("\n📤 Testing with invalid bid ID...");
    await notifyBidCompleted(TEST_SHOP_ID, "invalid-bid-id");
    
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    console.error(error.stack);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log("\n🔌 Disconnected from MongoDB");
    console.log("\n📊 TESTS COMPLETE");
    process.exit(0);
  }
};

// Run the tests
runTests();