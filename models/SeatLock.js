// ==================== models/SeatLock.js ====================
const mongoose = require('mongoose');

const seatLockSchema = new mongoose.Schema({
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true
  },
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: true
  },
  travelDate: {
    type: Date,
    required: true
  },
  seatNumber: {
    type: String,
    required: true
  },
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lockExpiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  },
  status: {
    type: String,
    enum: ["locked", "released", "confirmed"],
    default: "locked"
  },
  segmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Segment'
  }
}, { timestamps: true });

// Compound unique index - one seat per bus per date
seatLockSchema.index({ busId: 1, travelDate: 1, seatNumber: 1, status: 1 });
seatLockSchema.index({ lockExpiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

module.exports = mongoose.model('SeatLock', seatLockSchema);
