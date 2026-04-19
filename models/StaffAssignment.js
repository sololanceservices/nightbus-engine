// ==================== models/StaffAssignment.js ====================
const mongoose = require('mongoose');

const staffAssignmentSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ["driver", "conductor", "cleaner", "helper"],
    required: true
  },
  shiftDate: {
    type: Date,
    required: true
  },
  shiftStartTime: {
    type: String,
    required: true // "06:00"
  },
  shiftEndTime: {
    type: String,
    required: true // "18:00"
  },
  status: {
    type: String,
    enum: ["assigned", "started", "completed", "cancelled"],
    default: "assigned"
  },
  startedAt: Date,
  completedAt: Date,
  passengersBoarded: Number,
  passengersExited: Number,
  journeys: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Journey'
  }],
  incidents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident'
  }],
  notes: String,
  salary: Number,
  overtimeHours: Number
}, { timestamps: true });

staffAssignmentSchema.index({ staffId: 1, shiftDate: 1 });
staffAssignmentSchema.index({ busId: 1, shiftDate: 1 });
staffAssignmentSchema.index({ ownerId: 1, status: 1 });
staffAssignmentSchema.index({ shiftDate: 1, status: 1 });

module.exports = mongoose.model('StaffAssignment', staffAssignmentSchema);
