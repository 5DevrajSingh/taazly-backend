const express = require('express');

const router = express.Router();

const dashboardController = require('../controllers/dashboardController');
const {
  authenticateToken,
} = require('../middleware/authMiddleware');

// Admin Dashboard
router.get(
  '/admin',
  authenticateToken,
  dashboardController.getAdminDashboard
);

module.exports = router;