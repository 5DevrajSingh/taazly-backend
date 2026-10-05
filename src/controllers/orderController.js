const orderService = require('../services/orderService');

/**
 * Create new order
 */
async function createOrder(req, res) {
  try {
    console.log('JWT USER:', req.user);

    // User ID comes from JWT token
    const userId = req.user.userId;

    const {
      store_id,
      address_id,
      payment_method,
      items,
      customer_note,
    } = req.body;

    // ---------------------------------------------
    // Validation
    // ---------------------------------------------
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required',
      });
    }

    if (!address_id) {
      return res.status(400).json({
        success: false,
        message: 'address_id is required',
      });
    }

    if (!payment_method) {
      return res.status(400).json({
        success: false,
        message: 'payment_method is required',
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one order item is required',
      });
    }

    // ---------------------------------------------
    // Create order
    // ---------------------------------------------
    const order = await orderService.createOrder({
      userId,
      storeId: Number(store_id),
      addressId: Number(address_id),
      paymentMethod: payment_method,
      items,
      customerNote: customer_note,
    });

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  } catch (error) {
    console.error('Create order error:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create order',
    });
  }
}

/**
 * Get logged-in customer's orders
 */
async function getCustomerOrders(req, res) {
  try {
    const userId = req.user.userId;
    console.log('Customer userId:', userId);
    const orders = await orderService.getCustomerOrders(userId);

    return res.status(200).json({
      success: true,
      message: 'Orders fetched successfully',
      data: orders,
    });
  } catch (error) {
    console.error('Get customer orders error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
    });
  }
}

/**
 * Get single logged-in customer's order
 */
async function getCustomerOrder(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    console.log('Customer userId:', userId);
    const order = await orderService.getCustomerOrderById(
      id,
      userId
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order fetched successfully',
      data: order,
    });
  } catch (error) {
    console.error('Get customer order error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
    });
  }
}

async function cancelCustomerOrder(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    const order = await orderService.cancelCustomerOrder(
      id,
      userId,
      cancellation_reason
    );

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    });
  } catch (error) {
    console.error('Cancel customer order error:', error);

    if (error.message === 'ORDER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (error.message === 'ORDER_CANNOT_BE_CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage',
      });
    }

    if (error.message === 'INVENTORY_NOT_FOUND') {
      return res.status(500).json({
        success: false,
        message: 'Inventory record not found',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
    });
  }
}

async function getStoreOrders(req, res) {
  try {
    const userId = req.user.userId;
    const role = req.user.role;

    let storeId = null;

    if (role === 'admin') {
      const requestedStore = req.query.store_id;

      if (
        requestedStore !== undefined &&
        requestedStore !== 'all'
      ) {
        if (
          typeof requestedStore !== 'string' ||
          !/^[1-9]\d*$/.test(requestedStore) ||
          !Number.isSafeInteger(Number(requestedStore))
        ) {
          return res.status(400).json({
            success: false,
            message: 'Invalid store_id',
          });
        }

        storeId = Number(requestedStore);
      }
    } else if (role === 'store_manager') {
      // Always resolve the manager's store from the database.
      const assignedStoreId =
        await orderService.getManagerStoreId(userId);

      if (!assignedStoreId) {
        return res.status(403).json({
          success: false,
          message: 'No store is assigned to this manager',
        });
      }

      storeId = Number(assignedStoreId);

      const requestedStore = req.query.store_id;

      // Reject attempts to request another store or all stores.
      if (
        requestedStore !== undefined &&
        String(requestedStore) !== String(storeId)
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

    const allowedStatuses = [
      'pending',
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'out_for_delivery',
      'delivered',
      'returned',
      'cancelled',
    ];

    const requestedStatus = req.query.status;
    let status = null;

    if (
      requestedStatus !== undefined &&
      requestedStatus !== 'all'
    ) {
      if (
        typeof requestedStatus !== 'string' ||
        !allowedStatuses.includes(requestedStatus)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid order status',
        });
      }

      status = requestedStatus;
    }

    const orders = await orderService.getManagementOrders(
      storeId,
      status
    );

    return res.status(200).json({
      success: true,
      message: 'Orders fetched successfully',
      data: orders,
      scope: {
        role,
        store_id: storeId,
      },
    });
  } catch (error) {
    console.error('Get management orders error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
    });
  }
}

async function updateStoreOrderStatus(req, res) {
  try {
    const managerUserId = req.user.userId;
    const orderId = req.params.id;

    const { status, note } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    const updatedOrder =
      await orderService.updateStoreOrderStatus({
        orderId,
        managerUserId,
        status,
        note,
      });

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: updatedOrder,
    });
  } catch (error) {
    console.error(
      'Update store order status error:',
      error
    );

    if (
      error.message ===
      'No store is assigned to this manager'
    ) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.message ===
      'Order not found for this store' ||
      error.message === 'Invalid order status' ||
      error.message.startsWith(
        'Order cannot be changed'
      )
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update order status',
    });
  }
}

async function assignDeliveryPartner(req, res) {
  try {
    const { id } = req.params;
    const { delivery_partner_id } = req.body;

    if (!delivery_partner_id) {
      return res.status(400).json({
        success: false,
        message: 'delivery_partner_id is required',
      });
    }

    const assignment =
      await orderService.assignDeliveryPartner(
        id,
        delivery_partner_id,
        req.user.userId
      );

    return res.status(201).json({
      success: true,
      message: 'Delivery partner assigned successfully',
      data: assignment,
    });

  } catch (error) {
    console.error(
      'Assign delivery partner error:',
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  createOrder,
  getCustomerOrders,
  getCustomerOrder,
  cancelCustomerOrder,
  getStoreOrders,
  updateStoreOrderStatus,
  assignDeliveryPartner,
};