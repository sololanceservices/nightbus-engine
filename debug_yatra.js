const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const YatraBooking = require('./models/YatraBooking');
  const User = require('./models/User');

  // Find these specific bookings
  const ybs = await YatraBooking.find({ 
    bookingRef: { $in: ['YTRAAC66B', 'YTRD87002'] } 
  }).lean();
  
  console.log('Found by bookingRef:', ybs.length);
  
  if (ybs.length === 0) {
    // Try searching all bookings
    const allYbs = await YatraBooking.find({}).sort('-createdAt').limit(10).lean();
    console.log('\nAll recent yatra bookings:', allYbs.length);
    allYbs.forEach(b => console.log(' - ref:', b.bookingRef, '| customerId:', b.customerId, '| status:', b.status));
  } else {
    for (const b of ybs) {
      console.log('customerId:', b.customerId, '| ref:', b.bookingRef, '| status:', b.status);
      const user = await User.findById(b.customerId).lean();
      console.log('  -> User:', user ? `${user.name} (${user.email})` : 'NOT FOUND');
    }
  }

  process.exit(0);
}).catch(console.error);
