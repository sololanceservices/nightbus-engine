// ==================== models/RentalRequest.js ====================
const mongoose = require('mongoose');

const rentalRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  occasion: {
    type: String,
    enum: ['Marriage', 'Party', 'Educational/Student', 'Function', 'Religious', 'Picnic', 'Other'],
    required: true
  },
  vehicleType: {
    type: String, // e.g., 'Bus', 'Car', 'Specific model'
    required: true
  },
  budgetMin: {
    type: Number,
    required: true,
    min: 0
  },
  budgetMax: {
    type: Number,
    required: true,
    min: 0
  },
  peopleCount: {
    type: Number,
    default: 0
  },
  note: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['open', 'in_chat', 'agreed', 'completed', 'cancelled'],
    default: 'open',
    index: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes for faster querying by owners
rentalRequestSchema.index({ status: 1, date: 1 });
rentalRequestSchema.index({ from: 'text', to: 'text' });

module.exports = mongoose.model('RentalRequest', rentalRequestSchema);
