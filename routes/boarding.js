// ==================== routes/boarding.js ====================
const express = require('express');
const router = express.Router();
const boardingController = require('../controllers/boardingController');
const auth = require('../middleware/auth');

// ==================== QR CODE SCANNING & BOARDING ====================

/**
 * POST /api/boarding/scan-qr
 * Scan QR code and board passenger
 * Access: Staff, Owner
 */
router.post(
  '/scan-qr',
  auth.verifyToken,
  auth.checkRole(['staff', 'owner']),
  boardingController.scanQRAndBoard
);

/**
 * POST /api/boarding/verify-exit-otp
 * Verify exit OTP and complete journey segment
 * Access: Staff, Owner
 */
router.post(
  '/verify-exit-otp',
  auth.verifyToken,
  auth.checkRole(['staff', 'owner']),
  boardingController.verifyExitOTP
);

/**
 * POST /api/boarding/manual-board
 * Manually board passenger without QR scan (emergency)
 * Access: Staff, Owner
 */
router.post(
  '/manual-board',
  auth.verifyToken,
  auth.checkRole(['staff', 'owner']),
  boardingController.manualBoard
);

// ==================== PASSENGER MANAGEMENT ====================

/**
 * GET /api/boarding/bus/:busId/today
 * Get today's passenger list for a bus
 * Access: Staff, Owner
 */
router.get(
  '/bus/:busId/today',
  auth.verifyToken,
  auth.checkRole(['staff', 'owner']),
  boardingController.getTodaysPassengers
);

/**
 * GET /api/boarding/bus/:busId/stats
 * Get boarding statistics for a bus
 * Access: Staff, Owner
 */
router.get(
  '/bus/:busId/stats',
  auth.verifyToken,
  auth.checkRole(['staff', 'owner']),
  boardingController.getBoardingStats
);

/**
 * GET /api/boarding/status/:busId
 * Get current boarding status for a bus
 * Access: Authenticated users
 */
router.get(
  '/status/:busId',
  auth.verifyToken,
  boardingController.getBoardingStatus
);

// ==================== SEAT APPROVAL (BUS OWNER) ====================

/**
 * PUT /api/boarding/segment/:segmentId/approve
 * Approve or reject seat request
 * Access: Owner only
 * Body: { action: 'approve' | 'reject', reason?: string }
 */
router.put(
  '/segment/:segmentId/approve',
  auth.verifyToken,
  auth.checkRole('owner'),
  boardingController.approveSeatRequest
);

/**
 * GET /api/boarding/pending-approvals
 * Get all pending seat approval requests for owner
 * Access: Owner only
 */
router.get(
  '/pending-approvals',
  auth.verifyToken,
  auth.checkRole('owner'),
  boardingController.getPendingApprovals
);

/**
 * PUT /api/boarding/bulk-approve
 * Bulk approve/reject multiple seat requests
 * Access: Owner only
 * Body: { segmentIds: string[], action: 'approve' | 'reject', reason?: string }
 */
router.put(
  '/bulk-approve',
  auth.verifyToken,
  auth.checkRole('owner'),
  boardingController.bulkApproveSeatRequests
);

// ==================== OTP MANAGEMENT ====================

/**
 * POST /api/boarding/generate-exit-otp
 * Manually generate exit OTP for a segment
 * Access: Staff, Owner
 * Body: { segmentId: string }
 */
router.post(
  '/generate-exit-otp',
  auth.verifyToken,
  auth.checkRole(['staff', 'owner']),
  boardingController.generateExitOTP
);

/**
 * POST /api/boarding/resend-otp
 * Resend exit OTP to customer
 * Access: Staff, Owner
 * Body: { segmentId: string }
 */
router.post(
  '/resend-otp',
  auth.verifyToken,
  auth.checkRole(['staff', 'owner']),
  boardingController.resendExitOTP
);

// ==================== CUSTOMER QUERIES ====================

/**
 * GET /api/boarding/my-segments/:journeyId
 * Get all segments for a customer's journey
 * Access: Authenticated customer
 */
router.get(
  '/my-segments/:journeyId',
  auth.verifyToken,
  boardingController.getMySegments
);

/**
 * GET /api/boarding/segment/:segmentId
 * Get details of a specific segment
 * Access: Authenticated users
 */
router.get(
  '/segment/:segmentId',
  auth.verifyToken,
  boardingController.getSegmentDetails
);

// ==================== REPORTING & ANALYTICS ====================

/**
 * GET /api/boarding/route/:routeId/analytics
 * Get boarding analytics for a route
 * Access: Owner, Admin
 */
router.get(
  '/route/:routeId/analytics',
  auth.verifyToken,
  auth.checkRole(['owner', 'admin']),
  boardingController.getRouteAnalytics
);

/**
 * GET /api/boarding/daily-report/:busId
 * Get daily boarding report for a bus
 * Access: Owner, Admin
 */
router.get(
  '/daily-report/:busId',
  auth.verifyToken,
  auth.checkRole(['owner', 'admin']),
  boardingController.getDailyReport
);

// ==================== EMERGENCY OPERATIONS ====================

/**
 * POST /api/boarding/mark-no-show
 * Mark passenger as no-show
 * Access: Staff, Owner
 * Body: { segmentId: string, reason: string }
 */
router.post(
  '/mark-no-show',
  auth.verifyToken,
  auth.checkRole(['staff', 'owner']),
  boardingController.markNoShow
);

/**
 * POST /api/boarding/emergency-complete
 * Emergency complete journey without OTP
 * Access: Owner, Admin only
 * Body: { segmentId: string, reason: string }
 */
router.post(
  '/emergency-complete',
  auth.verifyToken,
  auth.checkRole(['owner', 'admin']),
  boardingController.emergencyComplete
);

// ==================== VALIDATION ====================

/**
 * POST /api/boarding/validate-qr
 * Validate QR code without boarding (for testing)
 * Access: Staff, Owner
 * Body: { qrData: string }
 */
router.post(
  '/validate-qr',
  auth.verifyToken,
  auth.checkRole(['staff', 'owner']),
  boardingController.validateQRCode
);

module.exports = router;
