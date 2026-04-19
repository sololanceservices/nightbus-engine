// ==================== routes/chatRoutes.js ====================
const express = require('express');
const router = express.Router();
const {
  getOrCreateChat,
  sendMessage,
  getUserChats,
  getChatHistory,
  updateChatStatus
} = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/init', getOrCreateChat);
router.get('/', getUserChats);
router.get('/:chatId', getChatHistory);
router.post('/:chatId/messages', sendMessage);
router.patch('/:chatId/status', updateChatStatus);

module.exports = router;

