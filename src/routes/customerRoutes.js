const express = require('express');

const router = express.Router();

const customerController = require('../controllers/customerController');

const {
  authenticateToken,
} = require('../middleware/authMiddleware');

const {
  authorizeRoles,
} = require('../middleware/roleMiddleware');

router.use(authenticateToken);

// Admin can view all customers or filter by store.
// Manager can view only customers related to the assigned store.
router.get(
  '/',
  authorizeRoles('admin', 'store_manager'),
  customerController.getCustomers
);

// Account blocking/unblocking is admin-only.
router.patch(
  '/:id/status',
  authorizeRoles('admin'),
  customerController.updateCustomerStatus
);

module.exports = router;