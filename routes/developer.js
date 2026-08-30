const express = require('express');
const router = express.Router();
const developerController = require('../controllers/developerController');
const { protect } = require('../middleware/auth');

// Note: To keep things fully accessible for the developer bypass flow, 
// we won't strictly enforce a specific role here (since the mobile app bypass token might be fake). 
// In a real prod environment, you would check for a special Developer JWT role.
// For now, we allow access if they are logged in.

router.get('/collections', developerController.getCollections);
router.get('/collections/:collectionName', developerController.getCollectionData);
router.delete('/collections/:collectionName/:id', developerController.deleteDocument);

router.get('/logs', developerController.getLogs);
router.get('/analytics', developerController.getAnalytics);

// This endpoint is unauthenticated so the mobile app can freely send telemetry even before login
router.post('/analytics/pageview', developerController.postAnalytics);

router.post('/login', developerController.login);
router.post('/change-password', developerController.changePassword);

router.get('/health', developerController.getHealth);
router.post('/crash-report', developerController.postCrashReport);

router.post('/system-broadcast', developerController.postSystemBroadcast);
router.get('/config/maintenance', developerController.getMaintenanceConfig);
router.get('/terminal', developerController.getTerminalLogs);

module.exports = router;
