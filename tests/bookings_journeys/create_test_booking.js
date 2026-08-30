const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../../models/User');
const YatraPackage = require('../../models/YatraPackage');
const YatraBooking = require('../../models/YatraBooking');
const Bus = require('../../models/Bus');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app').then(async () => {
  console.log('Connected to DB');

  try {
    const customerId = '6a93e662c38243a176aacd43'; // ID from earlier logs
    
    let bus = await Bus.findOne();
    if (!bus) {
        bus = await Bus.create({
            ownerId: new mongoose.Types.ObjectId(),
            busName: 'Test Bus',
            chassisNumber: 'TEST1234',
            busType: 'AC Sleeper',
            capacity: 40,
            amenities: [],
            seatLayout: [],
            registrationNumber: 'DL1234'
        });
    }

    const pkg = new YatraPackage({
      ownerId: new mongoose.Types.ObjectId(),
      busId: bus._id,
      title: 'Kumbh Mela Special Yatra',
      description: 'A test yatra package',
      category: 'religious',
      highlights: [],
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      departurePoint: {
        city: 'Delhi',
        address: 'Test',
        time: '10:00 AM'
      },
      pickupPoints: [],
      itinerary: [],
      inclusions: [],
      exclusions: [],
      pricePerPerson: 2500,
      totalSeats: 35,
      destinationCity: 'Prayagraj',
      contactPhone: '9876543210',
      images: [],
      status: 'active'
    });

    await pkg.save();
    console.log('Package created:', pkg._id);
    
    const booking = new YatraBooking({
      packageId: pkg._id,
      customerId: customerId,
      passengers: [{
          name: 'Test User',
          age: 30,
          gender: 'male',
          idProofType: 'aadhar',
          idProofNumber: '123456789012'
      }],
      seatsBooked: 1,
      pricePerPerson: 2500,
      totalAmount: 2500,
      status: 'confirmed',
      paymentStatus: 'paid'
    });
    
    await booking.save();
    console.log('Booking created:', booking._id);
    
  } catch (err) {
    console.error('Error:', err.message);
  }

  mongoose.disconnect();
});
