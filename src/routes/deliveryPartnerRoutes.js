const express = require('express');

const deliveryPartnerController =
  require('../controllers/deliveryPartnerController');

const {
  authenticateToken,
} = require('../middleware/authMiddleware');

const {
  authorizeRoles,
} = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticateToken);

// Delivery partner self-service routes
router.patch(
  '/me/online-status',
  authorizeRoles('delivery_partner'),
  deliveryPartnerController.updateOnlineStatus
);

router.patch(
  '/me/location',
  authorizeRoles('delivery_partner'),
  deliveryPartnerController.updateLocation
);

router.get(
  '/me/orders',
  authorizeRoles('delivery_partner'),
  deliveryPartnerController.getMyDeliveryOrders
);

router.patch(
  '/me/orders/:id/accept',
  authorizeRoles('delivery_partner'),
  deliveryPartnerController.acceptDeliveryOrder
);

router.patch(
  '/me/orders/:id/reject',
  authorizeRoles('delivery_partner'),
  deliveryPartnerController.rejectDeliveryOrder
);

router.patch(
  '/me/orders/:id/pickup',
  authorizeRoles('delivery_partner'),
  deliveryPartnerController.pickupDeliveryOrder
);

router.patch(
  '/me/orders/:id/delivered',
  authorizeRoles('delivery_partner'),
  deliveryPartnerController.deliverDeliveryOrder
);

// Management list routes
router.get(
  '/',
  authorizeRoles('admin', 'store_manager'),
  deliveryPartnerController.getDeliveryPartners
);

// Keep /available before /:id.
router.get(
  '/available',
  authorizeRoles('admin', 'store_manager'),
  deliveryPartnerController.getAvailableDeliveryPartners
);

// Management details route
router.get(
  '/:id',
  authorizeRoles('admin', 'store_manager'),
  deliveryPartnerController.getDeliveryPartner
);

// Verification is admin-only.
router.patch(
  '/:id/verify',
  authorizeRoles('admin'),
  deliveryPartnerController.verifyDeliveryPartner
);

router.patch(
  '/:id/reject',
  authorizeRoles('admin'),
  deliveryPartnerController.rejectDeliveryPartner
);

module.exports = router;