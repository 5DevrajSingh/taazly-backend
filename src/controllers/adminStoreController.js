const adminStoreService = require('../services/adminStoreService');

/**
 * Get all stores for Admin
 */
async function getAllStores(req, res) {
  try {
    const stores = await adminStoreService.getAllStoresForAdmin();

    return res.status(200).json({
      success: true,
      message: 'Admin stores fetched successfully',
      data: {
        total: stores.length,
        active: stores.filter(
          (store) => store.status === 'active'
        ).length,
        stores,
      },
    });
  } catch (error) {
    console.error('Get Admin Stores Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admin stores',
      error: error.message,
    });
  }
}

module.exports = {
  getAllStores,
};