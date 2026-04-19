const mongoose = require('mongoose');
const Route = require('../models/Route');
const Location = require('../models/Location');

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

async function seedLocations() {
    try {
        console.log('🔄 Starting location seeding...');

        // 1. Get all routes
        const routes = await Route.find({}).select('stops');
        console.log(`📦 Found ${routes.length} routes to process`);

        const locationsMap = new Map();

        // 2. Extract unique locations
        routes.forEach(route => {
            route.stops.forEach(stop => {
                if (stop.name) {
                    const normalizedName = stop.name.trim();
                    const key = normalizedName.toLowerCase();

                    if (!locationsMap.has(key)) {
                        locationsMap.set(key, {
                            name: normalizedName,
                            state: stop.state || 'Unknown',
                            district: stop.district,
                            type: stop.stopType === 'village' ? 'village' : 'city',
                            coordinates: stop.coordinates,
                            popularity: 0
                        });
                    }

                    // Increment popularity based on usage
                    locationsMap.get(key).popularity += 1;
                }
            });
        });

        console.log(`📍 Found ${locationsMap.size} unique locations`);

        // 3. Upsert into Location collection
        let added = 0;
        let updated = 0;

        for (const loc of locationsMap.values()) {
            const result = await Location.updateOne(
                { name: loc.name }, // Match by name (case sensitive for now, but name is normalized from source)
                {
                    $set: loc,
                    $setOnInsert: { aliases: [] }
                },
                { upsert: true }
            );

            if (result.upsertedCount > 0) added++;
            else updated++;
        }

        console.log(`✅ Seeding complete:`);
        console.log(`   - Added: ${added}`);
        console.log(`   - Updated: ${updated}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

seedLocations();
