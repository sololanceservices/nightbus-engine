// ==================== seeds/seedUsers.js ====================
// Script to seed dummy users with all roles for testing
// Run: node seeds/seedUsers.js

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

const dummyUsers = [
  {
    phone: '9876543210',
    name: 'Customer Test',
    email: 'customer@test.com',
    role: 'customer',
    age: 28,
    gender: 'male',
    language: 'en',
    isVerified: true,
    isActive: true
  },
  {
    phone: '8765432109',
    name: 'Bus Owner Test',
    email: 'owner@test.com',
    role: 'owner',
    age: 35,
    gender: 'male',
    language: 'en',
    isVerified: true,
    isActive: true,
    companyProfile: {
      companyName: 'Test Bus Company',
      gstin: '27AABCT1234A1Z0',
      address: '123 Business Street, Delhi'
    }
  },
  {
    phone: '7654321098',
    name: 'Staff Member Test',
    email: 'staff@test.com',
    role: 'staff',
    age: 32,
    gender: 'female',
    language: 'hi',
    isVerified: true,
    isActive: true
  },
  {
    phone: '6543210987',
    name: 'Vendor Test',
    email: 'vendor@test.com',
    role: 'vendor',
    age: 40,
    gender: 'male',
    language: 'en',
    isVerified: true,
    isActive: true,
    companyProfile: {
      companyName: 'Test Vendor Services',
      gstin: '27AABCU1234A1Z0',
      address: '456 Commerce Avenue, Mumbai'
    }
  },
  {
    phone: '5432109876',
    name: 'Admin Test',
    email: 'admin@test.com',
    role: 'admin',
    age: 45,
    gender: 'male',
    language: 'en',
    isVerified: true,
    isActive: true
  },
  // Additional test users for each role
  {
    phone: '4321098765',
    name: 'Customer Two',
    email: 'customer2@test.com',
    role: 'customer',
    age: 25,
    gender: 'female',
    language: 'en',
    isVerified: true,
    isActive: true
  },
  {
    phone: '3210987654',
    name: 'Owner Two',
    email: 'owner2@test.com',
    role: 'owner',
    age: 38,
    gender: 'female',
    language: 'hi',
    isVerified: true,
    isActive: true,
    companyProfile: {
      companyName: 'Premium Transport',
      gstin: '27AABCV1234A1Z0',
      address: '789 Transport Road, Bangalore'
    }
  }
];

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing users (optional - comment out to keep existing data)
    // await User.deleteMany({});
    // console.log('🗑️  Cleared existing users');

    // Insert dummy users
    const createdUsers = await User.insertMany(dummyUsers, { ordered: false });
    console.log(`✅ Created ${createdUsers.length} dummy users`);

    // Display created users
    console.log('\n📋 Created Users:');
    createdUsers.forEach((user) => {
      console.log(`  - ${user.name} (${user.role}): ${user.phone}`);
    });

    console.log('\n📱 OTP Credentials for Testing:');
    console.log('  All users use their phone number to login');
    console.log('  Use any 6-digit number as OTP in testing (e.g., 123456)');
    console.log('\n🔑 Test Accounts:');
    dummyUsers.forEach(user => {
      console.log(`  ${user.role.toUpperCase()}: Phone: ${user.phone} | Email: ${user.email}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Seed completed successfully');
    process.exit(0);
  } catch (error) {
    if (error.code === 11000) {
      console.log('⚠️  Some users already exist (duplicate key)');
      console.log('  Tip: Remove duplicate phone numbers or modify seedUsers.js');
      await mongoose.connection.close();
      process.exit(0);
    } else {
      console.error('❌ Seed error:', error.message);
      await mongoose.connection.close();
      process.exit(1);
    }
  }
};

// Run the seed
seedDatabase();
