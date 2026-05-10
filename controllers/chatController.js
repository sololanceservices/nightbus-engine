// ==================== controllers/chatController.js ====================
const Chat = require('../models/Chat');
const Notification = require('../models/Notification');
const RentalRequest = require('../models/RentalRequest');
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const mongoose = require('mongoose');

// Helper: emit an in-app notification to a user
const emitNotification = async (userId, type, title, body, referenceId) => {
  try {
    await Notification.create({
      userId,
      type,
      title,
      body,
      referenceId,
      referenceType: 'other',
      sentVia: 'in-app'
    });
  } catch (err) {
    console.error('Non-critical: Notification creation failed:', err.message);
  }
};

// Helper: update linked request status to 'in_chat'
const markRequestInChat = async (contextType, contextId) => {
  try {
    if (contextType === 'rental') {
      await RentalRequest.findByIdAndUpdate(contextId, { status: 'in_chat' });
    } else if (contextType === 'service') {
      await ServiceRequest.findByIdAndUpdate(contextId, { status: 'in_chat' });
    }
  } catch (err) {
    console.error('Non-critical: Request status update failed:', err.message);
  }
};

exports.getOrCreateChat = async (req, res) => {
  try {
    const { contactId, contextType, contextId } = req.body;
    const userId = req.user.id;

    if (!contactId) {
      return res.status(400).json({ success: false, message: 'Contact ID is required' });
    }

    // Normalize participant order for index consistency
    const participants = [userId, contactId].sort();

    // Find an existing chat for the same participants + context
    let chat = await Chat.findOne({
      participants: { $all: participants },
      contextType: contextType || 'support',
      contextId: contextId || contactId
    }).populate('participants', 'name profilePicture role serviceType phone');

    if (!chat) {
      chat = new Chat({
        participants,
        contextType: contextType || 'support',
        contextId: contextId || contactId,
        status: 'active',
        messages: []
      });
      await chat.save();

      // Transition linked request to in_chat state
      if (contextType && contextId) {
        await markRequestInChat(contextType, contextId);
      }

      chat = await Chat.findById(chat._id)
        .populate('participants', 'name profilePicture role serviceType phone');
    }

    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    // Handle duplicate key gracefully (race condition)
    if (error.code === 11000) {
      const chat = await Chat.findOne({
        participants: { $all: [req.user.id, req.body.contactId] },
        contextType: req.body.contextType || 'support'
      }).populate('participants', 'name profilePicture role serviceType phone');
      return res.status(200).json({ success: true, data: chat });
    }
    console.error('Error in getOrCreateChat:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message } = req.body;
    const senderId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content required' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    // Status gate: block messages in locked/closed chats
    if (chat.status === 'locked' || chat.status === 'closed') {
      return res.status(403).json({
        success: false,
        message: `This conversation is ${chat.status} and no longer accepts messages.`
      });
    }

    if (!chat.participants.map(p => p.toString()).includes(senderId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this chat' });
    }

    const newMessage = {
      senderId,
      message: message.trim(),
      timestamp: new Date()
    };

    chat.messages.push(newMessage);
    chat.lastMessageAt = new Date();
    await chat.save();

    // Notify the OTHER participant
    const recipientId = chat.participants.find(p => p.toString() !== senderId);
    if (recipientId) {
      const sender = await User.findById(senderId).select('name');
      await emitNotification(
        recipientId,
        'new_chat_message',
        `New message from ${sender?.name || 'Someone'}`,
        message.trim().substring(0, 100),
        chat._id
      );
    }

    res.status(200).json({ success: true, data: newMessage, chatId });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateChatStatus = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const allowed = ['active', 'locked', 'closed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });

    if (!chat.participants.map(p => p.toString()).includes(userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    chat.status = status;

    // If agreed, mark linked rental request as agreed
    if (status === 'locked' && chat.contextType === 'rental') {
      await RentalRequest.findByIdAndUpdate(chat.contextId, { status: 'agreed' });
    }

    await chat.save();
    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    console.error('Error updating chat status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getUserChats = async (req, res) => {
  try {
    const userId = req.user.id;
    const chats = await Chat.find({ participants: userId })
      .populate('participants', 'name profilePicture role serviceType phone')
      .sort('-lastMessageAt')
      .select('-messages');

    res.status(200).json({ success: true, data: chats });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const chat = await Chat.findById(chatId)
      .populate('participants', 'name profilePicture role serviceType phone');

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    if (!chat.participants.some(p => p._id.toString() === userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Paginate messages: most recent first
    const allMessages = chat.messages.sort((a, b) => b.timestamp - a.timestamp);
    const total = allMessages.length;
    const paginatedMessages = allMessages.slice((page - 1) * limit, page * limit);

    res.status(200).json({
      success: true,
      data: {
        ...chat.toObject(),
        messages: paginatedMessages.reverse(), // restore chronological order
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getOrCreateSupportChat = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Find a support admin
    let supportAdmin = await User.findOne({ role: 'admin', adminRole: 'support', isActive: true });
    
    // 2. Fallback to any admin if no specific support admin
    if (!supportAdmin) {
      supportAdmin = await User.findOne({ role: 'admin', isActive: true });
    }

    // 3. Fallback to owner if no admin (should not happen in prod but for dev)
    if (!supportAdmin) {
      // For development/testing: If NO admin exists in the entire system, create one
      const anyUser = await User.findOne();
      if (!anyUser) {
        // Truly empty DB - create System Admin
        supportAdmin = new User({
          phone: '9999999999',
          name: 'System Support',
          role: 'admin',
          adminRole: 'support',
          isActive: true,
          isVerified: true
        });
        await supportAdmin.save();
      } else {
        // Use the first available user as support if no admin exists (Safety fallback)
        supportAdmin = await User.findOne({ isActive: true });
      }
    }

    if (!supportAdmin) {
      return res.status(404).json({ success: false, message: 'Support team is currently offline' });
    }

    // Reuse getOrCreateChat logic
    const contactId = supportAdmin._id;
    const participants = [userId, contactId].sort();

    let chat = await Chat.findOne({
      participants: { $all: participants },
      contextType: 'support',
      contextId: contactId
    }).populate('participants', 'name profilePicture role serviceType phone');

    if (!chat) {
      chat = new Chat({
        participants,
        contextType: 'support',
        contextId: contactId, // Use admin ID as context for support channel
        status: 'active',
        messages: [{
          senderId: contactId,
          message: `Hello! I'm ${supportAdmin.name} from NightBus Support. How can we help you today?`,
          timestamp: new Date()
        }]
      });
      await chat.save();
      chat = await Chat.findById(chat._id).populate('participants', 'name profilePicture role serviceType phone');
    }

    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    console.error('Error in getOrCreateSupportChat:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
