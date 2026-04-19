const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'cancelled'],
    default: 'pending',
    index: true
  },
  period: {
    start: Date,
    end: Date
  },
  bookingsCount: Number,
  transactionId: String, // Final payment transaction ID
  paidAt: Date,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin who processed this
  },
  notes: String,
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

settlementSchema.index({ ownerId: 1, status: 1 });
settlementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Settlement', settlementSchema);
