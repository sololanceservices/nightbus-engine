const mongoose = require('mongoose');
const User = require('./models/User');
const ServiceProvider = require('./models/ServiceProvider');
require('dotenv').config();

async function checkProviders() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/warrol-bus';
  console.log('Connecting to:', uri);
  try {
    await mongoose.connect(uri);
    const providers = await ServiceProvider.find().populate('userId', 'name email phone');
    console.log(JSON.stringify(providers, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkProviders();
