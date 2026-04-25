
// ==================== server.js ====================
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Middleware #87967
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(mongoSanitize());
app.use(morgan('combined'));
app.use(express.static('public'));

// Rate Limiting — protect all API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,                  // 300 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})

  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Socket.io - Real-time updates
global.io = io;
app.set('io', io);
const realtimeController = require('./controllers/realtimeController');
realtimeController.initializeSocketHandlers(io);

io.on('connection', (socket) => {
  // Redundant handlers removed. Handled by realtimeController.initializeSocketHandlers
  console.log('🔌 Socket connection established:', socket.id);
});

// Routes
app.use('/api/auth', require('./routes/auth'));

const userRoutes = require('./routes/users'); // Assuming users.js is userRoutes
const adminRoutes = require('./routes/admin'); // Assuming admin.js is adminRoutes
const telemetryController = require('./controllers/telemetryController');

app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Telemetry & IoT Routes
app.post('/api/telemetry', telemetryController.receiveTelemetry);
app.get('/api/telemetry/:busId', telemetryController.getBusHistory);

// app.use('/api/bus-owner', require('./routes/busOwner'));
app.use('/api/owner', require('./routes/busOwner'));
app.use('/api/tracking', require('./routes/trackingRoutes'));

app.use('/api/buses', require('./routes/buses'));
app.use('/api/routes', require('./routes/routes'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/journeys', require('./routes/journeys'));
app.use('/api/locations', require('./routes/locations'));

app.use('/api/realtime', require('./routes/realtime'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/segments', require('./routes/segments'));
app.use('/api/boarding', require('./routes/boarding'));
app.use('/api/services', require('./routes/services'));
app.use('/api/service-bookings', require('./routes/serviceBookings'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/rental-requests', require('./routes/rentalRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));
app.use('/api/food', require('./routes/foodRoutes'));
app.use('/api/yatra', require('./routes/yatraRoutes'));
app.use('/api/marketplace', require('./routes/marketplaceRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
// Test page (temporary)
// Test page (temporary)
app.get('/test-auth', (req, res) => {
  res.sendFile(__dirname + '/public/auth-test.html');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server error',
    error: process.env.NODE_ENV !== 'production' ? err : {}
  });
});

const PORT = process.env.PORT || 5000;

// Use server.listen instead of app.listen so Socket.IO works
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 Bus Booking Server Running        ║
║   ✅ HTTP:  http://0.0.0.0:${PORT}      ║
║   ✅ API:   http://192.168.10.6:${PORT}/api ║
║   ✅ IO:    Socket.IO Enabled          ║
╚════════════════════════════════════════╝
  `);
});

// Gracefully handle port-in-use error
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.log(`💡 To fix, run this command:\n   npx kill-port ${PORT}\n   then restart with: npm run dev\n`);
    process.exit(1);
  } else {
    throw err;
  }
});






// Initialize background jobs
const { initAutoCancelJob } = require('./services/autoCancelService');
initAutoCancelJob();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});














