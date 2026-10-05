
module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS addresses (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        user_id BIGINT UNSIGNED NOT NULL,

        address_type ENUM(
          'home',
          'work',
          'other'
        ) NOT NULL DEFAULT 'home',

        full_name VARCHAR(150) NOT NULL,
        mobile VARCHAR(20) NULL,

        address_line_1 VARCHAR(255) NOT NULL,
        address_line_2 VARCHAR(255) NULL,

        area VARCHAR(150) NULL,
        landmark VARCHAR(255) NULL,

        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        pincode VARCHAR(10) NOT NULL,

        latitude DECIMAL(10,8) NULL,
        longitude DECIMAL(11,8) NULL,

        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_addresses_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        INDEX idx_addresses_user (user_id),
        INDEX idx_addresses_city (city),
        INDEX idx_addresses_pincode (pincode),
        INDEX idx_addresses_active (user_id, is_active),
        INDEX idx_addresses_default (user_id, is_default)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};
