
const mongoose = require('mongoose');
const { sendNotification } = require('../utils/notifications');
const User = require('../models/User');
require('dotenv').config();

async function testPushToSpecificUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📡 Connected to MongoDB');

        const userId = '698c1afa493735be635d55e4'; // Amit Kumar
        const user = await User.findById(userId);

        if (!user) {
            console.error('❌ User not found');
            return;
        }

        console.log(`🧪 Triggering test push for ${user.name} (${user.role})...`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Token: ${user.fcmToken}`);

        const notification = await sendNotification(userId, {
            title: "Direct Test",
            body: "This is a direct test to your device. Time: " + new Date().toLocaleTimeString(),
            type: "system_alert",
            data: { isDebug: "true" }
        });

        if (notification) {
            console.log('✅ Notification queued and sent attempt finished.');
        } else {
            console.log('❌ Failed to create notification object.');
        }

    } catch (error) {
        console.error('💥 Crash in test script:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected');
    }
}

testPushToSpecificUser();
