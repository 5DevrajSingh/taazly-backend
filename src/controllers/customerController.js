const customerService = require('../services/customerService');

function validId(value) {
  return (
    typeof value === 'string' &&
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value))
  );
}

async function getCustomers(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { userId, role } = req.user;
    const requestedStore = req.query.store_id;

    let storeId = null;

    if (role === 'admin') {
      if (
        requestedStore !== undefined &&
        requestedStore !== 'all'
      ) {
        if (!validId(requestedStore)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid store_id',
          });
        }

        storeId = Number(requestedStore);
      }
    } else if (role === 'store_manager') {
      const assignedStoreId =
        await customerService.getManagerStoreId(userId);

      if (assignedStoreId === null) {
        return res.status(403).json({
          success: false,
          message: 'No store is assigned to this manager',
        });
      }

      storeId = assignedStoreId;

      // Managers may omit store_id or request their assigned store.
      if (
        requestedStore !== undefined &&
        (
          !validId(requestedStore) ||
          Number(requestedStore) !== storeId
        )
      ) {
        return res.status(403).json({
          success: false,
          message: 'You can only access your assigned store',
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const customers = await customerService.getCustomers(storeId);
    const active = customers.filter(
      (customer) => customer.is_active
    ).length;

    return res.status(200).json({
      success: true,
      message: 'Customers fetched successfully',
      data: {
        total: customers.length,
        active,
        blocked: customers.length - active,
        customers,
      },
      scope: {
        role,
        store_id: storeId,
      },
    });
  } catch (error) {
    console.error('Get customers error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
    });
  }
}

async function updateCustomerStatus(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Blocking changes the customer's account across all stores.
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can block or unblock customers',
      });
    }

    const { id } = req.params;
    const { is_active } = req.body || {};

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID',
      });
    }

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_active must be true or false',
      });
    }

    const customer = await customerService.setCustomerStatus(
      Number(id),
      is_active
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: is_active
        ? 'Customer unblocked successfully'
        : 'Customer blocked successfully',
      data: customer,
    });
  } catch (error) {
    console.error('Update customer status error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update customer status',
    });
  }
}

module.exports = {
  getCustomers,
  updateCustomerStatus,
};