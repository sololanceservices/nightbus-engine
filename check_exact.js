const mongoose = require('mongoose');
const ServiceProvider = require('./models/ServiceProvider');
require('dotenv').config();

async function checkExact() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app';
    await mongoose.connect(uri);
    const doc = await ServiceProvider.findOne({ serviceType: 'Driver' });
    if (doc) {
      console.log('serviceType:', doc.serviceType);
      console.log('Length:', doc.serviceType.length);
      console.log('Hex:', Buffer.from(doc.serviceType).toString('hex'));
    } else {
      console.log('No driver found with exact match');
    }
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkExact();
