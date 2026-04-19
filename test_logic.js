const mongoose = require('mongoose');
const User = require('./models/User');
const ServiceProvider = require('./models/ServiceProvider');
require('dotenv').config();

async function testControllerLogic() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app';
    await mongoose.connect(uri);
    
    // Exactly what's in marketplaceController.js
    const serviceType = 'Driver';
    const city = ''; // Usually empty from frontend if not provided
    
    const query = { isApproved: true };
    if (serviceType) query.serviceType = serviceType;
    if (city) {
       // ... existing city logic ...
    }

    const providers = await ServiceProvider.find(query)
      .populate('userId', 'name phone');
      
    console.log('Results Count:', providers.length);
    console.log('Results:', JSON.stringify(providers, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testControllerLogic();
