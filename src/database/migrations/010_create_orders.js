
module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        order_number VARCHAR(50) NOT NULL UNIQUE,

        user_id BIGINT UNSIGNED NOT NULL,
        store_id BIGINT UNSIGNED NOT NULL,
        address_id BIGINT UNSIGNED NOT NULL,

        /*
         * Delivery address snapshot.
         * This preserves the address used at the time of ordering.
         */
        delivery_full_name VARCHAR(150) NOT NULL,
        delivery_mobile VARCHAR(20) NULL,

        delivery_address_line_1 VARCHAR(255) NOT NULL,
        delivery_address_line_2 VARCHAR(255) NULL,

        delivery_area VARCHAR(150) NULL,
        delivery_landmark VARCHAR(255) NULL,

        delivery_city VARCHAR(100) NOT NULL,
        delivery_state VARCHAR(100) NOT NULL,
        delivery_pincode VARCHAR(10) NOT NULL,

        delivery_latitude DECIMAL(10,8) NULL,
        delivery_longitude DECIMAL(11,8) NULL,

        status ENUM(
          'pending',
          'confirmed',
          'preparing',
          'ready_for_pickup',
          'out_for_delivery',
          'delivered',
          'cancelled',
          'returned'
        ) NOT NULL DEFAULT 'pending',

        payment_status ENUM(
          'pending',
          'paid',
          'failed',
          'refunded',
          'partially_refunded'
        ) NOT NULL DEFAULT 'pending',

        payment_method ENUM(
          'cod',
          'online'
        ) NOT NULL DEFAULT 'cod',

        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,

        customer_note TEXT NULL,

        placed_at TIMESTAMP NULL,
        confirmed_at TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        cancelled_at TIMESTAMP NULL,

        cancellation_reason VARCHAR(500) NULL,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_orders_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT
          ON UPDATE CASCADE,

        CONSTRAINT fk_orders_store
          FOREIGN KEY (store_id)
          REFERENCES stores(id)
          ON DELETE RESTRICT
          ON UPDATE CASCADE,

        CONSTRAINT fk_orders_address
          FOREIGN KEY (address_id)
          REFERENCES addresses(id)
          ON DELETE RESTRICT
          ON UPDATE CASCADE,

        INDEX idx_orders_user (user_id),
        INDEX idx_orders_store (store_id),
        INDEX idx_orders_address (address_id),
        INDEX idx_orders_status (status),
        INDEX idx_orders_payment_status (payment_status),
        INDEX idx_orders_created_at (created_at),
        INDEX idx_orders_store_status (store_id, status),
        INDEX idx_orders_user_status (user_id, status)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};
