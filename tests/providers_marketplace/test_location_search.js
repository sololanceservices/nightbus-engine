const mongoose = require('mongoose');
const locationController = require('./controllers/locationController');

// Mock request and response
const reqList = [
  { query: { query: 'Mumbai', limit: 10 } },
  { query: { query: 'Thane', limit: 10 } },
  { query: { query: 'Mumbay', limit: 10 } }
];

async function runTests() {
  await mongoose.connect('mongodb://localhost:27017/bus-booking-app');
  for (const req of reqList) {
    console.log(`\n\n--- Testing search: "${req.query.query}" ---`);
    const res = {
      json: (data) => {
        console.log(JSON.stringify(data.locations.map(l => ({
          name: l.name,
          type: l.type,
          isBusStop: l.isBusStop,
          nearestStop: l.nearestStop ? l.nearestStop.name : null
        })), null, 2));
      },
      status: (code) => {
        console.log(`Status: ${code}`);
        return res;
      }
    };
    try {
      await locationController.searchLocations(req, res);
    } catch (e) {
      console.error(e);
    }
  }
  await mongoose.disconnect();
}

runTests();
