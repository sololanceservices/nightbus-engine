const mongoose = require('mongoose');
const Bus = require('./models/Bus');
const User = require('./models/User');
const FoodVendor = require('./models/FoodVendor');
const TripTimeline = require('./models/TripTimeline');
const FoodOrder = require('./models/FoodOrder');
const { receiveTelemetry } = require('./controllers/telemetryController');
require('dotenv').config();

// Simple mock for app.get('io')
const req = {
  app: {
    get: (key) => {
      if (key === 'io') return mockIo;
    }
  },
  body: {}
};

const mockIo = {
  to: (room) => {
    return {
      emit: (event, data) => {
        console.log(`\n[Socket.io] Emitted '${event}' to room '${room}' with data:`, data);
      }
    };
  }
};

const res = {
  status: (code) => {
    // console.log(`Response Status: ${code}`);
    return { json: (data) => {/* console.log('Response JSON:', data) */} };
  },
  json: (data) => {/* console.log('Response JSON:', data) */}
};

async function runTest() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/busapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log('Connected to DB');

  // Clean up
  await Bus.deleteMany({ busNumber: 'PROX-TEST' });
  await User.deleteMany({ phone: '9999999998' });
  await TripTimeline.deleteMany({ tripNumber: 'TEST-123' });

  // 1. Get an existing Bus
  let bus = await Bus.findOne();
  if (!bus) {
    bus = new Bus({
      busNumber: 'PROX-TEST',
      busName: 'Proximity Test Bus',
      operatorId: new mongoose.Types.ObjectId(),
      capacity: 40,
    });
    await bus.save({ validateBeforeSave: false });
  }

  // 2. Create a dummy Vendor in Katni
  const user = new User({
    name: 'Katni Vendor User',
    phone: '9999999998',
    email: 'katnivendor@test.com',
    password: 'password123',
    role: 'vendor',
    isFoodVendor: true
  });
  await user.save();

  // Let's use coordinates: Katni is roughly [79.9482, 23.8320] (Longitude, Latitude)
  await FoodVendor.deleteMany({ userId: user._id });
  const vendor = new FoodVendor({
    userId: user._id,
    name: 'Katni Snacks',
    location: {
      type: 'Point',
      coordinates: [79.9482, 23.8320] // [lng, lat]
    },
    deliveryRadius: 20,
    avgDeliveryTime: 15,
    defaultPrepTime: 10
  });
  await vendor.save();

  // 3. Create a TripTimeline
  const journey = new TripTimeline({
    routeId: new mongoose.Types.ObjectId(),
    busId: bus._id,
    tripNumber: 'TEST-123',
    serviceDate: new Date(),
    status: 'running'
  });
  await journey.save();

  // 4. Create a FoodOrder for this journey (Accepted state)
  const order = new FoodOrder({
    userId: new mongoose.Types.ObjectId(),
    vendorId: vendor._id,
    journeyId: journey._id,
    items: [],
    totalAmount: 200,
    deliveryLocation: 'Katni Stop',
    status: 'accepted',
    orderMode: 'preorder',
    targetDeliveryTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days in advance
    pnrNumber: 'PNR12345',
    paymentStatus: 'paid'
  });
  await order.save();
  console.log(`Order created with ID: ${order._id}, targetDeliveryTime: ${order.targetDeliveryTime}`);

  // 5. Simulate Telemetry Ping #1 (Far away - Jabalpur: [79.9339, 23.1815] ~72km away)
  console.log('\n--- Simulating Telemetry from Jabalpur (72km away) ---');
  req.body = {
    busId: bus._id,
    lat: 23.1815,
    lng: 79.9339,
    speed: 60,
    fuel: 80,
    battery: 100,
    occupancy: 30,
    ignition: true
  };
  await receiveTelemetry(req, res);
  let checkOrder = await FoodOrder.findById(order._id);
  console.log(`Alert Sent? ${checkOrder.proximityAlertSent}, Status: ${checkOrder.status}`); // Should be false, accepted

  // 6. Simulate Telemetry Ping #2 (Close - ~10km away)
  // Katni is 23.8320. 10km south is roughly 23.7420
  console.log('\n--- Simulating Telemetry from 10km away ---');
  req.body = {
    busId: bus._id,
    lat: 23.7420,
    lng: 79.9482,
    speed: 60,
    fuel: 80,
    battery: 100,
    occupancy: 30,
    ignition: true
  };
  await receiveTelemetry(req, res);
  checkOrder = await FoodOrder.findById(order._id);
  console.log(`Alert Sent? ${checkOrder.proximityAlertSent}, Status: ${checkOrder.status}`); // Should be true, preparing

  // 7. Simulate Telemetry Ping #3 (Even closer - ~5km away) to ensure it doesn't alert again
  console.log('\n--- Simulating Telemetry from 5km away (Should NOT alert again) ---');
  req.body = {
    busId: bus._id,
    lat: 23.7820,
    lng: 79.9482,
    speed: 60,
    fuel: 80,
    battery: 100,
    occupancy: 30,
    ignition: true
  };
  await receiveTelemetry(req, res);

  await mongoose.disconnect();
}

runTest().catch(console.error);
