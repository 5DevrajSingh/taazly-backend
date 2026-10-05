module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS store_inventory (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        store_id BIGINT UNSIGNED NOT NULL,
        product_id BIGINT UNSIGNED NOT NULL,

        selling_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,

        stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
        low_stock_threshold INT UNSIGNED NOT NULL DEFAULT 5,

        is_available BOOLEAN NOT NULL DEFAULT TRUE,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_store_inventory_store
          FOREIGN KEY (store_id)
          REFERENCES stores(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        CONSTRAINT fk_store_inventory_product
          FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        UNIQUE KEY unique_store_product (store_id, product_id),

        INDEX idx_store_inventory_store (store_id),
        INDEX idx_store_inventory_product (product_id),
        INDEX idx_store_inventory_available (store_id, is_available),
        INDEX idx_store_inventory_stock (store_id, stock_quantity)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};