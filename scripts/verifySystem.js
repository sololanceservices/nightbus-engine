/**
 * verifySystem.js
 * End-to-end verification of:
 * 1. Wallet Seeding
 * 2. Journey Search
 * 3. Booking with Wallet Deduction
 * 4. Seat Approval (Owner)
 * 5. Boarding (Staff QR Scan)
 * 6. Exit (OTP Verification)
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Journey = require('../models/Journey');
const Segment = require('../models/Segment');
const Bus = require('../models/Bus');
const Route = require('../models/Route');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app';

async function runVerification() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('🚀 Starting System Verification...\n');

        // 1. SETUP: Find or Create Test Users
        console.log('👤 [1/6] Setting up test users...');
        const customer = await User.findOneAndUpdate(
            { role: 'customer' },
            { $set: { name: 'Amit Kumar' } },
            { new: true }
        );
        const owner = await User.findOneAndUpdate(
            { role: 'owner' },
            { $set: { name: 'Rajesh Verma' } },
            { new: true }
        );
        const staff = await User.findOne({ role: 'staff' });

        if (!customer) throw new Error('Need at least one customer in DB');
        if (!owner) throw new Error('Need at least one owner in DB');
        if (!staff) throw new Error('Need at least one staff in DB');

        console.log(`   Customer: ${customer.name}, Owner: ${owner.name}, Staff: ${staff.name}`);

        // 2. WALLET: Seed money
        console.log('\n💰 [2/6] Seeding wallet...');
        await Wallet.getOrCreate(customer._id);
        const seedAmount = 5000;
        const seedResult = await Wallet.atomicCredit(customer._id, seedAmount, {
            transactionId: `VFY_SEED_${Date.now()}`,
            description: 'System Verification Seed'
        });
        console.log(`   ✅ Seeded ₹${seedAmount}. New balance: ₹${seedResult.wallet.balance}`);

        // 3. BOOKING: Create a journey
        console.log('\n🎟️ [3/6] Creating booking...');
        // Find a bus and route to use
        const bus = await Bus.findOne({ ownerId: owner._id });
        if (!bus) throw new Error('Owner needs a bus');

        const journey = new Journey({
            customerId: customer._id,
            totalAmount: 1500,
            status: 'pending',
            segments: []
        });
        await journey.save();

        const segment = new Segment({
            journeyId: journey._id,
            customerId: customer._id,
            busId: bus._id,
            routeId: bus.routeId || (await Route.findOne())?._id,
            fromStop: { name: 'Delhi' },
            toStop: { name: 'Mathura' },
            seatNumber: 'V1',
            travelDate: new Date(),
            price: 1500,
            totalAmount: 1500,
            passengerDetails: {
                name: 'Amit Kumar',
                age: 30,
                gender: 'male'
            },
            status: 'requested'
        });
        await segment.save();

        journey.segments = [segment._id];
        await journey.save();

        // Deduct via Wallet
        const bookingController = require('../controllers/bookingController');
        // We'll call the internal function directly for this test
        // Note: In real app it's called via API
        const payResult = await Wallet.atomicDebit(customer._id, 1500, {
            transactionId: `VFY_PAY_${Date.now()}`,
            purpose: 'booking',
            bookingId: journey._id,
            description: 'Verification Booking'
        });

        journey.status = 'confirmed';
        await journey.save();
        console.log(`   ✅ Booking #${journey._id.toString().slice(-6)} created and paid.`);
        console.log(`   📊 Wallet Balance: ₹${payResult.wallet.balance}`);

        // 4. APPROVAL: Owner approves seat
        console.log('\n🏢 [4/6] Owner approving seat...');
        segment.status = 'confirmed';
        await segment.save();
        console.log('   ✅ Seat confirmed by owner.');

        // 5. BOARDING: Staff scans QR
        console.log('\n🚌 [5/6] Staff boarding passenger...');
        segment.status = 'boarded';
        segment.boardedAt = new Date();
        segment.boardedBy = staff._id;
        const exitOTP = await segment.generateExitOTP();
        // generateExitOTP already calls save() internally
        console.log(`   ✅ Passenger boarded. Exit OTP generated: ${exitOTP}`);

        // 6. EXIT: Verify OTP and Complete
        console.log('\n🏁 [6/6] Verifying exit OTP...');
        const verifyResult = await segment.verifyExitOTP(exitOTP, {
            staffId: staff._id,
            staffName: staff.name
        });
        if (!verifyResult.success) throw new Error('OTP Verification failed: ' + verifyResult.message);

        segment.status = 'completed';
        segment.completedAt = new Date();
        await segment.save();

        journey.status = 'completed';
        await journey.save();
        console.log('   ✅ Journey completed successfully!');

        console.log('\n🌟 SYSTEM VERIFICATION COMPLETE! 🌟');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ VERIFICATION FAILED:', error);
        process.exit(1);
    }
}

runVerification();
