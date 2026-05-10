// ==================== routes/chatRoutes.js ====================
const express = require('express');
const router = express.Router();
const {
  getOrCreateChat,
  getOrCreateSupportChat,
  sendMessage,
  getUserChats,
  getChatHistory,
  updateChatStatus
} = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/init', getOrCreateChat);
router.post('/init-support', getOrCreateSupportChat);
router.get('/', getUserChats);
router.get('/:chatId', getChatHistory);
router.post('/:chatId/messages', sendMessage);
router.patch('/:chatId/status', updateChatStatus);

module.exports = router;

