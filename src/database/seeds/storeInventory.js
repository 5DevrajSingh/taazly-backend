module.exports = async function seedStoreInventory(connection) {
  const [stores] = await connection.query(`
    SELECT id, store_code
    FROM stores
    WHERE is_active = TRUE
  `);

  const [products] = await connection.query(`
    SELECT id, sku, base_price
    FROM products
    WHERE is_active = TRUE
  `);

  for (const store of stores) {
    for (const product of products) {
      let sellingPrice = Number(product.base_price);

      // Different stores can have different selling prices.
      if (store.store_code === 'TAAZLY-NOI-001') {
        sellingPrice += 2;
      }

      if (store.store_code === 'TAAZLY-GGN-001') {
        sellingPrice += 3;
      }

      await connection.query(
        `
        INSERT INTO store_inventory (
          store_id,
          product_id,
          selling_price,
          stock_quantity,
          low_stock_threshold,
          is_available
        )
        VALUES (?, ?, ?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE
          selling_price = VALUES(selling_price),
          stock_quantity = VALUES(stock_quantity),
          low_stock_threshold = VALUES(low_stock_threshold),
          is_available = VALUES(is_available)
        `,
        [
          store.id,
          product.id,
          sellingPrice,
          50,
          5,
        ]
      );
    }
  }

  console.log('Store inventory seeded successfully.');
};