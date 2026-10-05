const express = require('express');

const router = express.Router();

const orderController = require('../controllers/orderController');

const {
  authenticateToken,
} = require('../middleware/authMiddleware');

const {
  authorizeRoles,
} = require('../middleware/roleMiddleware');

// Create order
router.post(
  '/',
  authenticateToken,
  orderController.createOrder
);

// Get logged-in customer's orders
router.get(
  '/',
  authenticateToken,
  orderController.getCustomerOrders
);

// Admin: all stores or selected store.
// Manager: assigned store only, enforced by controller.
router.get(
  '/store',
  authenticateToken,
  authorizeRoles('admin', 'store_manager'),
  orderController.getStoreOrders
);

// Assign delivery partner
router.post(
  '/:id/assign-delivery',
  authenticateToken,
  authorizeRoles('admin', 'store_manager'),
  orderController.assignDeliveryPartner
);

// Update order status
router.patch(
  '/:id/status',
  authenticateToken,
  authorizeRoles('admin', 'store_manager'),
  orderController.updateStoreOrderStatus
);

// Cancel logged-in customer's order
router.patch(
  '/:id/cancel',
  authenticateToken,
  orderController.cancelCustomerOrder
);

// Get single logged-in customer's order
// Keep this after /store.
router.get(
  '/:id',
  authenticateToken,
  orderController.getCustomerOrder
);

module.exports = router;