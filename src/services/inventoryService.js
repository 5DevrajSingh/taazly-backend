const pool = require('../config/database');

/**
 * Get all inventory items of a store
 */
async function getStoreInventory(storeId) {
  const [rows] = await pool.query(
    `
    SELECT
      si.id,
      si.store_id,
      si.product_id,

      p.name AS product_name,
      p.sku,
      p.unit,
      p.base_price,

      (
  SELECT i.file_url
  FROM product_images pi
  INNER JOIN images i ON i.id = pi.image_id
  WHERE pi.product_id = p.id
    AND pi.is_primary = TRUE
  ORDER BY pi.sort_order ASC, pi.id ASC
  LIMIT 1
) AS product_image,

      si.selling_price,
      si.stock_quantity,
      si.low_stock_threshold,
      si.is_available,

      si.created_at,
      si.updated_at

    FROM store_inventory si

    INNER JOIN products p
      ON p.id = si.product_id
      AND p.store_id = si.store_id

    WHERE si.store_id = ?

    ORDER BY si.id DESC
    `,
    [storeId]
  );

  return rows;
}

/**
 * Get inventory of a single product
 */
async function getInventoryByProduct(productId, storeId) {
  const [rows] = await pool.query(
    `
    SELECT
      si.id,
      si.store_id,
      si.product_id,

      p.name AS product_name,
      p.sku,
      p.unit,
      p.base_price,

      (
  SELECT i.file_url
  FROM product_images pi
  INNER JOIN images i ON i.id = pi.image_id
  WHERE pi.product_id = p.id
    AND pi.is_primary = TRUE
  ORDER BY pi.sort_order ASC, pi.id ASC
  LIMIT 1
) AS product_image,

      si.selling_price,
      si.stock_quantity,
      si.low_stock_threshold,
      si.is_available,

      si.created_at,
      si.updated_at

    FROM store_inventory si

    INNER JOIN products p
      ON p.id = si.product_id
      AND p.store_id = si.store_id

    WHERE si.product_id = ?
      AND si.store_id = ?

    LIMIT 1
    `,
    [productId, storeId]
  );

  return rows[0] || null;
}

/**
 * Create inventory for a product
 */
async function createInventory({
  store_id,
  product_id,
  selling_price,
  stock_quantity,
  low_stock_threshold,
  is_available,
}) {
  /*
   * Verify product belongs to this store
   */
  const [productRows] = await pool.query(
    `
    SELECT id
    FROM products
    WHERE id = ?
      AND store_id = ?
      AND is_active = TRUE
    LIMIT 1
    `,
    [product_id, store_id]
  );

  if (productRows.length === 0) {
    const error = new Error(
      'Product does not belong to this store or is inactive'
    );

    error.code = 'INVALID_PRODUCT';

    throw error;
  }

  /*
   * Check whether inventory already exists
   */
  const [existingRows] = await pool.query(
    `
    SELECT id
    FROM store_inventory
    WHERE store_id = ?
      AND product_id = ?
    LIMIT 1
    `,
    [store_id, product_id]
  );

  if (existingRows.length > 0) {
    const error = new Error(
      'Inventory already exists for this product'
    );

    error.code = 'INVENTORY_EXISTS';

    throw error;
  }

  const [result] = await pool.query(
    `
    INSERT INTO store_inventory (
      store_id,
      product_id,
      selling_price,
      stock_quantity,
      low_stock_threshold,
      is_available
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      store_id,
      product_id,
      selling_price ?? 0,
      stock_quantity ?? 0,
      low_stock_threshold ?? 5,
      is_available ?? true,
    ]
  );

  return getInventoryByProduct(product_id, store_id);
}

/**
 * Update inventory
 */
async function updateInventory(
  productId,
  storeId,
  {
    selling_price,
    stock_quantity,
    low_stock_threshold,
    is_available,
  }
) {
  const [result] = await pool.query(
    `
    UPDATE store_inventory
    SET
      selling_price = ?,
      stock_quantity = ?,
      low_stock_threshold = ?,
      is_available = ?
    WHERE product_id = ?
      AND store_id = ?
    `,
    [
      selling_price,
      stock_quantity,
      low_stock_threshold,
      is_available ?? true,
      productId,
      storeId,
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getInventoryByProduct(productId, storeId);
}

/**
 * Update stock quantity
 */
async function updateStock(
  productId,
  storeId,
  stockQuantity
) {
  const [result] = await pool.query(
    `
    UPDATE store_inventory
    SET stock_quantity = ?
    WHERE product_id = ?
      AND store_id = ?
    `,
    [
      stockQuantity,
      productId,
      storeId,
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getInventoryByProduct(productId, storeId);
}

/**
 * Update product availability
 */
async function updateAvailability(
  productId,
  storeId,
  isAvailable
) {
  const [result] = await pool.query(
    `
    UPDATE store_inventory
    SET is_available = ?
    WHERE product_id = ?
      AND store_id = ?
    `,
    [
      isAvailable,
      productId,
      storeId,
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getInventoryByProduct(productId, storeId);
}

module.exports = {
  getStoreInventory,
  getInventoryByProduct,
  createInventory,
  updateInventory,
  updateStock,
  updateAvailability,
};