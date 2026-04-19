const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const notificationUtils = require('../utils/notifications');
const notificationController = require('../controllers/notificationController');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_app';

// Mock Req/Res
const mockReq = (user, body = {}, query = {}, params = {}) => ({ user, body, query, params });
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

async function verify() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Find a test user
        let user = await User.findOne({ role: 'customer' });
        if (!user) {
            console.log('⚠️ No customer user found. Creating one...');
            user = await User.create({
                name: 'Test User',
                email: `test${Date.now()}@example.com`,
                phone: '9999999999',
                password: 'password123',
                role: 'customer'
            });
        }
        console.log(`👤 Using test user: ${user.name} (${user._id})`);

        // 2. Test sendNotification Utility
        console.log('\n📨 Testing sendNotification utility...');
        await notificationUtils.sendNotification(user._id, {
            title: 'Test Notification',
            body: 'This is a test notification from verification script',
            type: 'system_update',
            data: { test: true }
        });

        // 2.5 Test getUnreadCount
        console.log('\n🔢 Testing getUnreadCount...');
        const reqUnread = mockReq(user);
        const resUnread = mockRes();
        await notificationController.getUnreadCount(reqUnread, resUnread);

        if (resUnread.data.success && typeof resUnread.data.count === 'number') {
            console.log(`✅ Unread count: ${resUnread.data.count}`);
        } else {
            console.error('❌ Failed to get unread count:', resUnread.data);
        }

        // 3. Test getUserNotifications Controller
        console.log('\n📥 Testing getUserNotifications controller...');
        const req1 = mockReq(user, {}, { limit: 5 });
        const res1 = mockRes();
        await notificationController.getUserNotifications(req1, res1);

        if (res1.data.success && res1.data.notifications.length > 0) {
            console.log(`✅ Fetched ${res1.data.notifications.length} notifications.`);
            const latest = res1.data.notifications[0];
            console.log(`   Latest: "${latest.title}" (${latest.body})`);

            // 4. Test markAsRead
            console.log('\n👀 Testing markAsRead...');
            const req2 = mockReq(user, {}, {}, { id: latest._id });
            const res2 = mockRes();
            await notificationController.markAsRead(req2, res2);

            if (res2.data.success && res2.data.notification.status === 'read') {
                console.log('✅ Notification marked as read.');
            } else {
                console.error('❌ Failed to mark as read:', res2.data);
            }

        } else {
            console.error('❌ Failed to fetch notifications:', res1.data);
        }

        // 5. Test Broadcast (Admin)
        console.log('\n📢 Testing Admin Broadcast...');
        const adminReq = mockReq({ ...user.toObject(), role: 'admin' }, { // Mock admin user
            title: 'Broadcast Alert',
            message: 'This is a broadcast for all users',
            type: 'admin_alert',
            isBroadcast: true
        });
        const adminRes = mockRes();
        await notificationController.sendNotification(adminReq, adminRes);

        if (adminRes.data.success) {
            console.log('✅ Broadcast sent successfully.');
        } else {
            console.error('❌ Broadcast failed:', adminRes.data);
        }

        console.log('\n🎉 Verification Complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verify();
