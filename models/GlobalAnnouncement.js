// ==================== models/GlobalAnnouncement.js ====================
const mongoose = require('mongoose');

const globalAnnouncementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true
  },
  targetRoles: {
    type: [String],
    enum: ['customer', 'owner', 'staff', 'vendor', 'admin', 'all'],
    default: ['all']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'medium'
  },
  isSticky: {
    type: Boolean,
    default: false // Stays at top of feed
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Index for efficient fetching on app start
globalAnnouncementSchema.index({ isActive: 1, targetRoles: 1, createdAt: -1 });

module.exports = mongoose.model('GlobalAnnouncement', globalAnnouncementSchema);
