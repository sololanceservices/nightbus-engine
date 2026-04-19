const mongoose = require('mongoose');
const FoodVendor = require('./models/FoodVendor');
const User = require('./models/User');
require('dotenv').config();

async function checkFoodVendors() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/warrol-bus');
    const vendors = await FoodVendor.find().populate('userId', 'name email phone');
    console.log(JSON.stringify(vendors, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkFoodVendors();
