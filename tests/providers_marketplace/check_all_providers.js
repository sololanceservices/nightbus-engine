const mongoose = require('mongoose');
const ServiceProvider = require('./models/ServiceProvider');
require('dotenv').config();

async function checkAll() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app');
    const all = await ServiceProvider.find();
    console.log(JSON.stringify(all, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkAll();
