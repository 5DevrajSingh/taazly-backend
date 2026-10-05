module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        name VARCHAR(150) NOT NULL,
        slug VARCHAR(180) NOT NULL UNIQUE,
        store_code VARCHAR(50) NOT NULL UNIQUE,

        phone VARCHAR(20) NULL,
        email VARCHAR(150) NULL,

        address_line1 VARCHAR(255) NULL,
        address_line2 VARCHAR(255) NULL,
        city VARCHAR(100) NULL,
        state VARCHAR(100) NULL,
        pincode VARCHAR(10) NULL,

        latitude DECIMAL(10, 8) NULL,
        longitude DECIMAL(11, 8) NULL,

        opening_time TIME NULL,
        closing_time TIME NULL,

        logo VARCHAR(500) NULL,

        status ENUM(
          'active',
          'inactive',
          'closed'
        ) NOT NULL DEFAULT 'active',

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_stores_name (name),
        INDEX idx_stores_status (status),
        INDEX idx_stores_city (city)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};