const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Wallet = require('../models/Wallet');
const User = require('../models/User');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app';

async function seedWallet() {
    try {
        const args = process.argv.slice(2);
        const identifier = args[0]; // Email, Phone or ID
        const amount = parseFloat(args[1]);

        if (!identifier || isNaN(amount)) {
            console.log('❌ Usage: node server/scripts/seedWallet.js <email|phone|id> <amount>');
            process.exit(1);
        }

        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find user
        let user;
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            user = await User.findById(identifier);
        } else {
            user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
        }

        if (!user) {
            console.log(`❌ User not found: ${identifier}`);
            process.exit(1);
        }

        console.log(`👤 Found user: ${user.name} (${user.email || user.phone})`);

        // Ensure wallet exists
        await Wallet.getOrCreate(user._id);

        // Credit money
        const transactionId = `SEED_${Date.now()}`;
        const result = await Wallet.atomicCredit(user._id, amount, {
            transactionId,
            source: 'manual',
            description: `Test seed: Added ₹${amount}`
        });

        if (result.success) {
            console.log(`💰 Added ₹${amount} to wallet.`);
            console.log(`📊 New Balance: ₹${result.wallet.balance}`);
        } else {
            console.log('❌ Failed to credit wallet');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding wallet:', error.message);
        process.exit(1);
    }
}

seedWallet();
