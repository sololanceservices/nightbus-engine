const mongoose = require('mongoose');
const User = require('./models/User');
const FoodVendor = require('./models/FoodVendor');
const foodController = require('./controllers/foodController');

require('dotenv').config();

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app');
    
    // Find our test vendor
    const vendor = await FoodVendor.findOne();
    if (!vendor) {
      console.error('No vendor found in database. Run seed first.');
      process.exit(1);
    }
    
    console.log('Using vendor:', vendor.name, 'with userId:', vendor.userId);
    
    // Mock req and res
    const req = {
      user: { id: vendor.userId },
      body: {
        name: 'Test Burger',
        description: 'Juicy cheese burger',
        price: 99,
        prepTime: 10,
        isVeg: true,
        images: ['/uploads/food/test.jpg'],
        category: 'fastfood'
      }
    };
    
    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        console.log('Response status:', this.statusCode || 200);
        console.log('Response data:', JSON.stringify(data, null, 2));
      }
    };
    
    await foodController.addVendorItem(req, res);
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Test script error:', err);
    process.exit(1);
  }
}

test();
