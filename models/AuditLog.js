// ==================== models/AuditLog.js ====================
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  action: {
    type: String,
    enum: [
      "user_created",
      "user_verified",
      "user_updated",
      "user_deleted",
      "bus_added",
      "bus_updated",
      "bus_deleted",
      "journey_published",
      "journey_cancelled",
      "booking_created",
      "seat_confirmed",
      "seat_rejected",
      "seat_locked",
      "seat_unlocked",
      "payment_captured",
      "payment_failed",
      "refund_issued",
      "refund_completed",
      "boarding_scanned",
      "exit_verified",
      "user_verified_admin",
      "data_deleted",
      "admin_override",
      "fraud_alert",
      "incident_reported"
    ],
    required: true
  },
  entityType: {
    type: String,
    enum: ["user", "bus", "route", "journey", "booking", "payment", "refund", "vendor", "staff"],
    required: true
  },
  entityId: mongoose.Schema.Types.ObjectId,
  entityName: String,
  oldData: mongoose.Schema.Types.Mixed,
  newData: mongoose.Schema.Types.Mixed,
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],
  ipAddress: String,
  userAgent: String,
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  fraudFlags: [String], // e.g., ["multiple_failed_payments", "rapid_bookings"]
  status: {
    type: String,
    enum: ["success", "failure", "warning"],
    default: "success"
  },
  description: String
}, { timestamps: true });

auditLogSchema.index({ userId: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ entityId: 1, entityType: 1 });
auditLogSchema.index({ riskScore: 1, createdAt: -1 });
auditLogSchema.index({ fraudFlags: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
