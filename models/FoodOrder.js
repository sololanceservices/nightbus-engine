// ==================== models/FoodOrder.js ====================
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodItem', required: true },
  name: String,
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  prepTime: Number
}, { _id: false });

const foodOrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoodVendor',
    required: true,
    index: true
  },
  journeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TripTimeline', // Maps to the bus journey if in smart mode
    index: true
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  deliveryLocation: {
    type: String, // String describing address or "Stop Name - Seat Number"
    required: true
  },
  deliveryCoordinates: {
    latitude: Number,
    longitude: Number
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'preparing', 'ready', 'delivered', 'cancelled'],
    default: 'pending',
    index: true
  },
  cancellationFee: {
    type: Number,
    default: 0
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  orderMode: {
    type: String,
    enum: ['normal', 'smart'],
    default: 'normal'
  },
  targetDeliveryTime: Date, // Needed for smart mode matching
  deliveryOtp: {
    type: String,
    length: 4 // e.g., '4928'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'settled'],
    default: 'pending'
  },
  notes: String,
  pnrNumber: String // PNR linked to this order for vendor tracking
}, { timestamps: true });

module.exports = mongoose.model('FoodOrder', foodOrderSchema);
