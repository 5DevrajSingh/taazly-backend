const pool = require('../config/database');

async function getStoreManagers() {
  const [rows] = await pool.query(
    `
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.mobile,
      u.is_active,
      u.created_at,

      s.id AS store_id,
      s.name AS store_name,
      s.store_code

    FROM users u

    LEFT JOIN stores s
      ON s.manager_id = u.id

    WHERE u.role = 'store_manager'

    ORDER BY u.id DESC
    `
  );

  return rows;
}

async function assignStoreManager({
  storeId,
  managerId,
  assignedByUserId,
  replaceExisting = false,
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock stores first, matching the existing create-manager flow.
    // Locking all stores serializes assignment changes across stores.
    const [stores] = await connection.query(
      `
      SELECT id, name, manager_id
      FROM stores
      ORDER BY id ASC
      FOR UPDATE
      `
    );

    const store = stores.find(
      (item) => Number(item.id) === storeId
    );

    if (!store) {
      const error = new Error('Store not found');
      error.status = 404;
      throw error;
    }

    const [managers] = await connection.query(
      `
      SELECT id, is_active
      FROM users
      WHERE id = ?
        AND role = 'store_manager'
      LIMIT 1
      FOR UPDATE
      `,
      [managerId]
    );

    if (!managers.length) {
      const error = new Error('Store manager not found');
      error.status = 404;
      throw error;
    }

    if (!managers[0].is_active) {
      const error = new Error('Inactive manager cannot be assigned');
      error.status = 400;
      throw error;
    }

    const otherStore = stores.find(
      (item) =>
        item.manager_id != null &&
        Number(item.manager_id) === managerId &&
        Number(item.id) !== storeId
    );

    if (otherStore) {
      const error = new Error(
        `Manager is already assigned to ${otherStore.name}`
      );
      error.status = 409;
      throw error;
    }

    const previousManagerId = store.manager_id;

    if (
      previousManagerId != null &&
      Number(previousManagerId) !== managerId &&
      !replaceExisting
    ) {
      const error = new Error(
        'This store already has a manager. Use Change Manager.'
      );
      error.status = 409;
      throw error;
    }

    // Deactivate previous assignment records for this store
    // and any stale assignments for the selected manager.
    await connection.query(
      `
      UPDATE store_manager_assignments
      SET is_active = FALSE
      WHERE is_active = TRUE
        AND (
          store_id = ?
          OR manager_user_id = ?
        )
      `,
      [storeId, managerId]
    );

    await connection.query(
      `
      UPDATE stores
      SET manager_id = ?
      WHERE id = ?
      `,
      [managerId, storeId]
    );

    // Reuse an existing pair if present.
    // This also supports schemas with a unique store-manager pair.
    const [assignments] = await connection.query(
      `
      SELECT id
      FROM store_manager_assignments
      WHERE store_id = ?
        AND manager_user_id = ?
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE
      `,
      [storeId, managerId]
    );

    if (assignments.length) {
      await connection.query(
        `
        UPDATE store_manager_assignments
        SET
          is_active = TRUE,
          assigned_by_user_id = ?
        WHERE id = ?
        `,
        [assignedByUserId, assignments[0].id]
      );
    } else {
      await connection.query(
        `
        INSERT INTO store_manager_assignments (
          store_id,
          manager_user_id,
          assigned_by_user_id,
          is_active
        )
        VALUES (?, ?, ?, TRUE)
        `,
        [storeId, managerId, assignedByUserId]
      );
    }

    await connection.commit();

    return {
      store_id: storeId,
      store_name: store.name,
      manager_id: managerId,
      previous_manager_id: previousManagerId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getStoreManagers,
  assignStoreManager,
};