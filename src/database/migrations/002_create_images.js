module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS images (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_url VARCHAR(1000) NULL,

        mime_type VARCHAR(100) NULL,
        file_size BIGINT UNSIGNED NULL,

        width INT UNSIGNED NULL,
        height INT UNSIGNED NULL,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_images_file_name (file_name)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};