
module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        store_id BIGINT UNSIGNED NOT NULL,
        category_id BIGINT UNSIGNED NOT NULL,

        name VARCHAR(200) NOT NULL,
        slug VARCHAR(220) NOT NULL,

        description TEXT NULL,

        sku VARCHAR(100) NOT NULL,

        unit VARCHAR(50) NULL,

        base_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,

        is_active BOOLEAN NOT NULL DEFAULT TRUE,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_products_store
          FOREIGN KEY (store_id)
          REFERENCES stores(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        CONSTRAINT fk_products_category
          FOREIGN KEY (category_id)
          REFERENCES categories(id)
          ON DELETE RESTRICT
          ON UPDATE CASCADE,

        UNIQUE KEY uq_products_store_slug (store_id, slug),
        UNIQUE KEY uq_products_store_sku (store_id, sku),

        INDEX idx_products_store (store_id),
        INDEX idx_products_category (category_id),
        INDEX idx_products_name (name),
        INDEX idx_products_active (is_active)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};
