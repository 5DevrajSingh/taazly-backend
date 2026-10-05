
module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        full_name VARCHAR(150) NOT NULL,

        email VARCHAR(150) NULL,
        mobile VARCHAR(20) NOT NULL,

        password_hash VARCHAR(255) NOT NULL,

        role ENUM(
          'admin',
          'store_manager',
          'customer',
          'delivery_partner'
        ) NOT NULL DEFAULT 'customer',

        is_active BOOLEAN NOT NULL DEFAULT TRUE,

        last_login_at TIMESTAMP NULL,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY unique_users_mobile (mobile),
        UNIQUE KEY unique_users_email (email),

        INDEX idx_users_role (role),
        INDEX idx_users_active (is_active),
        INDEX idx_users_created_at (created_at)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};