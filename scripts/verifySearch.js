const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('../models/Bus');
require('../models/Segment');
const locationController = require('../controllers/locationController');
const journeyController = require('../controllers/journeyController');

// Mock Express Request/Response
const mockReq = (body = {}, query = {}, params = {}) => ({ body, query, params });
const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app';

async function verify() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // TEST 1: Location Search (Fuzzy)
        console.log('\n🔍 Testing Location Search (Query: "del")...');
        const req1 = mockReq({}, { query: 'del' });
        const res1 = mockRes();
        await locationController.searchLocations(req1, res1);

        if (res1.data.success && res1.data.locations.length > 0) {
            console.log(`✅ Found ${res1.data.locations.length} locations matching "del":`);
            res1.data.locations.forEach(l => console.log(`   - ${l.name} (${l.state})`));
        } else {
            console.error('❌ Location search failed or no results:', res1.data);
        }

        // TEST 2: Journey Search (Direct)
        // Find two locations to test with
        const locations = res1.data.locations;
        if (locations.length >= 2) {
            // We need to find a valid route in DB normally, but let's try a broad search
            // Or finding a known route first
            const Route = require('../models/Route');
            const route = await Route.findOne({ isActive: true }).select('stops');

            if (route && route.stops.length >= 2) {
                const from = route.stops[0].name;
                const to = route.stops[route.stops.length - 1].name;
                const date = new Date().toISOString().split('T')[0];

                console.log(`\n🚌 Testing Journey Search (${from} -> ${to})...`);
                const req2 = mockReq({ from, to, date, passengers: 1 });
                const res2 = mockRes();
                await journeyController.searchJourneys(req2, res2);

                if (res2.data.success) {
                    console.log(`✅ Search successful. Found ${res2.data.count} journeys.`);
                    if (res2.data.suggestion) {
                        console.log(`   Suggestion: ${res2.data.suggestion.message}`);
                    }
                } else {
                    console.error('❌ Journey search failed:', res2.data);
                }
            } else {
                console.log('⚠️ No active routes found to test journey search.');
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verify();
