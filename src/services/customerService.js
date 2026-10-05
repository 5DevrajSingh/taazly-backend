const pool = require('../config/database');

function normalizeCustomer(customer) {
  return {
    ...customer,
    is_active:
      customer.is_active === true ||
      Number(customer.is_active) === 1,
  };
}

async function getManagerStoreId(managerUserId) {
  const userId = Number(managerUserId);

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('Invalid manager user ID');
  }

  // stores.manager_id is the current manager assignment.
  const [rows] = await pool.query(
    `
    SELECT id
    FROM stores
    WHERE manager_id = ?
    LIMIT 1
    `,
    [userId]
  );

  if (!rows.length) return null;

  const storeId = Number(rows[0].id);

  if (!Number.isSafeInteger(storeId) || storeId <= 0) {
    throw new Error('Invalid assigned store ID');
  }

  return storeId;
}

async function getCustomers(storeId = null) {
  if (
    storeId !== null &&
    (!Number.isSafeInteger(storeId) || storeId <= 0)
  ) {
    throw new Error('Invalid store ID');
  }

  const params = [];

  const storeCondition =
    storeId === null
      ? ''
      : `
        AND EXISTS (
          SELECT 1
          FROM orders o
          WHERE o.user_id = u.id
            AND o.store_id = ?
        )
      `;

  if (storeId !== null) {
    params.push(storeId);
  }

  const [rows] = await pool.query(
    `
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.mobile,
      u.profile_img,
      u.is_active,
      u.last_login_at,
      u.created_at
    FROM users u
    WHERE u.role = 'customer'
    ${storeCondition}
    ORDER BY u.id DESC
    `,
    params
  );

  // EXISTS keeps each customer listed once, even with multiple orders.
  return rows.map(normalizeCustomer);
}

async function setCustomerStatus(customerId, isActive) {
  if (!Number.isSafeInteger(customerId) || customerId <= 0) {
    throw new Error('Invalid customer ID');
  }

  if (typeof isActive !== 'boolean') {
    throw new Error('Customer status must be a boolean');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
      SELECT id
      FROM users
      WHERE id = ?
        AND role = 'customer'
      LIMIT 1
      FOR UPDATE
      `,
      [customerId]
    );

    if (!rows.length) {
      await connection.rollback();
      return null;
    }

    await connection.query(
      `
      UPDATE users
      SET is_active = ?
      WHERE id = ?
        AND role = 'customer'
      `,
      [isActive ? 1 : 0, customerId]
    );

    const [customers] = await connection.query(
      `
      SELECT
        id,
        full_name,
        email,
        mobile,
        profile_img,
        is_active,
        last_login_at,
        created_at
      FROM users
      WHERE id = ?
        AND role = 'customer'
      LIMIT 1
      `,
      [customerId]
    );

    await connection.commit();

    return normalizeCustomer(customers[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getManagerStoreId,
  getCustomers,
  setCustomerStatus,
};