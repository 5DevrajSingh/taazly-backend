const express = require('express');

const {
  createStore,
  createStoreManager,
  getAllStores,
  getStoreById,
  getActiveStores,
} = require('../controllers/storeController');

const storeManagerController =
  require('../controllers/storeManagerController');

const {
  authenticateToken,
} = require('../middleware/authMiddleware');

const {
  authorizeRoles,
} = require('../middleware/roleMiddleware');

const router = express.Router();

// Public endpoint: register before authentication.
router.get('/active', getActiveStores);

router.use(
  authenticateToken,
  authorizeRoles('admin')
);

router.post('/', createStore);
router.get('/', getAllStores);

// Keep /managers before /:storeId.
router.get(
  '/managers',
  storeManagerController.getStoreManagers
);

// Create a new manager and assign a manager-free store.
router.post(
  '/:storeId/manager',
  createStoreManager
);

// Assign an existing manager or change the current manager.
router.patch(
  '/:storeId/manager',
  storeManagerController.assignStoreManager
);

router.get('/:storeId', getStoreById);

module.exports = router;