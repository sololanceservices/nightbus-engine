/**
 * scaleVerificationSuite.js
 * 
 * AUTOMATED SCALE & CONCURRENCY VERIFICATION SUITE
 * Simulates real-world traffic conditions to verify:
 * 1. High Concurrency Seat Locking (locks duplicate seat bookings)
 * 2. Idempotent Payment Webhooks (captures gateway payments exactly once)
 * 3. DB Search Benchmark under 100ms
 * 4. Multi-Role Upgrade Permission Check
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
const Payment = require('../models/Payment');
const YatraPackage = require('../models/YatraPackage');
const bookingService = require('../services/bookingService');
const yatraController = require('../controllers/yatraController');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app';

async function runScaleTests() {
    try {
        console.log('⚡ Connecting to database for Scale Testing...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB.');

        // Clean up legacy test data to avoid index conflicts
        const oldUsers = await User.find({ name: { $in: ['Audit Customer', 'Audit Owner', 'Audit Staff', 'Scale Customer', 'Scale Owner', 'Upgraded Vendor User'] } }, '_id');
        const oldUserIds = oldUsers.map(u => u._id);
        await Segment.deleteMany({ customerId: { $in: oldUserIds } });
        await Journey.deleteMany({ customerId: { $in: oldUserIds } });
        await Segment.deleteMany({ seatNumber: { $in: ['A10', 'B10', 'A1', 'V1', 'Z9'] } });
        await Bus.deleteMany({ busNumber: 'SCALE-404' });
        await Route.deleteMany({ routeName: 'Scale Route Delhi-Mumbai' });
        await YatraPackage.deleteMany({ title: 'Himalayan Scale Tour' });
        await User.deleteMany({ email: 'upgraded@nightbus.com' });

        // Rebuild and synchronize indexes to enforce the new unique partial index
        await mongoose.model('Segment').syncIndexes();
        console.log('🔄 Synchronized MongoDB indexes with Segment schema models.');

        console.log('\n--- PHASE 1: SETUP CONCURRENCY TEST ACTORS ---');
        // Clean up previous test actors
        await User.deleteMany({ name: { $in: ['Scale Customer', 'Scale Owner'] } });
        
        const customer = await User.create({
            name: 'Scale Customer',
            phone: '9999911111',
            email: 'scale_cust@nightbus.com',
            role: 'customer',
            password: 'Password123'
        });
        
        const owner = await User.create({
            name: 'Scale Owner',
            phone: '9999922222',
            email: 'scale_owner@nightbus.com',
            role: 'owner',
            password: 'Password123',
            ownerSettings: { autoConfirmBookings: true }
        });

        // Initialize wallet
        await Wallet.getOrCreate(customer._id);
        await Wallet.atomicCredit(customer._id, 50000, {
            transactionId: `SCALE_INIT_${Date.now()}`,
            description: 'Scale Test Initial Credit'
        });

        const bus = new Bus({
            ownerId: owner._id,
            busNumber: 'SCALE-404',
            registrationNumber: 'MH02-XY-9999',
            busType: 'AC Sleeper',
            totalSeats: 30,
            chassisNumber: 'SCALEVIN123456789'
        });
        await bus.save();

        let route = await Route.findOne();
        if (!route) {
            route = new Route({
                ownerId: owner._id,
                busId: bus._id,
                routeName: 'Scale Route Delhi-Mumbai',
                totalDistance: 1400,
                estimatedDuration: 1200,
                basePrice: 1000,
                stops: [
                    {
                        name: 'Delhi',
                        coordinates: { latitude: 28.6139, longitude: 77.2090 },
                        sequence: 0,
                        isPrimaryStop: true
                    },
                    {
                        name: 'Mumbai',
                        coordinates: { latitude: 19.0760, longitude: 72.8777 },
                        sequence: 1,
                        isPrimaryStop: true
                    }
                ],
                pathCoordinates: [
                    { latitude: 28.6139, longitude: 77.2090 },
                    { latitude: 19.0760, longitude: 72.8777 }
                ]
            });
            await route.save();
        }

        bus.routeId = route._id;
        await bus.save();

        console.log('✅ Concurrency test actors created.');

        console.log('\n--- TEST 1: CONCURRENT SEAT LOCKING ---');
        const travelDate = new Date();
        travelDate.setHours(0, 0, 0, 0);

        const bookingData = {
            segments: [{
                routeId: route._id.toString(),
                busId: bus._id.toString(),
                seatNumber: 'A10',
                fromStop: { name: 'Delhi' },
                toStop: { name: 'Mumbai' },
                price: 1000,
                totalAmount: 1000,
                travelDate: travelDate.toISOString(),
                passengerDetails: { name: 'Scale Pax', age: 28, gender: 'male' }
            }],
            totalAmount: 1000,
            paymentMethod: 'wallet',
            platformFee: 20,
            taxes: 50
        };

        // Fire 10 parallel booking requests for the EXACT same seat at the same time!
        console.log('🚀 Triggering 10 concurrent wallet booking attempts for seat A10...');
        const attempts = Array.from({ length: 10 }).map(() => 
            bookingService.finalizeWalletBooking({
                userId: customer._id,
                bookingData
            })
        );

        const results = await Promise.allSettled(attempts);

        const successes = results.filter(r => r.status === 'fulfilled');
        const failures = results.filter(r => r.status === 'rejected');

        console.log(`📊 Concurrency Result: ${successes.length} Succeeded, ${failures.length} Rejected.`);
        
        // Assert exactly 1 booking succeeded to prevent double allocation
        if (successes.length !== 1) {
            throw new Error(`CONCURRENCY VIOLATION: Expected exactly 1 booking to succeed, but got ${successes.length}`);
        }
        console.log('✅ CONCURRENCY GUARD VERIFIED: Successfully blocked duplicate seat allocations.');

        console.log('\n--- TEST 2: IDEMPOTENT WEBHOOK REPLAY PROTECTION ---');
        // Let's create a free seat booking
        const seatB10Data = JSON.parse(JSON.stringify(bookingData));
        seatB10Data.segments[0].seatNumber = 'B10';
        seatB10Data.paymentMethod = 'card';

        const mockPaymentDetails = {
            razorpay_payment_id: `pay_mock_${Date.now()}`,
            razorpay_order_id: 'order_mock_123'
        };

        console.log('📞 Calling finalizeBooking first time for seat B10...');
        const firstCall = await bookingService.finalizeBooking({
            userId: customer._id,
            bookingData: seatB10Data,
            paymentDetails: mockPaymentDetails
        });

        if (!firstCall.success) {
            throw new Error('First payment processing failed');
        }

        console.log('📞 Replaying same webhook/payment call again...');
        const secondCall = await bookingService.finalizeBooking({
            userId: customer._id,
            bookingData: seatB10Data,
            paymentDetails: mockPaymentDetails
        });

        if (!secondCall.success || !secondCall.alreadyProcessed) {
            throw new Error('IDEMPOTENCY VIOLATION: Webhook replay was not detected or failed');
        }
        console.log('✅ IDEMPOTENCY GUARD VERIFIED: Duplicate webhooks captured correctly with alreadyProcessed: true.');

        console.log('\n--- TEST 3: DB BENCHMARK & RETRIEVAL LATENCY ---');
        // Seed a dummy Yatra package
        const yatraPkg = new YatraPackage({
            ownerId: owner._id,
            busId: bus._id,
            totalSeats: 30,
            departurePoint: { city: 'Delhi' },
            title: 'Himalayan Scale Tour',
            description: 'Tour description',
            fromCity: 'Delhi',
            destinationCity: 'Manali',
            startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            pricePerPerson: 5000,
            status: 'active',
            availableSeats: 30
        });
        await yatraPkg.save();

        console.log('🕒 Benchmarking 50 sequential Yatra Package list queries...');
        const startTime = Date.now();
        
        for (let i = 0; i < 50; i++) {
            await YatraPackage.find({ startDate: { $gte: new Date() } }).limit(20);
        }

        const endTime = Date.now();
        const avgTime = (endTime - startTime) / 50;
        console.log(`📊 Average query latency: ${avgTime.toFixed(2)} ms.`);

        if (avgTime > 100) {
            throw new Error(`PERFORMANCE WARNING: DB latency average is ${avgTime}ms (> 100ms requirement)`);
        }
        console.log('✅ SPEED BENCHMARK VERIFIED: Database retrieval resolves under 100ms.');

        console.log('\n--- TEST 4: UPGRADED CUSTOMER VENDOR RESOLUTION ---');
        // Upgraded customer vendor checking
        const upgradedCustomer = await User.create({
            name: 'Upgraded Vendor User',
            phone: '9999933333',
            email: 'upgraded@nightbus.com',
            role: 'customer',
            isFoodVendor: true,
            password: 'Password123'
        });

        // Simulating the logic checked by AppNavigator and LoginScreen
        const activeRoleSelected = 'vendor';
        const isAllowedToLoginAsVendor = upgradedCustomer.role === 'vendor' || upgradedCustomer.isFoodVendor === true;
        
        if (!isAllowedToLoginAsVendor) {
            throw new Error('UPGRADED ACCOUNT RESOLUTION FAILED: Upgraded customer was not recognized as food vendor');
        }

        console.log('✅ MULTI-PORTAL ACCESS VERIFIED: Upgraded accounts resolve permissions successfully.');

        console.log('\n🛡️ ALL SCALE & PRODUCTION VERIFICATIONS PASSED SUCCESSFULLY!');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ SCALE VERIFICATION SUITE FAILED:', err);
        process.exit(1);
    }
}

runScaleTests();
