// ==================== models/ServiceRequest.js ====================
const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  serviceType: {
    type: String,
    enum: ['Driver', 'Taxi', 'Hotel', 'Photographer', 'Event Organizer', 'Hall/Garden', 'Other'],
    required: true
  },
  location: {
    type: String,
    required: true
  },
  date: {
    type: Date
  },
  budget: {
    type: String
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'in_chat', 'closed'],
    default: 'open'
  }
}, { timestamps: true });

serviceRequestSchema.index({ serviceType: 1, location: 1, status: 1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
