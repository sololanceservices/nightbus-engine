const mongoose = require('mongoose');
const User = require('./models/User');
const ServiceProvider = require('./models/ServiceProvider');
require('dotenv').config();

async function migrate() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app';
    await mongoose.connect(uri);
    
    const providers = await ServiceProvider.find();
    for (const p of providers) {
      await User.findByIdAndUpdate(p.userId, { 
        isServiceProvider: true,
        serviceType: p.serviceType 
      });
      console.log(`Updated user ${p.userId} with serviceType ${p.serviceType}`);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrate();
