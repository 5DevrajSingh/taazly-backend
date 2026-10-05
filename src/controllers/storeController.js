const storeService = require('../services/storeService');

async function createStore(req, res) {
  try {
    const {
      name,
      slug,
      storeCode,
      phone,
      email,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      latitude,
      longitude,
      openingTime,
      closingTime,
      logo,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Store name is required',
      });
    }

    if (!slug || !slug.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Store slug is required',
      });
    }

    if (!storeCode || !storeCode.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Store code is required',
      });
    }

    const store = await storeService.createStore({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      storeCode: storeCode.trim().toUpperCase(),
      phone,
      email,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      latitude,
      longitude,
      openingTime,
      closingTime,
      logo,
    });

    return res.status(201).json({
      success: true,
      message: 'Store created successfully',
      data: store,
    });
  } catch (error) {
    console.error('Create store error:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create store',
    });
  }
}

async function createStoreManager(req, res) {
  try {
    const { storeId } = req.params;
    const { fullName, email, mobile, password } = req.body;

    if (
      !/^[1-9]\d*$/.test(storeId) ||
      !Number.isSafeInteger(Number(storeId))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid store ID is required',
      });
    }

    if (typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Manager full name is required',
      });
    }

    if (
      typeof mobile !== 'string' ||
      !/^\d{10}$/.test(mobile.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid 10-digit mobile number is required',
      });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    if (
      email != null &&
      (
        typeof email !== 'string' ||
        (
          email.trim() &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        )
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required',
      });
    }

    const result = await storeService.createStoreManager({
      storeId: Number(storeId),
      fullName: fullName.trim(),
      email: email?.trim() || null,
      mobile: mobile.trim(),
      password,
      assignedByUserId: Number(req.user.userId),
    });

    return res.status(201).json({
      success: true,
      message: 'Store manager created and assigned successfully',
      data: result,
    });
  } catch (error) {
    console.error('Create store manager error:', error);

    return res.status(
      error.code === 'ER_DUP_ENTRY' ? 409 : 400
    ).json({
      success: false,
      message:
        error.code === 'ER_DUP_ENTRY'
          ? 'Duplicate entry. Check manager mobile and email.'
          : error.message || 'Failed to create store manager',
    });
  }
}

async function getAllStores(req, res) {
  try {
    const stores = await storeService.getAllStores();

    return res.status(200).json({
      success: true,
      message: 'Stores fetched successfully',
      data: stores,
    });
  } catch (error) {
    console.error(
      'Get all stores error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stores',
    });
  }
}

async function getStoreById(req, res) {
  try {
    const { storeId } = req.params;

    if (!storeId || isNaN(storeId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid store ID is required',
      });
    }

    const store = await storeService.getStoreById(
      Number(storeId)
    );

    return res.status(200).json({
      success: true,
      message: 'Store fetched successfully',
      data: store,
    });
  } catch (error) {
    console.error(
      'Get store error:',
      error
    );

    if (error.message === 'Store not found') {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch store',
    });
  }
}

async function getActiveStores(req, res) {
  try {
    const stores = await storeService.getActiveStores();

    return res.status(200).json({
      success: true,
      message: 'Active stores fetched successfully',
      data: stores,
    });
  } catch (error) {
    console.error('Get active stores error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch active stores',
    });
  }
}

module.exports = {
  createStore,
  createStoreManager,
  getAllStores,
  getActiveStores,
  getStoreById
};