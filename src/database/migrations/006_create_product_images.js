module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        product_id BIGINT UNSIGNED NOT NULL,
        image_id BIGINT UNSIGNED NOT NULL,

        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INT NOT NULL DEFAULT 0,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_product_images_product
          FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        CONSTRAINT fk_product_images_image
          FOREIGN KEY (image_id)
          REFERENCES images(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        UNIQUE KEY unique_product_image (product_id, image_id),

        INDEX idx_product_images_product (product_id),
        INDEX idx_product_images_image (image_id),
        INDEX idx_product_images_primary (product_id, is_primary)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};