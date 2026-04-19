// ==================== utils/notifications.js ====================
const Notification = require('../models/Notification');
const User = require('../models/User');
const firebaseApp = require('../config/firebase');

/**
 * Send notification to a specific user
 */
exports.sendNotification = async (userId, { title, body, type, data, referenceId, referenceType }) => {
  try {
    // 1. Save to Database
    const notification = new Notification({
      userId,
      title,
      body,
      type,
      referenceId: referenceId || data?.journeyId || data?.id,
      referenceType: referenceType || (type.includes('journey') ? 'journey' : 'system'),
      data,
      status: 'unread'
    });

    await notification.save();

    // 2. Emit via Socket.io (Real-time In-App)
    if (global.io) {
      // Emit to specific user room "user-{userId}"
      global.io.to(`user-${userId}`).emit('notification', {
        _id: notification._id,
        title,
        body,
        type,
        data,
        createdAt: notification.createdAt
      });
      console.log(`📡 Socket emitted to user-${userId}`);
    }

    // 3. Send Push Notification (FCM)
    // We need to fetch the user's FCM token(s)
    // Assuming User model has `fcmTokens` array or single `fcmToken`
    if (firebaseApp) {
      const user = await User.findById(userId).select('fcmTokens fcmToken');

      let tokens = [];
      if (user) {
        if (Array.isArray(user.fcmTokens) && user.fcmTokens.length > 0) {
          tokens = [...user.fcmTokens];
        }
        if (user.fcmToken && !tokens.includes(user.fcmToken)) {
          tokens.push(user.fcmToken);
        }
      }

      // Filter out empty/null tokens
      tokens = tokens.filter(t => t && t.length > 5);

      if (tokens && tokens.length > 0) {
        const message = {
          notification: {
            title,
            body
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'default',
              priority: 'high',
              sound: 'default',
              clickAction: 'OPEN_ACTIVITY_1'
            }
          },
          data: {
            type,
            referenceId: notification.referenceId?.toString() || '',
            notificationId: notification._id.toString(),
            // Convert nested objects to string if needed, or flatten
            ...Object.keys(data || {}).reduce((acc, key) => {
              acc[key] = typeof data[key] === 'object' ? JSON.stringify(data[key]) : String(data[key]);
              return acc;
            }, {})
          },
          tokens: tokens
        };

        try {
          if (tokens.length === 0) {
            console.log(`ℹ️ No FCM tokens found for user ${userId}. Skipping push.`);
            return;
          }

          let response;
          // Send to multiple tokens
          if (tokens.length === 1) {
            try {
              const res = await firebaseApp.messaging().send({ ...message, token: tokens[0], tokens: undefined });
              console.log(`📲 FCM sent to device for user ${userId}: ${res}`);
            } catch (err) {
              console.error(`❌ FCM Single Send Error for user ${userId}:`, err.message, `(Code: ${err.code})`);
              const invalidCodes = [
                'messaging/registration-token-not-registered',
                'messaging/invalid-registration-token',
                'messaging/invalid-argument',
                'messaging/registration-token-not-registered'
              ];
              if (invalidCodes.includes(err.code) || err.message.includes('not a valid FCM registration token')) {
                await User.findByIdAndUpdate(userId, { $pull: { fcmTokens: tokens[0] } });
                if (user.fcmToken === tokens[0]) {
                  await User.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });
                }
                console.log(`🗑️ Removed invalid token for user ${userId}`);
              }
            }
          } else {
            response = await firebaseApp.messaging().sendEachForMulticast(message);
            console.log(`📲 FCM sent to ${tokens.length} devices for user ${userId}. Success: ${response.successCount}, Failure: ${response.failureCount}`);

            // Cleanup invalid tokens
            if (response.failureCount > 0) {
              const tokensToRemove = [];
              response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                  const error = resp.error;
                  if (error.code === 'messaging/registration-token-not-registered' || error.code === 'messaging/invalid-registration-token') {
                    tokensToRemove.push(tokens[idx]);
                  }
                }
              });

              if (tokensToRemove.length > 0) {
                await User.findByIdAndUpdate(userId, {
                  $pull: { fcmTokens: { $in: tokensToRemove } }
                });
                console.log(`🗑️ Removed ${tokensToRemove.length} invalid tokens for user ${userId}`);
              }
            }
          }
        } catch (fcmError) {
          console.error('⚠️ General FCM Send Error:', fcmError.message);
          console.error('   Error Code:', fcmError.code);
          console.error('   User ID:', userId);
          console.error('   Tokens tried:', tokens.length);
        }
      }
    }

    console.log(`✅ Notification saved for ${userId}: ${title}`);
    return notification;

  } catch (error) {
    console.error('❌ Notification error:', error.message);
    return null;
  }
};

