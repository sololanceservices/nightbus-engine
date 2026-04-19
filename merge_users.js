const mongoose = require('mongoose');
const User = require('./models/User');
const ServiceProvider = require('./models/ServiceProvider');
const FoodVendor = require('./models/FoodVendor');
require('dotenv').config();

async function mergeUsers() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app';
    await mongoose.connect(uri);
    
    const phone = '9876543210';
    const users = await User.find({ phone }).sort({ createdAt: 1 }); // Oldest first
    
    if (users.length <= 1) {
      console.log('No duplicates found.');
      await mongoose.disconnect();
      return;
    }

    const mainUser = users[0];
    const dupeUsers = users.slice(1);

    console.log(`Main User: ${mainUser._id}`);
    
    for (const dupe of dupeUsers) {
      console.log(`Merging dupe: ${dupe._id}`);
      
      // Update any ServiceProvider linked to dupe
      await ServiceProvider.updateMany({ userId: dupe._id }, { userId: mainUser._id });
      
      // Update any FoodVendor linked to dupe
      await FoodVendor.updateMany({ userId: dupe._id }, { userId: mainUser._id });
      
      // Update main user flags if dupe had them
      if (dupe.isServiceProvider) mainUser.isServiceProvider = true;
      if (dupe.isFoodVendor) mainUser.isFoodVendor = true;
      if (dupe.serviceType) mainUser.serviceType = dupe.serviceType;
      
      // Delete the dupe
      await User.findByIdAndDelete(dupe._id);
    }

    await mainUser.save();
    console.log('Merge complete.');

    // Now try to force create the unique index
    try {
      await User.collection.createIndex({ phone: 1 }, { unique: true });
      console.log('Unique index on phone created successfully.');
    } catch (idxErr) {
       console.error('Failed to create unique index:', idxErr.message);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

mergeUsers();
