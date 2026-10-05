const db = require('../config/database');


/**
 * Admin Dashboard
 *
 * store_id:
 *   undefined/null => All Stores
 *   number         => Selected Store
 */
async function getAdminDashboard(storeId = null) {
  // --------------------------------------------------
  // Store filter
  // --------------------------------------------------
  let storeCondition = '';
  let storeParams = [];

  if (storeId !== null && storeId !== undefined) {
    storeCondition = ' AND o.store_id = ? ';
    storeParams.push(storeId);
  }

  // --------------------------------------------------
  // SALES
  // --------------------------------------------------

  // Today's sales
  const [todaySalesRows] = await db.query(
    `
      SELECT COALESCE(SUM(total_amount), 0) AS sales
      FROM orders o
      WHERE DATE(o.created_at) = CURDATE()
      ${storeCondition}
      AND o.status NOT IN ('cancelled', 'returned')
    `,
    storeParams
  );

  // Weekly sales
  const [weeklySalesRows] = await db.query(
    `
      SELECT COALESCE(SUM(total_amount), 0) AS sales
      FROM orders o
      WHERE YEARWEEK(o.created_at, 1) = YEARWEEK(CURDATE(), 1)
      ${storeCondition}
      AND o.status NOT IN ('cancelled', 'returned')
    `,
    storeParams
  );

  // Monthly sales
  const [monthlySalesRows] = await db.query(
    `
      SELECT COALESCE(SUM(total_amount), 0) AS sales
      FROM orders o
      WHERE YEAR(o.created_at) = YEAR(CURDATE())
      AND MONTH(o.created_at) = MONTH(CURDATE())
      ${storeCondition}
      AND o.status NOT IN ('cancelled', 'returned')
    `,
    storeParams
  );

  // Total sales
  const [totalSalesRows] = await db.query(
    `
      SELECT COALESCE(SUM(total_amount), 0) AS sales
      FROM orders o
      WHERE 1 = 1
      ${storeCondition}
      AND o.status NOT IN ('cancelled', 'returned')
    `,
    storeParams
  );

  // --------------------------------------------------
  // ORDERS
  // --------------------------------------------------

  const [orderRows] = await db.query(
    `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN o.status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN o.status = 'returned' THEN 1 ELSE 0 END) AS returned
      FROM orders o
      WHERE 1 = 1
      ${storeCondition}
    `,
    storeParams
  );

  // --------------------------------------------------
  // CUSTOMERS
  //
  // Customer count is based on customers who have
  // placed orders for the selected store.
  // --------------------------------------------------

  let customerCondition = '';

  if (storeId !== null && storeId !== undefined) {
    customerCondition = ' AND o.store_id = ? ';
  }

  const customerParams =
    storeId !== null && storeId !== undefined
      ? [storeId]
      : [];

  const [customerRows] = await db.query(
    `
      SELECT
        COUNT(DISTINCT o.user_id) AS total
      FROM orders o
      WHERE o.user_id IS NOT NULL
      ${customerCondition}
    `,
    customerParams
  );

  // --------------------------------------------------
  // ACTIVE CUSTOMERS
  //
  // Customers who have placed an order in the
  // selected store during the last 30 days.
  // --------------------------------------------------

  const [activeCustomerRows] = await db.query(
    `
      SELECT
        COUNT(DISTINCT o.user_id) AS active
      FROM orders o
      WHERE o.user_id IS NOT NULL
      AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ${customerCondition}
    `,
    customerParams
  );

  // --------------------------------------------------
  // DELIVERY PARTNERS
  //
  // Total delivery partners are global users.
  // Active delivery partners are active users.
  //
  // If store-specific assignment exists, this can
  // later be changed to store-wise assignment.
  // --------------------------------------------------

  const [deliveryPartnerRows] = await db.query(
    `
      SELECT
        COUNT(*) AS total,
        SUM(
          CASE
            WHEN is_active = 1 THEN 1
            ELSE 0
          END
        ) AS active
      FROM users
      WHERE role = 'delivery_partner'
    `
  );

  // --------------------------------------------------
  // PRODUCTS
  // --------------------------------------------------

  let productCondition = '';
  let productParams = [];

  if (storeId !== null && storeId !== undefined) {
    productCondition = ' WHERE p.store_id = ? ';
    productParams.push(storeId);
  }

  const [productRows] = await db.query(
    `
      SELECT
        COUNT(*) AS total,
        SUM(
          CASE
            WHEN p.is_active = 1 THEN 1
            ELSE 0
          END
        ) AS active
      FROM products p
      ${productCondition}
    `,
    productParams
  );

  // --------------------------------------------------
  // LOW STOCK
  //
  // store_inventory is store-specific.
  // Assuming quantity is the current stock quantity.
  // --------------------------------------------------

  let inventoryCondition = '';
  let inventoryParams = [];

  if (storeId !== null && storeId !== undefined) {
    inventoryCondition = ' AND si.store_id = ? ';
    inventoryParams.push(storeId);
  }

  const [lowStockRows] = await db.query(
  `
    SELECT COUNT(*) AS lowStock
    FROM store_inventory si
    WHERE si.stock_quantity <= si.low_stock_threshold
    ${inventoryCondition}
  `,
  inventoryParams
);

  // --------------------------------------------------
  // ORDER STATUS GRAPH
  // --------------------------------------------------

  const [orderStatusRows] = await db.query(
    `
      SELECT
        o.status,
        COUNT(*) AS count
      FROM orders o
      WHERE 1 = 1
      ${storeCondition}
      GROUP BY o.status
      ORDER BY o.status
    `,
    storeParams
  );

  // --------------------------------------------------
  // MONTHLY SALES GRAPH
  // Last 12 months
  // --------------------------------------------------



  // --------------------------------------------------
  // SELECTED STORE
  // --------------------------------------------------

  let selectedStore = null;

  if (storeId !== null && storeId !== undefined) {
    const [storeRows] = await db.query(
      `
        SELECT
          id,
          name,
          store_code,
          city,
          state,
          status
        FROM stores
        WHERE id = ?
        LIMIT 1
      `,
      [storeId]
    );

    if (storeRows.length === 0) {
      const error = new Error('Store not found');
      error.statusCode = 404;
      throw error;
    }

    selectedStore = storeRows[0];
  }

  // --------------------------------------------------
  // FINAL RESPONSE
  // --------------------------------------------------

  return {
    selectedStore,

    sales: {
      today: Number(todaySalesRows[0].sales || 0),
      weekly: Number(weeklySalesRows[0].sales || 0),
      monthly: Number(monthlySalesRows[0].sales || 0),
      total: Number(totalSalesRows[0].sales || 0),
    },

    orders: {
      total: Number(orderRows[0].total || 0),
      pending: Number(orderRows[0].pending || 0),
      delivered: Number(orderRows[0].delivered || 0),
      cancelled: Number(orderRows[0].cancelled || 0),
      returned: Number(orderRows[0].returned || 0),
    },

    customers: {
      total: Number(customerRows[0].total || 0),
      active: Number(activeCustomerRows[0].active || 0),
    },

    deliveryPartners: {
      total: Number(deliveryPartnerRows[0].total || 0),
      active: Number(deliveryPartnerRows[0].active || 0),
    },

    products: {
      total: Number(productRows[0].total || 0),
      active: Number(productRows[0].active || 0),
      lowStock: Number(lowStockRows[0].lowStock || 0),
    },

    graphs: {
      orderStatus: orderStatusRows.map((row) => ({
        status: row.status,
        count: Number(row.count || 0),
      })),

      monthlySales: monthlySalesRows.map((row) => ({
        month: row.month,
        sales: Number(row.sales || 0),
      })),
    },
  };
}

module.exports = {
  getAdminDashboard,
};