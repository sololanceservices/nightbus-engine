const mongoose = require('mongoose');
const YatraPackage = require('./models/YatraPackage');
const YatraBooking = require('./models/YatraBooking');
require('dotenv').config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app');
    
    console.log('--- PACKAGES ---');
    const packages = await YatraPackage.find({});
    console.log(JSON.stringify(packages, null, 2));
    
    console.log('--- BOOKINGS ---');
    const bookings = await YatraBooking.find({});
    console.log(JSON.stringify(bookings, null, 2));
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
