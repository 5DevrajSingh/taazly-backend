const storeManagerService =
  require('../services/storeManagerService');

function validId(value) {
  return (
    /^[1-9]\d*$/.test(String(value)) &&
    Number.isSafeInteger(Number(value))
  );
}

async function getStoreManagers(req, res) {
  try {
    const managers = await storeManagerService.getStoreManagers();

    return res.json({
      success: true,
      message: 'Store managers fetched successfully',
      data: managers,
    });
  } catch (error) {
    console.error('Get store managers error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch store managers',
    });
  }
}

async function assignStoreManager(req, res) {
  try {
    const { storeId } = req.params;
    const {
      manager_id,
      replace_existing = false,
    } = req.body;

    if (!validId(storeId) || !validId(manager_id)) {
      return res.status(400).json({
        success: false,
        message: 'Valid store ID and manager_id are required',
      });
    }

    if (typeof replace_existing !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'replace_existing must be true or false',
      });
    }

    const assignment =
  await storeManagerService.assignStoreManager({
    storeId: Number(storeId),
    managerId: Number(manager_id),
    assignedByUserId: req.user.userId,
    replaceExisting: replace_existing,
  });

    return res.json({
      success: true,
      message: 'Store manager assignment saved successfully',
      data: assignment,
    });
  } catch (error) {
    console.error('Assign store manager error:', error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.status
        ? error.message
        : 'Failed to assign store manager',
    });
  }
}

module.exports = {
  getStoreManagers,
  assignStoreManager,
};