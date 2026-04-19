
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
require('dotenv').config();

async function checkRecentNotifications() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📡 Connected to MongoDB');

        const recentDays = 1;
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - recentDays);

        const notifications = await Notification.find({
            createdAt: { $gte: sinceDate }
        }).sort({ createdAt: -1 }).limit(10).populate('userId', 'name phone fcmToken fcmTokens');

        console.log(`\n🔔 Recent Notifications (Last ${recentDays} day):`);
        if (notifications.length === 0) {
            console.log('No recent notifications found.');
        }

        notifications.forEach((n, i) => {
            console.log(`\n[${i + 1}] ${n.title}`);
            console.log(`    User: ${n.userId?.name} (${n.userId?._id})`);
            console.log(`    Phone: ${n.userId?.phone}`);
            console.log(`    Status: ${n.status}`);
            console.log(`    Time: ${n.createdAt.toLocaleString()}`);
            console.log(`    Token count: ${n.userId?.fcmTokens?.length || 0}`);
            console.log(`    Type: ${n.type}`);
        });

    } catch (error) {
        console.error('💥 Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkRecentNotifications();
