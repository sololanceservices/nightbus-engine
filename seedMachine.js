// seedMachine.js
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

    const existing = await ServiceCategory.findOne({ name: 'Machine' });
    if (!existing) {
      await ServiceCategory.create({
        name: 'Machine',
        icon: 'cog',
        description: 'Find bus machinery, parts, and heavy equipment'
      });
      console.log('Machine category added successfully!');
    } else {
      console.log('Machine category already exists.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

seed();
