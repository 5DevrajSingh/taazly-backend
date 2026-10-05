
module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_delivery_assignments (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        order_id BIGINT UNSIGNED NOT NULL,
        delivery_partner_id BIGINT UNSIGNED NOT NULL,

        status ENUM(
          'assigned',
          'accepted',
          'rejected',
          'picked_up',
          'out_for_delivery',
          'delivered',
          'cancelled'
        ) NOT NULL DEFAULT 'assigned',

        assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

        accepted_at TIMESTAMP NULL,
        rejected_at TIMESTAMP NULL,
        picked_up_at TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        cancelled_at TIMESTAMP NULL,

        rejection_reason VARCHAR(500) NULL,
        cancellation_reason VARCHAR(500) NULL,

        assigned_by_user_id BIGINT UNSIGNED NULL,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_order_delivery_assignments_order
          FOREIGN KEY (order_id)
          REFERENCES orders(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        CONSTRAINT fk_order_delivery_assignments_partner
          FOREIGN KEY (delivery_partner_id)
          REFERENCES delivery_partner_profiles(id)
          ON DELETE RESTRICT
          ON UPDATE CASCADE,

        CONSTRAINT fk_order_delivery_assignments_assigned_by
          FOREIGN KEY (assigned_by_user_id)
          REFERENCES users(id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,

        INDEX idx_order_delivery_assignments_order (order_id),
        INDEX idx_order_delivery_assignments_partner (delivery_partner_id),
        INDEX idx_order_delivery_assignments_status (status),
        INDEX idx_order_delivery_assignments_assigned_at (assigned_at),

        INDEX idx_order_delivery_partner_status (
          delivery_partner_id,
          status
        )
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};