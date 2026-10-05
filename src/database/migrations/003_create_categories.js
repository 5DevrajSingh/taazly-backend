
module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        store_id BIGINT UNSIGNED NOT NULL,

        name VARCHAR(150) NOT NULL,
        slug VARCHAR(180) NOT NULL,
        description TEXT NULL,

        sort_order INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_categories_store
          FOREIGN KEY (store_id)
          REFERENCES stores(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        UNIQUE KEY uq_categories_store_slug (store_id, slug),

        INDEX idx_categories_store (store_id),
        INDEX idx_categories_name (name),
        INDEX idx_categories_active (is_active),
        INDEX idx_categories_sort_order (sort_order)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};
