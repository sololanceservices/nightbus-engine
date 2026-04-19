// ==================== seeds/seedCompleteSystem.js ====================
// Complete production seed data with realistic workflows
// Run: node seeds/seedCompleteSystem.js

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Bus = require('../models/Bus');
const Route = require('../models/Route');
const Journey = require('../models/Journey');
const Segment = require('../models/Segment');
const SeatTemplate = require('../models/SeatTemplate');
const StaffAssignment = require('../models/StaffAssignment');
const VendorRoute = require('../models/VendorRoute');
const VendorProduct = require('../models/VendorProduct');
const ServiceCategory = require('../models/ServiceCategory');
const ServiceListing = require('../models/ServiceListing');
const ServiceBooking = require('../models/ServiceBooking');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');

async function seedDatabase() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Bus.deleteMany({});
    await Route.deleteMany({});
    await Journey.deleteMany({});
    await Segment.deleteMany({});
    await SeatTemplate.deleteMany({});
    await StaffAssignment.deleteMany({});
    await VendorRoute.deleteMany({});
    await VendorProduct.deleteMany({});
    await ServiceCategory.deleteMany({});
    await ServiceListing.deleteMany({});
    await ServiceBooking.deleteMany({});
    await Payment.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});

    // ========== PHASE 1: SEAT TEMPLATES ==========
    console.log('📐 Creating seat templates...');

    const template40 = await SeatTemplate.create({
      name: 'Standard 40 Seater',
      busType: 'Seater',
      totalSeats: 40,
      layout: {
        rows: 10,
        seatsPerRow: 4,
        seatMap: generateSeatMap(10, 4)
      },
      isActive: true
    });

    const template45 = await SeatTemplate.create({
      name: 'Premium 45 Sleeper',
      busType: 'Sleeper',
      totalSeats: 45,
      layout: {
        rows: 15,
        seatsPerRow: 3,
        seatMap: generateSeatMap(15, 3)
      },
      isActive: true
    });

    // ========== PHASE 2: ADMIN & BUSINESS USERS ==========
    console.log('👤 Creating admin user...');

    const admin = await User.create({
      phone: '5432109876',
      name: 'Harshit Sharma',
      email: 'admin@busbook.com',
      role: 'admin',
      age: 40,
      gender: 'male',
      language: 'en',
      isVerified: true,
      isActive: true
    });

    // ========== PHASE 3: BUS OWNERS & THEIR BUSES ==========
    console.log('🚌 Creating bus owners and buses...');

    const owner1 = await User.create({
      phone: '8765432109',
      name: 'Rajesh Verma',
      email: 'rajesh@redbus.com',
      role: 'owner',
      age: 42,
      gender: 'male',
      language: 'en',
      isVerified: true,
      isActive: true,
      companyProfile: {
        companyName: 'Red Bus Company Ltd',
        gstin: '27AABCR5055D1Z5',
        address: 'Sector 12, Delhi 110001'
      },
      kycDetails: {
        document: 'AADHAR',
        documentNumber: '123456789123',
        isVerified: true
      }
    });

    const owner2 = await User.create({
      phone: '7654321098',
      name: 'Priya Sharma',
      email: 'priya@safetravels.com',
      role: 'owner',
      age: 35,
      gender: 'female',
      language: 'en',
      isVerified: true,
      isActive: true,
      companyProfile: {
        companyName: 'Safe Travels Pvt Ltd',
        gstin: '27AABCS1234D1Z0',
        address: 'Bangalore 560001'
      },
      kycDetails: {
        document: 'PAN',
        documentNumber: 'ABCDE1234F',
        isVerified: true
      }
    });

    const owner3 = await User.create({
      phone: '6553210987',
      name: 'Harman Singh',
      email: 'harman@goldenbuses.com',
      role: 'owner',
      age: 45,
      gender: 'male',
      language: 'en',
      isVerified: true,
      isActive: true,
      companyProfile: {
        companyName: 'Golden Buses Ltd',
        gstin: '27AABCG9999D1Z1',
        address: 'Jaipur 302001'
      }
    });

    // Create buses for owner1
    const bus1 = await Bus.create({
      ownerId: owner1._id,
      chassisNumber: 'CHASSISCOMPLETE01',
      registrationNumber: 'DL01AB1234',
      busType: 'Seater',
      totalSeats: 40,
      seatLayout: template40.layout.seatMap,
      amenities: ['WiFi', 'Charging Point', 'Water Bottle'],
      isActive: true,
      currentLocation: {
        type: 'Point',
        coordinates: [77.2249, 28.6358] // Delhi
      }
    });

    const bus2 = await Bus.create({
      ownerId: owner1._id,
      chassisNumber: 'CHASSISCOMPLETE02',
      registrationNumber: 'DL01AB1235',
      busType: 'Sleeper',
      totalSeats: 45,
      seatLayout: template45.layout.seatMap,
      amenities: ['Blanket', 'Pillow', 'Reading Light', 'WiFi'],
      isActive: true,
      currentLocation: {
        type: 'Point',
        coordinates: [77.2249, 28.6358] // Delhi
      }
    });

    // Create buses for owner2
    const bus3 = await Bus.create({
      ownerId: owner2._id,
      chassisNumber: 'CHASSISCOMPLETE03',
      registrationNumber: 'KA01AB5001',
      busType: 'Seater',
      totalSeats: 40,
      seatLayout: template40.layout.seatMap,
      amenities: ['WiFi', 'Charging Point', 'Snacks'],
      isActive: true,
      currentLocation: {
        type: 'Point',
        coordinates: [77.5946, 12.9716] // Bangalore
      }
    });

    // Create buses for owner3
    const bus4 = await Bus.create({
      ownerId: owner3._id,
      chassisNumber: 'CHASSISCOMPLETE04',
      registrationNumber: 'RJ01AB1001',
      busType: 'Seater',
      totalSeats: 40,
      seatLayout: template40.layout.seatMap,
      amenities: ['WiFi', 'Water Bottle'],
      isActive: true,
      currentLocation: {
        type: 'Point',
        coordinates: [75.7873, 26.9124] // Jaipur
      }
    });

    // ========== PHASE 4: STAFF MEMBERS ==========
    console.log('👨‍💼 Creating staff members...');

    const driver1 = await User.create({
      phone: '7765432101',
      name: 'Rajinder Singh',
      role: 'staff',
      age: 38,
      gender: 'male',
      language: 'en',
      isVerified: true,
      isActive: true
    });

    const conductor1 = await User.create({
      phone: '7765432102',
      name: 'Mohan Lal',
      role: 'staff',
      age: 32,
      gender: 'male',
      language: 'hi',
      isVerified: true,
      isActive: true
    });

    const driver2 = await User.create({
      phone: '8865432101',
      name: 'Suresh Ravi',
      role: 'staff',
      age: 40,
      gender: 'male',
      language: 'en',
      isVerified: true,
      isActive: true
    });

    const conductor2 = await User.create({
      phone: '8865432102',
      name: 'Prakash N',
      role: 'staff',
      age: 28,
      gender: 'male',
      language: 'en',
      isVerified: true,
      isActive: true
    });

    // ========== PHASE 5: ROUTES ==========
    console.log('📍 Creating routes...');

    const route1 = await Route.create({
      busId: bus1._id,
      ownerId: owner1._id,
      routeName: 'Delhi-Agra Express',
      stops: [
        { location: { name: 'Delhi Central' }, name: 'Delhi Central', coordinates: { latitude: 28.6358, longitude: 77.2249 }, sequence: 0, arrivalTime: '06:00', departureTime: '06:00' },
        { location: { name: 'Ghaziabad' }, name: 'Ghaziabad', coordinates: { latitude: 28.6692, longitude: 77.6670 }, sequence: 1, arrivalTime: '06:45', departureTime: '06:50' },
        { location: { name: 'Firozabad' }, name: 'Firozabad', coordinates: { latitude: 27.1617, longitude: 78.4142 }, sequence: 2, arrivalTime: '07:45', departureTime: '07:50' },
        { location: { name: 'Agra Fort' }, name: 'Agra Fort', coordinates: { latitude: 27.1751, longitude: 78.0081 }, sequence: 3, arrivalTime: '09:00', departureTime: '09:00' }
      ],
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      basePrice: 400,
      pricePerKm: 3,
      totalDistance: 230,
      estimatedDuration: 180,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isActive: true
    });

    const route2 = await Route.create({
      busId: bus2._id,
      ownerId: owner1._id,
      routeName: 'Delhi-Bangalore Overnight',
      stops: [
        { location: { name: 'Delhi Central' }, name: 'Delhi Central', coordinates: { latitude: 28.6358, longitude: 77.2249 }, sequence: 0, arrivalTime: '18:00', departureTime: '18:00' },
        { location: { name: 'Mathura' }, name: 'Mathura', coordinates: { latitude: 27.4924, longitude: 77.6764 }, sequence: 1, arrivalTime: '20:30', departureTime: '20:45' },
        { location: { name: 'Gwalior' }, name: 'Gwalior', coordinates: { latitude: 26.2389, longitude: 78.1734 }, sequence: 2, arrivalTime: '23:00', departureTime: '23:15' },
        { location: { name: 'Bangalore City' }, name: 'Bangalore City', coordinates: { latitude: 12.9716, longitude: 77.5946 }, sequence: 3, arrivalTime: '08:00', departureTime: '08:00' }
      ],
      days: ['Fri', 'Sat', 'Sun'],
      basePrice: 1200,
      pricePerKm: 5,
      totalDistance: 2100,
      estimatedDuration: 840,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isActive: true
    });

    const route3 = await Route.create({
      busId: bus3._id,
      ownerId: owner2._id,
      routeName: 'Bangalore-Mysore Rapid',
      stops: [
        { location: { name: 'Bangalore City' }, name: 'Bangalore City', coordinates: { latitude: 12.9716, longitude: 77.5946 }, sequence: 0, arrivalTime: '08:00', departureTime: '08:00' },
        { location: { name: 'Whitefield' }, name: 'Whitefield', coordinates: { latitude: 13.0211, longitude: 77.7250 }, sequence: 1, arrivalTime: '08:20', departureTime: '08:25' },
        { location: { name: 'Hosur' }, name: 'Hosur', coordinates: { latitude: 12.7408, longitude: 77.8242 }, sequence: 2, arrivalTime: '09:30', departureTime: '09:35' },
        { location: { name: 'Mysore Palace' }, name: 'Mysore Palace', coordinates: { latitude: 12.2958, longitude: 76.6394 }, sequence: 3, arrivalTime: '11:00', departureTime: '11:00' }
      ],
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      basePrice: 350,
      pricePerKm: 2.5,
      totalDistance: 150,
      estimatedDuration: 180,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isActive: true
    });

    const route4 = await Route.create({
      busId: bus4._id,
      ownerId: owner3._id,
      routeName: 'Jaipur-Delhi Express',
      stops: [
        { location: { name: 'Jaipur City' }, name: 'Jaipur City', coordinates: { latitude: 26.9124, longitude: 75.7873 }, sequence: 0, arrivalTime: '07:00', departureTime: '07:00' },
        { location: { name: 'Alwar' }, name: 'Alwar', coordinates: { latitude: 27.5747, longitude: 75.6245 }, sequence: 1, arrivalTime: '08:45', departureTime: '08:50' },
        { location: { name: 'Delhi Central' }, name: 'Delhi Central', coordinates: { latitude: 28.6358, longitude: 77.2249 }, sequence: 2, arrivalTime: '11:30', departureTime: '11:30' }
      ],
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      basePrice: 450,
      pricePerKm: 3.5,
      totalDistance: 280,
      estimatedDuration: 270,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isActive: true
    });

    // ========== PHASE 6: STAFF ASSIGNMENTS ==========
    console.log('📋 Assigning staff to buses...');

    const today = new Date();

    const shift1 = await StaffAssignment.create({
      staffId: driver1._id,
      busId: bus1._id,
      ownerId: owner1._id,
      role: 'driver',
      shiftDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // tomorrow
      shiftStartTime: '06:00',
      shiftEndTime: '18:00',
      status: 'assigned'
    });

    const shift2 = await StaffAssignment.create({
      staffId: conductor1._id,
      busId: bus1._id,
      ownerId: owner1._id,
      role: 'conductor',
      shiftDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
      shiftStartTime: '06:00',
      shiftEndTime: '18:00',
      status: 'assigned'
    });

    const shift3 = await StaffAssignment.create({
      staffId: driver2._id,
      busId: bus3._id,
      ownerId: owner2._id,
      role: 'driver',
      shiftDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
      shiftStartTime: '08:00',
      shiftEndTime: '20:00',
      status: 'assigned'
    });

    const shift4 = await StaffAssignment.create({
      staffId: conductor2._id,
      busId: bus3._id,
      ownerId: owner2._id,
      role: 'conductor',
      shiftDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
      shiftStartTime: '08:00',
      shiftEndTime: '20:00',
      status: 'assigned'
    });

    // Update buses with assigned staff
    bus1.currentDriverId = driver1._id;
    bus1.currentConductorId = conductor1._id;
    await bus1.save();

    bus3.currentDriverId = driver2._id;
    bus3.currentConductorId = conductor2._id;
    await bus3.save();

    // ========== PHASE 7: CUSTOMERS ==========
    console.log('👥 Creating customers...');

    const customers = [];
    const customerData = [
      { phone: '9876543210', name: 'Amit Kumar', email: 'amit@email.com' },
      { phone: '9876543211', name: 'Priyanka Singh', email: 'priyanka@email.com' },
      { phone: '9876543212', name: 'Rahul Gupta', email: 'rahul@email.com' },
      { phone: '9876543213', name: 'Anjali Verma', email: 'anjali@email.com' },
      { phone: '9876543214', name: 'Vikas Sharma', email: 'vikas@email.com' },
      { phone: '9876543215', name: 'Deepa Patel', email: 'deepa@email.com' },
      { phone: '9876543216', name: 'Rohan Menon', email: 'rohan@email.com' },
      { phone: '9876543217', name: 'Sneha Desai', email: 'sneha@email.com' },
      { phone: '9876543218', name: 'Arjun Nair', email: 'arjun@email.com' },
      { phone: '9876543219', name: 'Meera Saxena', email: 'meera@email.com' }
    ];

    for (const data of customerData) {
      const customer = await User.create({
        phone: data.phone,
        name: data.name,
        email: data.email,
        role: 'customer',
        age: Math.floor(Math.random() * 30) + 20,
        gender: Math.random() > 0.5 ? 'male' : 'female',
        language: 'en',
        isVerified: true,
        isActive: true
      });
      customers.push(customer);
    }

    // ========== PHASE 8: VENDORS ==========
    console.log('🛍️  Creating vendors...');

    const vendor1 = await User.create({
      phone: '6543210987',
      name: 'Chai Express',
      email: 'chai@vendors.com',
      role: 'vendor',
      age: 35,
      gender: 'male',
      language: 'en',
      isVerified: true,
      isActive: true,
      companyProfile: {
        companyName: 'Chai Express Pvt Ltd',
        address: 'Delhi-Agra Route'
      }
    });

    const vendor2 = await User.create({
      phone: '6543210988',
      name: 'Snack Master',
      email: 'snacks@vendors.com',
      role: 'vendor',
      age: 40,
      gender: 'male',
      language: 'hi',
      isVerified: true,
      isActive: true,
      companyProfile: {
        companyName: 'Snack Master Ltd',
        address: 'Multiple routes'
      }
    });

    const vendor3 = await User.create({
      phone: '6543210989',
      name: 'Mysore Snacks',
      email: 'mysore@vendors.com',
      role: 'vendor',
      age: 32,
      gender: 'female',
      language: 'en',
      isVerified: true,
      isActive: true,
      companyProfile: {
        companyName: 'Mysore Snacks Ltd',
        address: 'Bangalore-Mysore Route'
      }
    });

    // ========== PHASE 9: SERVICE CATEGORIES ==========
    console.log('📂 Creating service categories...');

    const catBeverages = await ServiceCategory.create({
      name: 'Beverages',
      icon: 'coffee'
    });

    const catFood = await ServiceCategory.create({
      name: 'Food',
      icon: 'food'
    });

    const catMerchandise = await ServiceCategory.create({
      name: 'Merchandise',
      icon: 'shopping-bag'
    });

    // ========== PHASE 10: VENDOR ROUTES & PRODUCTS ==========
    console.log('🏪 Creating vendor routes and products...');

    // Chai vendor on Delhi-Agra route
    const vendorRoute1 = await VendorRoute.create({
      vendorId: vendor1._id,
      routeId: route1._id,
      stopSequence: [0, 1, 2],
      operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      operatingHours: {
        startTime: '06:00',
        endTime: '18:00'
      },
      isActive: true,
      verifiedAt: new Date(),
      verifiedBy: admin._id,
      location: {
        name: 'Delhi-Agra Route',
        coordinates: [77.6670, 28.0]
      }
    });

    // Create products for vendor1
    await VendorProduct.create({
      vendorId: vendor1._id,
      categoryId: catBeverages._id,
      name: 'Hot Chai',
      description: 'Hot Indian masala chai',
      price: 20,
      prepTime: 2,
      vegetarian: true
    });

    await VendorProduct.create({
      vendorId: vendor1._id,
      categoryId: catBeverages._id,
      name: 'Coffee',
      description: 'Hot coffee',
      price: 30,
      prepTime: 2,
      vegetarian: true
    });

    const vendorRoute2 = await VendorRoute.create({
      vendorId: vendor2._id,
      routeId: route1._id,
      stopSequence: [0, 1, 2, 3],
      operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      operatingHours: { startTime: '06:00', endTime: '20:00' },
      isActive: true,
      verifiedAt: new Date(),
      verifiedBy: admin._id,
      location: {
        type: 'Point',
        coordinates: [77.2249, 28.6358] // Delhi Central for example
      }
    });

    const vendorRoute3 = await VendorRoute.create({
      vendorId: vendor2._id,
      routeId: route3._id,
      stopSequence: [0, 1, 2, 3],
      operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      operatingHours: { startTime: '08:00', endTime: '18:00' },
      isActive: true,
      verifiedAt: new Date(),
      verifiedBy: admin._id,
      location: {
        type: 'Point',
        coordinates: [77.5946, 12.9716] // Bangalore City
      }
    });

    const vendorRoute4 = await VendorRoute.create({
      vendorId: vendor3._id,
      routeId: route3._id,
      stopSequence: [1, 2],
      operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      operatingHours: { startTime: '08:00', endTime: '16:00' },
      isActive: true,
      verifiedAt: new Date(),
      verifiedBy: admin._id,
      location: {
        type: 'Point',
        coordinates: [77.7250, 13.0211] // Whitefield
      }
    });


    // Create products for vendor2
    await VendorProduct.create({
      vendorId: vendor2._id,
      categoryId: catFood._id,
      name: 'Samosa',
      description: 'Crispy fried samosa with aloo',
      price: 25,
      prepTime: 3,
      vegetarian: true
    });

    await VendorProduct.create({
      vendorId: vendor2._id,
      categoryId: catFood._id,
      name: 'Vada Pav',
      description: 'Hot vada pav with chutney',
      price: 20,
      prepTime: 2,
      vegetarian: true
    });

    // Mysore snacks vendor on Bangalore-Mysore route
    // const vendorRoute4 = await VendorRoute.create({
    //   vendorId: vendor3._id,
    //   routeId: route3._id,
    //   stopSequence: [1, 2],
    //   operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    //   operatingHours: {
    //     startTime: '08:00',
    //     endTime: '16:00'
    //   },
    //   isActive: true,
    //   verifiedAt: new Date(),
    //   verifiedBy: admin._id
    // });

    await VendorProduct.create({
      vendorId: vendor3._id,
      categoryId: catFood._id,
      name: 'Mysore Pak',
      description: 'Traditional Mysore pak sweet',
      price: 60,
      prepTime: 0,
      vegetarian: true
    });

    // ========== PHASE 11: SAMPLE JOURNEYS (For next 3 days) ==========
    console.log('🚌 Creating scheduled journeys...');

    const journeyDates = [
      new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // tomorrow
      new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), // day after tomorrow
      new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)  // 3 days later
    ];

    // NOTE: In production, journeys are created on-demand for each bus-route-date combo
    // This is just for demo - real journeys come from scheduled routes
    console.log('✅ Journey scheduling framework ready (journeys created on-demand)');

    // ========== PHASE 12: SAMPLE BOOKINGS ==========
    console.log('📋 Creating sample bookings...');

    // Booking 1: Customer books Delhi-Agra
    const journey1 = await Journey.create({
      customerId: customers[0]._id,
      totalAmount: 800,
      platformFee: 40,
      taxes: 144,
      status: 'pending',
      paymentStatus: 'pending',
      bookingDate: new Date()
    });

    const segment1 = await Segment.create({
      journeyId: journey1._id,
      routeId: route1._id,
      busId: bus1._id,
      customerId: customers[0]._id,
      fromStop: { name: 'Delhi Central', sequence: 0 },
      toStop: { name: 'Agra Fort', sequence: 3 },
      seatNumber: '1A',
      seatGender: 'any',
      travelDate: journeyDates[0],
      status: 'requested',
      price: 400,
      totalAmount: 400,
      passengerDetails: {
        name: customers[0].name,
        age: customers[0].age,
        gender: customers[0].gender
      }
    });

    journey1.segments = [segment1._id];
    await journey1.save();

    // Send notification to owner
    await Notification.create({
      userId: owner1._id,
      type: 'seat_confirmation_request',
      title: 'New Seat Request',
      body: `Seat 1A requested by ${customers[0].name}`,
      referenceId: segment1._id,
      referenceType: 'segment'
    });

    // Booking 2: Customer books Bangalore-Mysore
    const journey2 = await Journey.create({
      customerId: customers[1]._id,
      totalAmount: 700,
      platformFee: 35,
      taxes: 126,
      status: 'confirmed',
      paymentStatus: 'completed',
      bookingDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    });

    const segment2 = await Segment.create({
      journeyId: journey2._id,
      routeId: route3._id,
      busId: bus3._id,
      customerId: customers[1]._id,
      fromStop: { name: 'Bangalore City', sequence: 0 },
      toStop: { name: 'Mysore Palace', sequence: 3 },
      seatNumber: '2B',
      seatGender: 'female',
      travelDate: journeyDates[0],
      status: 'confirmed',
      price: 350,
      totalAmount: 350,
      passengerDetails: {
        name: customers[1].name,
        age: customers[1].age,
        gender: customers[1].gender
      },
      confirmedBy: owner2._id,
      confirmedAt: new Date(),
      qrCode: 'QR_CODE_2B_SEGMENT2'
    });

    journey2.segments = [segment2._id];
    await journey2.save();

    // Booking 3: Cancelled booking
    const journey3 = await Journey.create({
      customerId: customers[2]._id,
      totalAmount: 400,
      platformFee: 20,
      taxes: 72,
      status: 'cancelled',
      paymentStatus: 'refunded',
      bookingDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)
    });

    const segment3 = await Segment.create({
      journeyId: journey3._id,
      routeId: route1._id,
      busId: bus1._id,
      customerId: customers[2]._id,
      fromStop: { name: 'Delhi Central', sequence: 0 },
      toStop: { name: 'Firozabad', sequence: 2 },
      seatNumber: '5C',
      travelDate: journeyDates[1],
      status: 'cancelled',
      price: 400,
      totalAmount: 400,
      passengerDetails: {
        name: customers[2].name,
        age: customers[2].age,
        gender: customers[2].gender
      }
    });

    journey3.segments = [segment3._id];
    await journey3.save();

    // ========== PHASE 13: AUDIT LOGS ==========
    console.log('📊 Creating audit logs...');

    await AuditLog.create({
      userId: admin._id,
      action: 'user_created',
      entityType: 'user',
      entityId: owner1._id,
      newData: { phone: owner1.phone, role: 'owner' },
      status: 'success'
    });

    await AuditLog.create({
      userId: owner1._id,
      action: 'bus_added',
      entityType: 'bus',
      entityId: bus1._id,
      newData: { chassisNumber: bus1.chassisNumber, totalSeats: 40 },
      status: 'success'
    });

    // ========== SUMMARY ==========
    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE SEEDING COMPLETE');
    console.log('='.repeat(60) + '\n');

    console.log('📊 DATA SUMMARY:');
    console.log(`   • Admin Users: 1`);
    console.log(`   • Bus Owners: 3`);
    console.log(`   • Buses: 4`);
    console.log(`   • Routes: 4`);
    console.log(`   • Staff Members: 4`);
    console.log(`   • Customers: ${customers.length}`);
    console.log(`   • Vendors: 3`);
    console.log(`   • Service Categories: 3`);
    console.log(`   • Sample Bookings: 3`);

    console.log('\n🔑 TEST CREDENTIALS:\n');
    console.log('   ADMIN:');
    console.log('   Phone: 5432109876, Role: admin\n');
    console.log('   OWNERS:');
    console.log('   Phone: 8765432109, Role: owner (Red Bus)');
    console.log('   Phone: 7654321098, Role: owner (Safe Travels)');
    console.log('   Phone: 6543210987, Role: owner (Golden Buses)\n');
    console.log('   CUSTOMERS (any of these):');
    console.log('   Phone: 9876543210-9876543219, Role: customer\n');
    console.log('   VENDORS:');
    console.log('   Phone: 6543210987, Role: vendor (Chai Express)');
    console.log('   Phone: 6543210988, Role: vendor (Snack Master)');
    console.log('   Phone: 6543210989, Role: vendor (Mysore Snacks)\n');
    console.log('   STAFF:');
    console.log('   Phone: 7765432101-7765432102, Role: staff');
    console.log('   Phone: 8865432101-8865432102, Role: staff\n');

    console.log('🚀 NEXT STEPS:');
    console.log('   1. Use test credentials to login');
    console.log('   2. Test customer journey search');
    console.log('   3. Create a booking (goes to pending)');
    console.log('   4. Owner confirms seat (generates QR + OTP)');
    console.log('   5. Staff scans QR at boarding');
    console.log('   6. Staff verifies OTP at exit\n');

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Seeding Error:', error);
    process.exit(1);
  }
}

// Helper function to generate seat map
function generateSeatMap(rows, seatsPerRow) {
  const seatMap = new Map();
  const rowChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < seatsPerRow; col++) {
      const seatNum = `${row + 1}${rowChars[col]}`;
      const seatType = col === 0 ? 'window' : col === seatsPerRow - 1 ? 'aisle' : 'middle';

      seatMap.set(seatNum, {
        row,
        col,
        type: seatType,
        gender: 'any'
      });
    }
  }

  return seatMap;
}

// Run seeding
seedDatabase();
