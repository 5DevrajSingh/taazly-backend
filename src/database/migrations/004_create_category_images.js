module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS category_images (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        category_id BIGINT UNSIGNED NOT NULL,
        image_id BIGINT UNSIGNED NOT NULL,

        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INT NOT NULL DEFAULT 0,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_category_images_category
          FOREIGN KEY (category_id)
          REFERENCES categories(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        CONSTRAINT fk_category_images_image
          FOREIGN KEY (image_id)
          REFERENCES images(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        UNIQUE KEY unique_category_image (category_id, image_id),

        INDEX idx_category_images_category (category_id),
        INDEX idx_category_images_image (image_id),
        INDEX idx_category_images_primary (category_id, is_primary)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};