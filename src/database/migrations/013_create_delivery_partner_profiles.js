
module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS delivery_partner_profiles (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        user_id BIGINT UNSIGNED NOT NULL UNIQUE,

        vehicle_type ENUM(
          'bike',
          'scooter',
          'cycle',
          'other'
        ) NOT NULL DEFAULT 'bike',

        vehicle_number VARCHAR(30) NULL,
        driving_license_number VARCHAR(100) NULL,

        emergency_contact_name VARCHAR(150) NULL,
        emergency_contact_mobile VARCHAR(20) NULL,

        current_latitude DECIMAL(10,8) NULL,
        current_longitude DECIMAL(11,8) NULL,

        is_online BOOLEAN NOT NULL DEFAULT FALSE,

        verification_status ENUM(
          'pending',
          'verified',
          'rejected'
        ) NOT NULL DEFAULT 'pending',

        verified_at TIMESTAMP NULL,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_delivery_partner_profiles_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        UNIQUE KEY unique_vehicle_number (vehicle_number),
        UNIQUE KEY unique_driving_license (driving_license_number),

        INDEX idx_delivery_partner_online (is_online),
        INDEX idx_delivery_partner_verification (verification_status)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};