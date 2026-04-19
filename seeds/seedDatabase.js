// ==================== seedDatabase.js ====================
// Run this script to populate MongoDB with test data
// Command: node seedDatabase.js

const mongoose = require('mongoose');
const Bus = require('./models/Bus');
const Route = require('./models/Route');

const MONGODB_URI = 'mongodb://localhost:27017/bus_app'; // Update with your MongoDB URI

const seedData = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Bus.deleteMany({});
    await Route.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create Owner (you need to create this manually first or get from your User collection)
    const ownerId = '507f1f77bcf86cd799439011'; // Replace with actual owner ID from User collection

    // ==================== CREATE BUSES ====================
    const buses = await Bus.insertMany([
      {
        ownerId,
        chassisNumber: 'CHASSIS1234567801',
        busType: 'AC Sleeper',
        totalSeats: 40,
        amenities: ['WiFi', 'AC', 'Charging Point', 'Water Bottle', 'Blanket', 'Pillow'],
        isActive: true
      },
      {
        ownerId,
        chassisNumber: 'CHASSIS1234567802',
        busType: 'AC Seater',
        totalSeats: 40,
        amenities: ['WiFi', 'Charging Point', 'Water Bottle'],
        isActive: true
      },
      {
        ownerId,
        chassisNumber: 'CHASSIS1234567803',
        busType: 'Non-AC Seater',
        totalSeats: 36,
        amenities: ['Water Bottle'],
        isActive: true
      },
      {
        ownerId,
        chassisNumber: 'CHASSIS1234567804',
        busType: 'Sleeper',
        totalSeats: 40,
        amenities: ['Blanket', 'Pillow', 'Reading Light'],
        isActive: true
      },
      {
        ownerId,
        chassisNumber: 'CHASSIS1234567805',
        busType: 'AC Sleeper',
        totalSeats: 40,
        amenities: ['WiFi', 'AC', 'Charging Point', 'Blanket', 'Snacks'],
        isActive: true
      }
    ]);

    console.log(`✅ Created ${buses.length} buses`);

    // ==================== CREATE ROUTES ====================
    const routes = await Route.insertMany([
      // Direct Route: Mumbai → Pune
      {
        busId: buses[0]._id,
        routeName: 'Mumbai Pune Express',
        stops: [
          {
            location: { name: 'Mumbai Central', coordinates: [72.8311, 18.9696] },
            departureTime: '08:00',
            sequence: 1
          },
          {
            location: { name: 'Lonavala', coordinates: [73.4076, 18.7539] },
            arrivalTime: '10:30',
            departureTime: '10:45',
            sequence: 2
          },
          {
            location: { name: 'Pune Station', coordinates: [73.8567, 18.5204] },
            arrivalTime: '12:00',
            sequence: 3
          }
        ],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        basePrice: 500,
        pricePerKm: 2,
        isActive: true
      },

      // Route for connecting: Mumbai → Indore
      {
        busId: buses[1]._id,
        routeName: 'Mumbai Indore Highway',
        stops: [
          {
            location: { name: 'Mumbai Central', coordinates: [72.8311, 18.9696] },
            departureTime: '20:00',
            sequence: 1
          },
          {
            location: { name: 'Nashik', coordinates: [73.7898, 19.9975] },
            arrivalTime: '23:30',
            departureTime: '23:45',
            sequence: 2
          },
          {
            location: { name: 'Indore Central', coordinates: [75.8577, 22.7196] },
            arrivalTime: '08:00',
            sequence: 3
          }
        ],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        basePrice: 800,
        pricePerKm: 2.5,
        isActive: true
      },

      // Route for connecting: Indore → Bhopal
      {
        busId: buses[2]._id,
        routeName: 'Indore Bhopal Express',
        stops: [
          {
            location: { name: 'Indore Central', coordinates: [75.8577, 22.7196] },
            departureTime: '09:00',
            sequence: 1
          },
          {
            location: { name: 'Dewas', coordinates: [76.0534, 22.9676] },
            arrivalTime: '10:30',
            departureTime: '10:45',
            sequence: 2
          },
          {
            location: { name: 'Bhopal Junction', coordinates: [77.4126, 23.2599] },
            arrivalTime: '13:00',
            sequence: 3
          }
        ],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        basePrice: 400,
        pricePerKm: 2,
        isActive: true
      },

      // Direct Route: Jabalpur → Bhopal
      {
        busId: buses[3]._id,
        routeName: 'Jabalpur Bhopal Night Express',
        stops: [
          {
            location: { name: 'Jabalpur Station', coordinates: [79.9864, 23.1815] },
            departureTime: '22:00',
            sequence: 1
          },
          {
            location: { name: 'Narsinghpur', coordinates: [79.1948, 22.9467] },
            arrivalTime: '23:30',
            departureTime: '23:45',
            sequence: 2
          },
          {
            location: { name: 'Bhopal Junction', coordinates: [77.4126, 23.2599] },
            arrivalTime: '06:30',
            sequence: 3
          }
        ],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        basePrice: 850,
        pricePerKm: 2.5,
        isActive: true
      },

      // Direct Route: Delhi → Jaipur
      {
        busId: buses[4]._id,
        routeName: 'Delhi Jaipur Superfast',
        stops: [
          {
            location: { name: 'Delhi Gate', coordinates: [77.2090, 28.7041] },
            departureTime: '06:00',
            sequence: 1
          },
          {
            location: { name: 'Gurgaon', coordinates: [77.0266, 28.4595] },
            arrivalTime: '07:00',
            departureTime: '07:15',
            sequence: 2
          },
          {
            location: { name: 'Jaipur Fort', coordinates: [75.8267, 26.9124] },
            arrivalTime: '11:00',
            sequence: 3
          }
        ],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        basePrice: 600,
        pricePerKm: 2,
        isActive: true
      },

      // Route for connecting: Jabalpur → Indore
      {
        busId: buses[1]._id,
        routeName: 'Jabalpur Indore Express',
        stops: [
          {
            location: { name: 'Jabalpur Station', coordinates: [79.9864, 23.1815] },
            departureTime: '08:00',
            sequence: 1
          },
          {
            location: { name: 'Hoshangabad', coordinates: [77.7285, 22.7550] },
            arrivalTime: '12:00',
            departureTime: '12:15',
            sequence: 2
          },
          {
            location: { name: 'Indore Central', coordinates: [75.8577, 22.7196] },
            arrivalTime: '18:00',
            sequence: 3
          }
        ],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        basePrice: 700,
        pricePerKm: 2.5,
        isActive: true
      },

      // Route: Pune → Bangalore
      {
        busId: buses[0]._id,
        routeName: 'Pune Bangalore Express',
        stops: [
          {
            location: { name: 'Pune Station', coordinates: [73.8567, 18.5204] },
            departureTime: '18:00',
            sequence: 1
          },
          {
            location: { name: 'Belgaum', coordinates: [74.4977, 15.8497] },
            arrivalTime: '02:00',
            departureTime: '02:30',
            sequence: 2
          },
          {
            location: { name: 'Bangalore City', coordinates: [77.5946, 12.9716] },
            arrivalTime: '10:00',
            sequence: 3
          }
        ],
        days: ['Mon', 'Wed', 'Fri', 'Sun'],
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        basePrice: 1200,
        pricePerKm: 3,
        isActive: true
      }
    ]);

    console.log(`✅ Created ${routes.length} routes`);

    // Display summary
    console.log('\n📊 SEED DATA SUMMARY:');
    console.log('====================');
    console.log(`Total Buses: ${buses.length}`);
    console.log(`Total Routes: ${routes.length}`);
    console.log('\n🚌 BUSES:');
    buses.forEach(bus => {
      console.log(`  - ${bus.chassisNumber} (${bus.busType}) - ${bus.totalSeats} seats`);
    });
    console.log('\n🗺️  ROUTES:');
    routes.forEach(route => {
      const from = route.stops[0].location.name;
      const to = route.stops[route.stops.length - 1].location.name;
      console.log(`  - ${route.routeName}: ${from} → ${to}`);
    });

    console.log('\n✅ Database seeded successfully!');
    console.log('🎯 You can now test the customer app with real data');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedData();                       