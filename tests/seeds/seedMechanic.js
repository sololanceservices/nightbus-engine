// seedMechanic.js
const mongoose = require('mongoose');
require('dotenv').config();
const ServiceCategory = require('./models/ServiceCategory');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to DB');

    const existing = await ServiceCategory.findOne({ name: 'Mechanic' });
    if (!existing) {
      await ServiceCategory.create({
        name: 'Mechanic',
        icon: 'wrench',
        description: 'Find bus mechanics and repair services'
      });
      console.log('Mechanic category added successfully!');
    } else {
      console.log('Mechanic category already exists.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

seed();