/**
 * Send broadcast notification to all users (or filtered by role)
 * Scalable for 100k+ users via Topics and GlobalAnnouncement model
 */
exports.sendBroadcastNotification = async ({ title, body, type, targetRoles = ['all'], adminId }) => {
  try {
    const GlobalAnnouncement = require('../models/GlobalAnnouncement');

    // 1. Create a Persistent Global Announcement (Scalable alternative to 100k individual records)
    const announcement = new GlobalAnnouncement({
      title,
      body,
      targetRoles,
      createdBy: adminId || null,
      priority: 'high'
    });
    await announcement.save();

    console.log(`📢 Created Global Announcement: ${title} for roles: ${targetRoles.join(',')}`);

    // 2. Emit to all connected sockets for real-time live users
    if (global.io) {
      global.io.emit('announcement', {
        _id: announcement._id,
        title,
        body,
        type,
        targetRoles,
        createdAt: announcement.createdAt
      });
    }

    // 3. Send Push Notification via Topics
    if (firebaseApp) {
      // Send to "all_users" topic if it's for everyone
      const topicsToSend = targetRoles.includes('all') ? ['all_users'] : targetRoles.map(role => `role_${role}`);
      
      for (const topic of topicsToSend) {
        const topicMessage = {
          notification: { title, body },
          android: {
            priority: 'high',
            notification: {
              channelId: 'announcements',
              priority: 'high',
              sound: 'default'
            }
          },
          data: {
            type: 'global_announcement',
            announcementId: announcement._id.toString()
          },
          topic: topic
        };

        try {
          const response = await firebaseApp.messaging().send(topicMessage);
          console.log(`📢 FCM Broadcast sent to topic [${topic}] successfully:`, response);
        } catch (fcmError) {
          console.error(`❌ FCM Topic [${topic}] Error:`, fcmError.message);
        }
      }
    }

    return announcement;
  } catch (error) {
    console.error('❌ Broadcast error:', error.message);
    return null;
  }
};

/**
 * Send notification to a specific topic
 */
exports.sendTopicNotification = async (topic, { title, body, type, data }) => {
  try {
    if (!firebaseApp) {
      console.warn('⚠️ Firebase app not initialized. Skipping topic push.');
      return null;
    }

    const message = {
      notification: {
        title,
        body
      },
      android: {
        priority: 'high',
        notification: {
          channelId: type === 'general' ? 'default' : type,
          priority: 'high',
          sound: 'default',
        }
      },
      data: {
        type,
        timestamp: new Date().toISOString(),
        ...Object.keys(data || {}).reduce((acc, key) => {
          acc[key] = typeof data[key] === 'object' ? JSON.stringify(data[key]) : String(data[key]);
          return acc;
        }, {})
      },
      topic: topic
    };

    const response = await firebaseApp.messaging().send(message);
    console.log(`📲 FCM Topic Notification sent to ${topic}: ${response}`);
    return response;
  } catch (error) {
    console.error(`❌ FCM Topic Error (${topic}):`, error.message);
    return null;
  }
};

module.exports = exports;

