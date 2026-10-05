const express = require('express');
const router = express.Router();

const addressController = require('../controllers/addressController');

// Get all addresses of a customer
router.get(
  '/customer/:customerId',
  addressController.getCustomerAddresses
);

// Get single address
router.get(
  '/customer/:customerId/:id',
  addressController.getAddress
);

// Create address
router.post(
  '/customer/:customerId',
  addressController.createAddress
);

// Update address
router.put(
  '/customer/:customerId/:id',
  addressController.updateAddress
);

// Delete address
router.delete(
  '/customer/:customerId/:id',
  addressController.deleteAddress
);

// Set default address
router.patch(
  '/customer/:customerId/:id/default',
  addressController.setDefaultAddress
);

module.exports = router;