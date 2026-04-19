const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function checkDupes() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app';
    await mongoose.connect(uri);
    const users = await User.find({ phone: '9876543210' });
    console.log(`Found ${users.length} users with phone 9876543210`);
    console.log(JSON.stringify(users, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDupes();
