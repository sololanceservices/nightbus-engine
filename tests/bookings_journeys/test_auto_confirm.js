const mongoose = require('mongoose');
require('dotenv').config();

const Bus = require('./models/Bus');
const User = require('./models/User');
const Segment = require('./models/Segment');
const Journey = require('./models/Journey');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('✅ Connected to MongoDB');

  // Find an owner
  const owner = await User.findOne({ role: 'owner' });
  if (!owner) {
     console.log('❌ No owner found');
     process.exit(1);
  }

  // Find a bus owned by this owner
  const bus = await Bus.findOne({ ownerId: owner._id });
  if (!bus) {
     console.log('❌ No bus found for owner', owner._id);
     process.exit(1);
  }

  console.log(`Testing with Owner: ${owner.name} (${owner._id}), Bus: ${bus.busNumber}`);

  // 1. Set Owner setting to true
  owner.ownerSettings = { autoConfirmBookings: true };
  await owner.save();
  console.log('✅ Set autoConfirmBookings to TRUE');

  // Let's simulate what bookingController does
  let autoConfirm = false;
  const ownerUser = await User.findById(bus.ownerId);
  if (ownerUser && ownerUser.ownerSettings) {
      autoConfirm = ownerUser.ownerSettings.autoConfirmBookings === true;
  }
  
  console.log(`Simulated checkout check. autoConfirm should be TRUE: ${autoConfirm}`);
  let status1 = autoConfirm ? 'confirmed' : 'requested';
  console.log(`=> Resulting Status 1: ${status1}`);
  
  // 2. Set Owner setting to false
  owner.ownerSettings = { autoConfirmBookings: false };
  await owner.save();
  console.log('✅ Set autoConfirmBookings to FALSE');
  
  const ownerUser2 = await User.findById(bus.ownerId);
  let autoConfirm2 = false;
  if (ownerUser2 && ownerUser2.ownerSettings) {
      autoConfirm2 = ownerUser2.ownerSettings.autoConfirmBookings === true;
  }
  
  console.log(`Simulated checkout check. autoConfirm should be FALSE: ${autoConfirm2}`);
  let status2 = autoConfirm2 ? 'confirmed' : 'requested';
  console.log(`=> Resulting Status 2: ${status2}`);

  process.exit(0);
}).catch(err => {
  console.error("Connection error:", err);
  process.exit(1);
});
