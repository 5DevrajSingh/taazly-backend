
module.exports = {
  async up(connection) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS store_manager_assignments (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

        store_id BIGINT UNSIGNED NOT NULL,
        manager_user_id BIGINT UNSIGNED NOT NULL,

        assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

        unassigned_at TIMESTAMP NULL,

        is_active BOOLEAN NOT NULL DEFAULT TRUE,

        assigned_by_user_id BIGINT UNSIGNED NULL,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_store_manager_assignments_store
          FOREIGN KEY (store_id)
          REFERENCES stores(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        CONSTRAINT fk_store_manager_assignments_manager
          FOREIGN KEY (manager_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT
          ON UPDATE CASCADE,

        CONSTRAINT fk_store_manager_assignments_assigned_by
          FOREIGN KEY (assigned_by_user_id)
          REFERENCES users(id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,

        UNIQUE KEY uq_store_manager_assignment_store (store_id),

        INDEX idx_store_manager_assignment_manager (
          manager_user_id
        ),

        INDEX idx_store_manager_assignment_active (
          is_active
        ),

        INDEX idx_store_manager_assignment_manager_active (
          manager_user_id,
          is_active
        )
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  },
};
