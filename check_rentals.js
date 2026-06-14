const mongoose = require('mongoose');
const OwnerRouteConfig = require('./models/OwnerRouteConfig');
const RentalService = require('./models/RentalService');
const RentalRequest = require('./models/RentalRequest');

async function check() {
  try {
    await mongoose.connect('mongodb://localhost:27017/bus_app');
    console.log('MongoDB Connected');

    const configs = await OwnerRouteConfig.find({
      $or: [
        { from: /shadol/i }, { to: /shadol/i },
        { from: /shahdol/i }, { to: /shahdol/i },
        { from: /rewa/i }, { to: /rewa/i }
      ]
    });
    console.log('\n--- TARGET OWNER ROUTE CONFIGS ---');
    console.log(`Configs length: ${configs.length}`);
    configs.forEach(c => {
      console.log(`- ID: ${c._id}, From: "${c.from}", To: "${c.to}", VehicleType: "${c.vehicleType}", Price: ${c.priceMin}-${c.priceMax}, Capacity: ${c.capacity}, Active: ${c.isActive}`);
    });

    const services = await RentalService.find({});
    console.log('\n--- RENTAL SERVICES (ACTIVE AVAILABILITIES) ---');
    console.log(`Services length: ${services.length}`);
    services.forEach(s => {
      // Find if config matches our targets
      const matchingConfig = configs.find(c => c._id.toString() === s.routeConfigId?.toString());
      if (matchingConfig) {
        console.log(`- Service ID: ${s._id}, Config: ${matchingConfig.from} -> ${matchingConfig.to}, Dates: ${JSON.stringify(s.availableDates)}`);
      }
    });

    const requests = await RentalRequest.find({
      $or: [
        { from: /shadol/i }, { to: /shadol/i },
        { from: /shahdol/i }, { to: /shahdol/i },
        { from: /rewa/i }, { to: /rewa/i }
      ]
    });
    console.log('\n--- TARGET RENTAL REQUESTS ---');
    console.log(`Requests length: ${requests.length}`);
    requests.forEach(r => {
      console.log(`- ID: ${r._id}, From: "${r.from}", To: "${r.to}", VehicleType: "${r.vehicleType}", Budget: ${r.budgetMin}-${r.budgetMax}, Date: ${r.date?.toISOString().split('T')[0]}, Status: "${r.status}"`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

check();
