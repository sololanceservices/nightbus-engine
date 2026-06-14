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
  participantsHash: {
    type: String,
    default: function() {
      if (this.participants && this.participants.length > 0) {
        return this.participants.map(p => p.toString()).sort().join('_');
      }
      return '';
    }
  },
  contextType: {
    type: String,
    enum: ['service', 'rental', 'food', 'food_order', 'support'],
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

// Sync participantsHash pre-save
chatSchema.pre('save', function (next) {
  if (this.participants && this.participants.length > 0) {
    this.participantsHash = this.participants.map(p => p.toString()).sort().join('_');
  }
  next();
});

// Indexes for efficient querying
chatSchema.index({ participants: 1 });
chatSchema.index({ contextType: 1, contextId: 1 });
chatSchema.index({ lastMessageAt: -1 });
chatSchema.index({ participantsHash: 1 });

// Prevent duplicate chats for the same combination of participants + context using the plain string hash (avoids multikey unique index collision)
chatSchema.index(
  { participantsHash: 1, contextType: 1, contextId: 1 },
  { unique: true, partialFilterExpression: { contextId: { $exists: true } } }
);

const Chat = mongoose.model('Chat', chatSchema);

// Async database index cleanup & data migration
setTimeout(async () => {
  try {
    // 1. Drop the old unique multikey index that causes collisions
    await Chat.collection.dropIndex('participants_1_contextType_1_contextId_1').catch(() => {
      // Ignore if index doesn't exist
    });

    // 2. Migrate existing chats to populate participantsHash
    const chats = await Chat.find({ participantsHash: { $exists: false } });
    if (chats.length > 0) {
      console.log(`🧹 Migrating ${chats.length} chats to add participantsHash...`);
      for (const chat of chats) {
        const hash = chat.participants.map(p => p.toString()).sort().join('_');
        await Chat.updateOne({ _id: chat._id }, { $set: { participantsHash: hash } });
      }
      console.log('✅ Chat migration completed.');
    }
  } catch (err) {
    console.error('⚠️ Chat collection migration error:', err.message);
  }
}, 2000);

module.exports = Chat;
