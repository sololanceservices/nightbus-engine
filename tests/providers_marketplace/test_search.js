const mongoose = require('mongoose');
const User = require('./models/User');
const ServiceProvider = require('./models/ServiceProvider');
require('dotenv').config();

async function testSearch() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app';
    await mongoose.connect(uri);
    
    const serviceType = 'Driver';
    const city = 'Jabalpur';
    
    const query = { isApproved: true };
    if (serviceType) query.serviceType = serviceType;
    if (city) {
      query.$or = [
        { 'serviceAreas.city': new RegExp(city, 'i') },
        { 'location.city': new RegExp(city, 'i') }
      ];
    }

    console.log('Query:', JSON.stringify(query, null, 2));

    const providers = await ServiceProvider.find(query).populate('userId', 'name phone');
    console.log('Results:');
    console.log(JSON.stringify(providers, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testSearch();
