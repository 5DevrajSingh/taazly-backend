const addressService = require('../services/addressService');

/**
 * Get all customer addresses
 */
async function getCustomerAddresses(req, res) {
  try {
    const { customerId } = req.params;

    const addresses = await addressService.getCustomerAddresses(customerId);

    return res.status(200).json({
      success: true,
      message: 'Addresses fetched successfully',
      data: addresses,
    });
  } catch (error) {
    console.error('Get customer addresses error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch addresses',
    });
  }
}

/**
 * Get single address
 */
async function getAddress(req, res) {
  try {
    const { customerId, id } = req.params;

    const address = await addressService.getAddressById(
      id,
      customerId
    );

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Address fetched successfully',
      data: address,
    });
  } catch (error) {
    console.error('Get address error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch address',
    });
  }
}

/**
 * Create address
 */
async function createAddress(req, res) {
  try {
    const { customerId } = req.params;

    const {
      address_type,
      full_name,
      mobile,
      address_line_1,
      address_line_2,
      area,
      landmark,
      city,
      state,
      pincode,
      latitude,
      longitude,
      is_default,
    } = req.body;

    // Required fields
    if (
      !full_name ||
      !address_line_1 ||
      !city ||
      !state ||
      !pincode
    ) {
      return res.status(400).json({
        success: false,
        message:
          'full_name, address_line_1, city, state and pincode are required',
      });
    }

    const address = await addressService.createAddress({
      user_id: customerId,
      address_type,
      full_name,
      mobile,
      address_line_1,
      address_line_2,
      area,
      landmark,
      city,
      state,
      pincode,
      latitude,
      longitude,
      is_default,
    });

    return res.status(201).json({
      success: true,
      message: 'Address created successfully',
      data: address,
    });
  } catch (error) {
    console.error('Create address error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create address',
    });
  }
}

/**
 * Update address
 */
async function updateAddress(req, res) {
  try {
    const { customerId, id } = req.params;

    const {
      address_type,
      full_name,
      mobile,
      address_line_1,
      address_line_2,
      area,
      landmark,
      city,
      state,
      pincode,
      latitude,
      longitude,
      is_default,
    } = req.body;

    // Required fields
    if (
      !full_name ||
      !address_line_1 ||
      !city ||
      !state ||
      !pincode
    ) {
      return res.status(400).json({
        success: false,
        message:
          'full_name, address_line_1, city, state and pincode are required',
      });
    }

    const address = await addressService.updateAddress(
      id,
      customerId,
      {
        address_type,
        full_name,
        mobile,
        address_line_1,
        address_line_2,
        area,
        landmark,
        city,
        state,
        pincode,
        latitude,
        longitude,
        is_default,
      }
    );

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: address,
    });
  } catch (error) {
    console.error('Update address error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update address',
    });
  }
}

/**
 * Delete address
 * Soft delete
 */
async function deleteAddress(req, res) {
  try {
    const { customerId, id } = req.params;

    const deleted = await addressService.deleteAddress(
      id,
      customerId
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Address deleted successfully',
    });
  } catch (error) {
    console.error('Delete address error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete address',
    });
  }
}

/**
 * Set address as default
 */
async function setDefaultAddress(req, res) {
  try {
    const { customerId, id } = req.params;

    const address = await addressService.setDefaultAddress(
      id,
      customerId
    );

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Default address updated successfully',
      data: address,
    });
  } catch (error) {
    console.error('Set default address error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to set default address',
    });
  }
}

module.exports = {
  getCustomerAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};