// ==================== models/Notification.js ====================
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      "seat_confirmation_request",
      "seat_confirmed",
      "seat_rejected",
      "boarding_reminder",
      "journey_cancelled",
      "payment_failed",
      "payment_success",
      "vendor_order",
      "vendor_accepted",
      "vendor_ready",
      "refund_initiated",
      "refund_completed",
      "admin_alert",
      "system_update",
      "booking_confirmed",
      "boarding_confirmed",
      "passenger_boarded",
      "system_alert",
      "journey_completed",
      "booking_cancelled",
      "seat_confirmation",
      "bus_update",
      "delay",
      "general",
      "admin_msg",
      "bus_location",
      "wallet_credit",
      "wallet_debit",
      "system",
      "new_chat_message",
      "new_rental_lead",
      "new_service_lead",
      "provider_response",
      "bus_announcement"
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  deepLink: String, // Navigation link in app
  referenceId: mongoose.Schema.Types.ObjectId, // booking/segment/vendor id
  referenceType: {
    type: String,
    enum: ["journey", "segment", "vendor_order", "payment", "refund", "system", "announcement", "other"]
  },
  status: {
    type: String,
    enum: ["unread", "read", "archived"],
    default: "unread"
  },
  sentVia: {
    type: String,
    enum: ["push", "sms", "email", "in-app"],
    default: "in-app"
  },
  fcmMessageId: String,
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  readAt: Date
}, { timestamps: true });

notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ referenceId: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
