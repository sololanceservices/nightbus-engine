const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app';

async function debugTokens() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('🔍 Checking User FCM Tokens...\n');

        const users = await User.find({
            $or: [
                { fcmToken: { $exists: true, $ne: null } },
                { fcmTokens: { $exists: true, $not: { $size: 0 } } }
            ]
        });

        if (users.length === 0) {
            console.log('ℹ️ No users found with FCM tokens.');
        }

        for (const user of users) {
            console.log(`👤 User: ${user.name} (${user.role})`);
            console.log(`   ID: ${user._id}`);
            console.log(`   fcmToken (legacy): ${user.fcmToken || 'None'}`);
            console.log(`   fcmTokens (array): ${JSON.stringify(user.fcmTokens || [])}`);

            const hasFake = (user.fcmToken && user.fcmToken.includes('faked')) ||
                (user.fcmTokens && user.fcmTokens.some(t => t.includes('faked')));

            if (hasFake) {
                console.log('   ⚠️ Found FAKE tokens! Cleaning up...');
                user.fcmTokens = (user.fcmTokens || []).filter(t => !t.includes('faked'));
                if (user.fcmToken && user.fcmToken.includes('faked')) {
                    user.fcmToken = user.fcmTokens.length > 0 ? user.fcmTokens[0] : undefined;
                }
                await user.save();
                console.log('   ✅ Cleaned.');
            }
            console.log('-----------------------------------');
        }

        console.log('\n🌟 Diagnostic Complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

debugTokens();
