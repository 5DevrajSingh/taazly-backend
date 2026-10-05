const express = require('express');

const router = express.Router();

const adminStoreController = require('../controllers/adminStoreController');

const {
  authenticateToken,
} = require('../middleware/authMiddleware');
const {
    authorizeRoles,
} = require('../middleware/roleMiddleware');

/**
 * GET /api/admin/stores
 *
 * Admin only
 */
router.get(
  '/',
  authenticateToken,
  authorizeRoles('admin'),
  adminStoreController.getAllStores
);

module.exports = router;