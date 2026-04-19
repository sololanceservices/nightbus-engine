// ==================== models/Chat.js ====================
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { _id: true }); // keep _id for individual messages

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  contextType: {
    type: String,
    enum: ['service', 'rental', 'food', 'support'],
    required: true
  },
  contextId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  messages: [messageSchema],
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'locked', 'closed'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
chatSchema.index({ participants: 1 });
chatSchema.index({ contextType: 1, contextId: 1 });
chatSchema.index({ lastMessageAt: -1 });
// Prevent duplicate chats for the same participants + context
chatSchema.index(
  { participants: 1, contextType: 1, contextId: 1 },
  { unique: true, partialFilterExpression: { contextId: { $exists: true } } }
);

module.exports = mongoose.model('Chat', chatSchema);
