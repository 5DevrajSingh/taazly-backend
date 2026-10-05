const dashboardService = require('../services/dashboardService');

/**
 * Admin Dashboard
 */
async function getAdminDashboard(req, res) {
  try {
    // --------------------------------------------------
    // Read store_id from query
    // --------------------------------------------------

    const { store_id } = req.query;

    let storeId = null;

    if (store_id !== undefined) {
      storeId = Number(store_id);

      if (!Number.isInteger(storeId) || storeId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid store_id',
        });
      }
    }

    // --------------------------------------------------
    // Fetch dashboard
    // --------------------------------------------------

    const dashboard =
      await dashboardService.getAdminDashboard(storeId);

    return res.status(200).json({
      success: true,
      message: 'Admin dashboard data fetched successfully',
      data: dashboard,
    });
  } catch (error) {
    console.error('Admin Dashboard Error:', error);

    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admin dashboard data',
      error: error.message,
    });
  }
}

module.exports = {
  getAdminDashboard,
};