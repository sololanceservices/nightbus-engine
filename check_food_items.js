const mongoose = require('mongoose');
const FoodItem = require('./models/FoodItem');
require('dotenv').config();

async function checkFoodItems() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app');
    const items = await FoodItem.find().populate('vendorId', 'name');
    console.log(JSON.stringify(items, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkFoodItems();
