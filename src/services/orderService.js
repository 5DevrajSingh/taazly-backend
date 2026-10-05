const pool = require('../config/database');

/**
 * Create new customer order
 *
 * All order operations are handled inside one MySQL transaction.
 */
async function createOrder({
  userId,
  storeId,
  addressId,
  paymentMethod,
  items,
  customerNote,
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // --------------------------------------------------
    // 1. Validate customer address
    // --------------------------------------------------
    const [addressRows] = await connection.query(
      `
      SELECT
        id,
        user_id,
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
        longitude
      FROM addresses
      WHERE id = ?
        AND user_id = ?
        AND is_active = TRUE
      LIMIT 1
      `,
      [addressId, userId]
    );

    if (addressRows.length === 0) {
      throw new Error('Delivery address not found');
    }

    const address = addressRows[0];

    // --------------------------------------------------
    // 2. Validate store
    // --------------------------------------------------
    const [storeRows] = await connection.query(
      `
      SELECT id
      FROM stores
      WHERE id = ?
      LIMIT 1
      `,
      [storeId]
    );

    if (storeRows.length === 0) {
      throw new Error('Store not found');
    }

    // --------------------------------------------------
    // 3. Validate payment method
    // --------------------------------------------------
    if (!['cod', 'online'].includes(paymentMethod)) {
      throw new Error('Invalid payment method');
    }

    // --------------------------------------------------
    // 4. Validate items
    // --------------------------------------------------
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    let subtotal = 0;
    const orderItems = [];

    // --------------------------------------------------
    // 5. Validate products + inventory + stock
    // --------------------------------------------------
    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);

      if (!Number.isInteger(productId) || productId <= 0) {
        throw new Error('Invalid product_id');
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error('Invalid quantity');
      }

      const [inventoryRows] = await connection.query(
        `
        SELECT
          si.id AS store_inventory_id,
          si.store_id,
          si.product_id,
          si.selling_price,
          si.stock_quantity,
          si.is_available,

          p.name,
          p.sku,
          p.unit,
          p.is_active

        FROM store_inventory si

        INNER JOIN products p
          ON p.id = si.product_id

        WHERE si.store_id = ?
          AND si.product_id = ?
          AND p.store_id = ?
          AND p.is_active = TRUE

        LIMIT 1

        FOR UPDATE
        `,
        [storeId, productId, storeId]
      );

      if (inventoryRows.length === 0) {
        throw new Error(
          `Product ${productId} is not available in this store`
        );
      }

      const inventory = inventoryRows[0];

      if (!inventory.is_available) {
        throw new Error(
          `${inventory.name} is currently unavailable`
        );
      }

      if (inventory.stock_quantity < quantity) {
        throw new Error(
          `Insufficient stock for ${inventory.name}. Available stock: ${inventory.stock_quantity}`
        );
      }

      const unitPrice = Number(inventory.selling_price);
      const totalPrice = unitPrice * quantity;

      subtotal += totalPrice;

      orderItems.push({
        product_id: inventory.product_id,
        store_inventory_id: inventory.store_inventory_id,
        product_name: inventory.name,
        sku: inventory.sku,
        unit: inventory.unit,
        quantity,
        unit_price: unitPrice,
        discount_amount: 0,
        tax_amount: 0,
        total_price: totalPrice,
      });
    }

    // --------------------------------------------------
    // 6. Calculate order amounts
    // --------------------------------------------------
    const deliveryFee = 0;
    const discountAmount = 0;
    const taxAmount = 0;

    const totalAmount =
      subtotal +
      deliveryFee -
      discountAmount +
      taxAmount;

    // --------------------------------------------------
    // 7. Generate unique order number
    // --------------------------------------------------
    const orderNumber = `TZ${Date.now()}${Math.floor(
      Math.random() * 1000
    )
      .toString()
      .padStart(3, '0')}`;

    // --------------------------------------------------
    // 8. Create order
    // --------------------------------------------------
    const [orderResult] = await connection.query(
      `
      INSERT INTO orders (
        order_number,
        user_id,
        store_id,
        address_id,

        delivery_full_name,
        delivery_mobile,
        delivery_address_line_1,
        delivery_address_line_2,
        delivery_area,
        delivery_landmark,
        delivery_city,
        delivery_state,
        delivery_pincode,
        delivery_latitude,
        delivery_longitude,

        status,
        payment_status,
        payment_method,

        subtotal,
        delivery_fee,
        discount_amount,
        tax_amount,
        total_amount,

        customer_note,
        placed_at
      )
      VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'pending',
        'pending',
        ?,
        ?, ?, ?, ?, ?,
        ?,
        CURRENT_TIMESTAMP
      )
      `,
      [
        orderNumber,
        userId,
        storeId,
        addressId,

        address.full_name,
        address.mobile,
        address.address_line_1,
        address.address_line_2,
        address.area,
        address.landmark,
        address.city,
        address.state,
        address.pincode,
        address.latitude,
        address.longitude,

        paymentMethod,

        subtotal,
        deliveryFee,
        discountAmount,
        taxAmount,
        totalAmount,

        customerNote || null,
      ]
    );

    const orderId = orderResult.insertId;

    // --------------------------------------------------
    // 9. Insert order items + reduce inventory
    // --------------------------------------------------
    for (const item of orderItems) {
      await connection.query(
        `
        INSERT INTO order_items (
          order_id,
          product_id,
          store_inventory_id,
          product_name,
          sku,
          unit,
          quantity,
          unit_price,
          discount_amount,
          tax_amount,
          total_price
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          item.product_id,
          item.store_inventory_id,
          item.product_name,
          item.sku,
          item.unit,
          item.quantity,
          item.unit_price,
          item.discount_amount,
          item.tax_amount,
          item.total_price,
        ]
      );

      await connection.query(
        `
        UPDATE store_inventory
        SET stock_quantity = stock_quantity - ?
        WHERE id = ?
          AND stock_quantity >= ?
        `,
        [
          item.quantity,
          item.store_inventory_id,
          item.quantity,
        ]
      );
    }

    // --------------------------------------------------
    // 10. Create initial order status history
    // --------------------------------------------------
    await connection.query(
      `
      INSERT INTO order_status_history (
        order_id,
        status,
        changed_by_user_id,
        note
      )
      VALUES (?, 'pending', ?, ?)
      `,
      [
        orderId,
        userId,
        'Order placed by customer',
      ]
    );

    // --------------------------------------------------
    // 11. Fetch complete created order
    // --------------------------------------------------
    const [createdOrderRows] = await connection.query(
      `
      SELECT *
      FROM orders
      WHERE id = ?
      LIMIT 1
      `,
      [orderId]
    );

    const [createdItemRows] = await connection.query(
      `
      SELECT *
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
      `,
      [orderId]
    );

    // --------------------------------------------------
    // 12. Commit transaction
    // --------------------------------------------------
    await connection.commit();

    return {
      ...createdOrderRows[0],
      items: createdItemRows,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get all orders of logged-in customer
 */
async function getCustomerOrders(userId) {
  const connection = await pool.getConnection();

  try {
    const [orders] = await connection.query(
      `
      SELECT
        id,
        order_number,
        user_id,
        store_id,
        address_id,
        delivery_full_name,
        delivery_mobile,
        delivery_address_line_1,
        delivery_address_line_2,
        delivery_area,
        delivery_landmark,
        delivery_city,
        delivery_state,
        delivery_pincode,
        delivery_latitude,
        delivery_longitude,
        status,
        payment_status,
        payment_method,
        subtotal,
        delivery_fee,
        discount_amount,
        tax_amount,
        total_amount,
        customer_note,
        placed_at,
        confirmed_at,
        delivered_at,
        cancelled_at,
        cancellation_reason,
        created_at,
        updated_at
      FROM orders
      WHERE user_id = ?
      ORDER BY id DESC
      `,
      [userId]
    );

    return orders;
  } finally {
    connection.release();
  }
}

/**
 * Get single order of logged-in customer
 */
async function getCustomerOrderById(orderId, userId) {
  const connection = await pool.getConnection();

  try {
    const [orderRows] = await connection.query(
      `
      SELECT
        id,
        order_number,
        user_id,
        store_id,
        address_id,
        delivery_full_name,
        delivery_mobile,
        delivery_address_line_1,
        delivery_address_line_2,
        delivery_area,
        delivery_landmark,
        delivery_city,
        delivery_state,
        delivery_pincode,
        delivery_latitude,
        delivery_longitude,
        status,
        payment_status,
        payment_method,
        subtotal,
        delivery_fee,
        discount_amount,
        tax_amount,
        total_amount,
        customer_note,
        placed_at,
        confirmed_at,
        delivered_at,
        cancelled_at,
        cancellation_reason,
        created_at,
        updated_at
      FROM orders
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
      `,
      [orderId, userId]
    );

    if (orderRows.length === 0) {
      return null;
    }

    const order = orderRows[0];

    const [items] = await connection.query(
      `
      SELECT
        id,
        order_id,
        product_id,
        store_inventory_id,
        product_name,
        sku,
        unit,
        quantity,
        unit_price,
        discount_amount,
        tax_amount,
        total_price,
        created_at,
        updated_at
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
      `,
      [orderId]
    );

    const [statusHistory] = await connection.query(
      `
      SELECT
        id,
        order_id,
        status,
        changed_by_user_id,
        note,
        created_at
      FROM order_status_history
      WHERE order_id = ?
      ORDER BY id ASC
      `,
      [orderId]
    );

    return {
      ...order,
      items,
      status_history: statusHistory,
    };
  } finally {
    connection.release();
  }
}

async function cancelCustomerOrder(orderId, userId, cancellationReason) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Get customer's order
    const [orders] = await connection.query(
      `
      SELECT
        id,
        user_id,
        status
      FROM orders
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [orderId, userId]
    );

    if (orders.length === 0) {
      throw new Error('ORDER_NOT_FOUND');
    }

    const order = orders[0];

    // 2. Allow cancellation only for pending/confirmed orders
    if (!['pending', 'confirmed'].includes(order.status)) {
      throw new Error('ORDER_CANNOT_BE_CANCELLED');
    }

    // 3. Get order items
    const [items] = await connection.query(
      `
      SELECT
        product_id,
        store_inventory_id,
        quantity
      FROM order_items
      WHERE order_id = ?
      `,
      [orderId]
    );

    // 4. Restore stock
    for (const item of items) {
      const [stockResult] = await connection.query(
        `
        UPDATE store_inventory
        SET stock_quantity = stock_quantity + ?
        WHERE id = ?
        `,
        [item.quantity, item.store_inventory_id]
      );

      if (stockResult.affectedRows === 0) {
        throw new Error('INVENTORY_NOT_FOUND');
      }
    }

    // 5. Update order
    await connection.query(
      `
      UPDATE orders
      SET
        status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancellation_reason = ?
      WHERE id = ?
        AND user_id = ?
      `,
      [cancellationReason || null, orderId, userId]
    );

    // 6. Add status history
    await connection.query(
      `
      INSERT INTO order_status_history (
        order_id,
        status,
        changed_by_user_id,
        note
      )
      VALUES (?, 'cancelled', ?, ?)
      `,
      [
        orderId,
        userId,
        cancellationReason
          ? `Order cancelled by customer: ${cancellationReason}`
          : 'Order cancelled by customer',
      ]
    );

    // 7. Fetch updated order
    const [updatedOrders] = await connection.query(
      `
      SELECT
        id,
        order_number,
        user_id,
        store_id,
        address_id,
        delivery_full_name,
        delivery_mobile,
        delivery_address_line_1,
        delivery_address_line_2,
        delivery_area,
        delivery_landmark,
        delivery_city,
        delivery_state,
        delivery_pincode,
        delivery_latitude,
        delivery_longitude,
        status,
        payment_status,
        payment_method,
        subtotal,
        delivery_fee,
        discount_amount,
        tax_amount,
        total_amount,
        customer_note,
        placed_at,
        confirmed_at,
        delivered_at,
        cancelled_at,
        cancellation_reason,
        created_at,
        updated_at
      FROM orders
      WHERE id = ?
      LIMIT 1
      `,
      [orderId]
    );

    await connection.commit();

    return updatedOrders[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getManagementOrders(storeId = null, status = null) {
  const conditions = [];
  const params = [];

  if (storeId !== null) {
    conditions.push('o.store_id = ?');
    params.push(storeId);
  }

  if (status !== null) {
    conditions.push('o.status = ?');
    params.push(status);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const [orders] = await pool.query(
    `
    SELECT
      o.id,
      o.order_number,
      o.user_id,
      o.store_id,
      s.name AS store_name,

      o.delivery_full_name AS customer_name,
      o.delivery_mobile AS customer_mobile,

      o.status,
      o.payment_status,
      o.payment_method,
      o.total_amount,
      o.customer_note,
      o.placed_at,
      o.created_at,

      (
        SELECT COUNT(*)
        FROM order_items oi
        WHERE oi.order_id = o.id
      ) AS item_count,

      (
        SELECT COALESCE(SUM(oi.quantity), 0)
        FROM order_items oi
        WHERE oi.order_id = o.id
      ) AS total_quantity

    FROM orders o
    INNER JOIN stores s ON s.id = o.store_id

    ${whereClause}

    ORDER BY o.id DESC
    `,
    params
  );

  return orders;
}

async function getStoreOrders(storeId, status = null) {
  const connection = await pool.getConnection();

  try {
    let query = `
      SELECT
        o.id,
        o.order_number,
        o.user_id,
        o.store_id,
        o.address_id,

        o.delivery_full_name,
        o.delivery_mobile,
        o.delivery_address_line_1,
        o.delivery_address_line_2,
        o.delivery_area,
        o.delivery_landmark,
        o.delivery_city,
        o.delivery_state,
        o.delivery_pincode,

        o.status,
        o.payment_status,
        o.payment_method,

        o.subtotal,
        o.delivery_fee,
        o.discount_amount,
        o.tax_amount,
        o.total_amount,

        o.customer_note,
        o.placed_at,
        o.confirmed_at,
        o.delivered_at,
        o.cancelled_at,
        o.cancellation_reason,

        o.created_at,
        o.updated_at

      FROM orders o
      WHERE o.store_id = ?
    `;

    const params = [storeId];

    if (status) {
      query += ` AND o.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY o.id DESC`;

    const [orders] = await connection.query(query, params);

    return orders;
  } finally {
    connection.release();
  }
}

async function getManagerStoreId(userId) {
  const [rows] = await pool.query(
    `
    SELECT id
    FROM stores
    WHERE manager_id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0]?.id ?? null;
}

async function updateStoreOrderStatus({
  orderId,
  managerUserId,
  status,
  note = null,
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Get manager's assigned store
    const [managerStores] = await connection.query(
      `
        SELECT store_id
        FROM store_manager_assignments
        WHERE manager_user_id = ?
          AND is_active = 1
        LIMIT 1
      `,
      [managerUserId]
    );

    if (managerStores.length === 0) {
      throw new Error('No store is assigned to this manager');
    }

    const storeId = managerStores[0].store_id;

    // 2. Validate requested status
    const allowedStatuses = [
      'confirmed',
      'preparing',
      'ready_for_pickup',
    ];

    if (!allowedStatuses.includes(status)) {
      throw new Error('Invalid order status');
    }

    // 3. Get order belonging to manager's store
    const [orders] = await connection.query(
      `
        SELECT
          id,
          order_number,
          store_id,
          status,
          payment_status,
          total_amount
        FROM orders
        WHERE id = ?
          AND store_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [orderId, storeId]
    );

    if (orders.length === 0) {
      throw new Error('Order not found for this store');
    }

    const order = orders[0];

    // 4. Validate status transition
    const allowedTransitions = {
      pending: ['confirmed'],
      confirmed: ['preparing'],
      preparing: ['ready_for_pickup'],
    };

    const nextStatuses = allowedTransitions[order.status] || [];

    if (!nextStatuses.includes(status)) {
      throw new Error(
        `Order cannot be changed from ${order.status} to ${status}`
      );
    }

    // 5. Prepare timestamp update
    let timestampQuery = '';

    if (status === 'confirmed') {
      timestampQuery = ', confirmed_at = NOW()';
    }

    // 6. Update order status
    await connection.query(
      `
        UPDATE orders
        SET
          status = ?,
          updated_at = NOW()
          ${timestampQuery}
        WHERE id = ?
          AND store_id = ?
      `,
      [status, orderId, storeId]
    );

    // 7. Add status history
    await connection.query(
      `
        INSERT INTO order_status_history (
          order_id,
          status,
          changed_by_user_id,
          note
        )
        VALUES (?, ?, ?, ?)
      `,
      [
        orderId,
        status,
        managerUserId,
        note || null,
      ]
    );

    // 8. Fetch updated order
    const [updatedOrders] = await connection.query(
      `
        SELECT
          id,
          order_number,
          user_id,
          store_id,
          status,
          payment_status,
          payment_method,
          subtotal,
          delivery_fee,
          discount_amount,
          tax_amount,
          total_amount,
          customer_note,
          placed_at,
          confirmed_at,
          delivered_at,
          cancelled_at,
          cancellation_reason,
          created_at,
          updated_at
        FROM orders
        WHERE id = ?
        LIMIT 1
      `,
      [orderId]
    );

    await connection.commit();

    return updatedOrders[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function assignDeliveryPartner(orderId, deliveryPartnerId, assignedByUserId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // --------------------------------------------------
    // 1. Get order
    // --------------------------------------------------
    const [orders] = await connection.query(
      `
      SELECT
        id,
        order_number,
        store_id,
        status
      FROM orders
      WHERE id = ?
      LIMIT 1
      `,
      [orderId]
    );

    if (orders.length === 0) {
      throw new Error('Order not found');
    }

    const order = orders[0];

    // --------------------------------------------------
    // 2. Order must be ready for pickup
    // --------------------------------------------------
    if (order.status !== 'ready_for_pickup') {
      throw new Error(
        'Only ready_for_pickup orders can be assigned to a delivery partner'
      );
    }

    // --------------------------------------------------
    // 3. Check existing active assignment
    // --------------------------------------------------
    const [existingAssignments] = await connection.query(
      `
      SELECT
        id,
        delivery_partner_id,
        status
      FROM order_delivery_assignments
      WHERE order_id = ?
        AND status IN (
          'assigned',
          'accepted',
          'picked_up',
          'out_for_delivery'
        )
      LIMIT 1
      `,
      [orderId]
    );

    if (existingAssignments.length > 0) {
      throw new Error(
        'Order is already assigned to a delivery partner'
      );
    }

    // --------------------------------------------------
    // 4. Check delivery partner
    // --------------------------------------------------
    const [partners] = await connection.query(
      `
      SELECT
        u.id,
        u.full_name,
        u.mobile,
        u.is_active,

        dp.id AS profile_id,
        dp.vehicle_type,
        dp.vehicle_number,
        dp.current_latitude,
        dp.current_longitude,
        dp.is_online,
        dp.verification_status

      FROM users u

      INNER JOIN delivery_partner_profiles dp
        ON dp.user_id = u.id

      WHERE dp.id = ?
        AND u.role = 'delivery_partner'

      LIMIT 1
      `,
      [deliveryPartnerId]
    );

    if (partners.length === 0) {
      throw new Error('Delivery partner not found');
    }

    const partner = partners[0];

    // --------------------------------------------------
    // 5. Partner must be active
    // --------------------------------------------------
    if (!partner.is_active) {
      throw new Error('Delivery partner is inactive');
    }

    // --------------------------------------------------
    // 6. Partner must be verified
    // --------------------------------------------------
    if (partner.verification_status !== 'verified') {
      throw new Error(
        'Delivery partner must be verified before assignment'
      );
    }

    // --------------------------------------------------
    // 7. Partner must be online
    // --------------------------------------------------
    if (!partner.is_online) {
      throw new Error(
        'Delivery partner is currently offline'
      );
    }

    // --------------------------------------------------
    // 8. Check if partner already has active delivery
    // --------------------------------------------------
    const [activeAssignments] = await connection.query(
      `
      SELECT
        id,
        order_id,
        status
      FROM order_delivery_assignments
      WHERE delivery_partner_id = ?
        AND status IN (
          'assigned',
          'accepted',
          'picked_up',
          'out_for_delivery'
        )
      LIMIT 1
      `,
      [deliveryPartnerId]
    );

    if (activeAssignments.length > 0) {
      throw new Error(
        'Delivery partner already has an active delivery'
      );
    }

    // --------------------------------------------------
    // 9. Create assignment
    // --------------------------------------------------
    const [result] = await connection.query(
      `
      INSERT INTO order_delivery_assignments (
        order_id,
        delivery_partner_id,
        status,
        assigned_at,
        assigned_by_user_id
      )
      VALUES (?, ?, 'assigned', CURRENT_TIMESTAMP, ?)
      `,
      [
        orderId,
        deliveryPartnerId,
        assignedByUserId,
      ]
    );

    const assignmentId = result.insertId;

    // --------------------------------------------------
    // 10. Get created assignment
    // --------------------------------------------------
    const [assignments] = await connection.query(
      `
      SELECT
        oda.id,
        oda.order_id,
        oda.delivery_partner_id,
        oda.status,
        oda.assigned_at,
        oda.accepted_at,
        oda.rejected_at,
        oda.picked_up_at,
        oda.delivered_at,
        oda.cancelled_at,
        oda.rejection_reason,
        oda.cancellation_reason,
        oda.assigned_by_user_id,

        o.order_number,
        o.store_id,
        o.status AS order_status,

        u.full_name AS delivery_partner_name,
        u.mobile AS delivery_partner_mobile,

        dp.vehicle_type,
        dp.vehicle_number,
        dp.current_latitude,
        dp.current_longitude

      FROM order_delivery_assignments oda

INNER JOIN orders o
  ON o.id = oda.order_id

INNER JOIN delivery_partner_profiles dp
  ON dp.id = oda.delivery_partner_id

INNER JOIN users u
  ON u.id = dp.user_id

WHERE oda.id = ?

LIMIT 1
      `,
      [assignmentId]
    );

    await connection.commit();

    return assignments[0];

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createOrder,
  getCustomerOrders,
  getCustomerOrderById,
  getManagementOrders,
  cancelCustomerOrder,
  getStoreOrders,
  getManagerStoreId,
  updateStoreOrderStatus,
  assignDeliveryPartner,
};