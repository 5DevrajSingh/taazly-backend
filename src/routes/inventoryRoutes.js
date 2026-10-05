const express = require('express');
const router = express.Router();

const inventoryController = require('../controllers/inventoryController');

// Get all inventory of a store
router.get(
  '/store/:storeId',
  inventoryController.getInventory
);

// Get inventory of a single product
router.get(
  '/store/:storeId/:productId',
  inventoryController.getProductInventory
);

// Create inventory
router.post(
  '/store/:storeId',
  inventoryController.createInventory
);

// Update complete inventory
router.put(
  '/store/:storeId/:productId',
  inventoryController.updateInventory
);

// Update stock quantity
router.patch(
  '/store/:storeId/:productId/stock',
  inventoryController.updateStock
);

// Update product availability
router.patch(
  '/store/:storeId/:productId/availability',
  inventoryController.updateAvailability
);

module.exports = router;