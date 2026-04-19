const mongoose = require('mongoose');
const ServiceProvider = require('./models/ServiceProvider');
require('dotenv').config();

async function checkType() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app');
    const raw = await ServiceProvider.collection.findOne({});
    console.log('Raw document:', JSON.stringify(raw, null, 2));
    console.log('isApproved type:', typeof raw.isApproved);
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkType();
