// ==================== models/RentalService.js ====================
const mongoose = require('mongoose');

const rentalServiceSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  routeConfigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OwnerRouteConfig',
    required: true,
    index: true
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    default: null
  },
  availableDates: [{
    type: Date,
    required: true
  }],
  description: {
    type: String
  }
}, { timestamps: true });

// For matching logic
rentalServiceSchema.index({ availableDates: 1 });

rentalServiceSchema.index({ from: 1, to: 1, vehicleType: 1 });

module.exports = mongoose.model('RentalService', rentalServiceSchema);
