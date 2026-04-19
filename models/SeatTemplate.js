// ==================== models/SeatTemplate.js ====================
const mongoose = require('mongoose');

const seatTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  layout: {
    rows: {
      type: Number,
      required: true
    },
    seatsPerRow: {
      type: Number,
      required: true
    },
    seatMap: {
      type: Map,
      of: {
        row: Number,
        col: Number,
        type: {
          type: String,
          enum: ["window", "aisle", "middle"],
          default: "middle"
        },
        gender: {
          type: String,
          enum: ["male", "female", "any"],
          default: "any"
        }
      }
    }
  },
  totalSeats: {
    type: Number,
    required: true
  },
  description: String,
  busType: {
    type: String,
    enum: ['AC', 'Non-AC', 'Sleeper', 'Seater', 'Semi-Sleeper'],
    default: 'Seater'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

seatTemplateSchema.index({ createdBy: 1, isActive: 1 });

module.exports = mongoose.model('SeatTemplate', seatTemplateSchema);
