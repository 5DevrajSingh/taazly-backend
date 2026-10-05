
module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_status_history (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        order_id BIGINT UNSIGNED NOT NULL,

        status ENUM(
          'pending',
          'confirmed',
          'preparing',
          'ready_for_pickup',
          'out_for_delivery',
          'delivered',
          'cancelled',
          'returned'
        ) NOT NULL,

        changed_by_user_id BIGINT UNSIGNED NULL,

        note VARCHAR(500) NULL,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_order_status_history_order
          FOREIGN KEY (order_id)
          REFERENCES orders(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        CONSTRAINT fk_order_status_history_user
          FOREIGN KEY (changed_by_user_id)
          REFERENCES users(id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,

        INDEX idx_order_status_history_order (order_id),
        INDEX idx_order_status_history_status (status),
        INDEX idx_order_status_history_user (changed_by_user_id),
        INDEX idx_order_status_history_created_at (created_at)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};
