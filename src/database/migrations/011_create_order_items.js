
module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        order_id BIGINT UNSIGNED NOT NULL,
        product_id BIGINT UNSIGNED NOT NULL,
        store_inventory_id BIGINT UNSIGNED NOT NULL,

        product_name VARCHAR(200) NOT NULL,
        sku VARCHAR(100) NOT NULL,
        unit VARCHAR(50) NULL,

        quantity INT UNSIGNED NOT NULL DEFAULT 1,

        unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_order_items_order
          FOREIGN KEY (order_id)
          REFERENCES orders(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        CONSTRAINT fk_order_items_product
          FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON DELETE RESTRICT
          ON UPDATE CASCADE,

        CONSTRAINT fk_order_items_inventory
          FOREIGN KEY (store_inventory_id)
          REFERENCES store_inventory(id)
          ON DELETE RESTRICT
          ON UPDATE CASCADE,

        INDEX idx_order_items_order (order_id),
        INDEX idx_order_items_product (product_id),
        INDEX idx_order_items_inventory (store_inventory_id),
        INDEX idx_order_items_sku (sku)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};
