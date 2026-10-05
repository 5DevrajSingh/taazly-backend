const pool = require('../config/database');

function serviceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateUserId(userId) {
  const id = Number(userId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw serviceError(401, 'Invalid login session');
  }

  return id;
}

async function readProfile(database, userId) {
  const [users] = await database.query(
    `
    SELECT
      id,
      full_name,
      email,
      mobile,
      role,
      profile_img,
      is_active,
      last_login_at,
      created_at
    FROM users
    WHERE id = ?
      AND role IN ('admin', 'store_manager')
    LIMIT 1
    `,
    [userId]
  );

  if (!users.length) {
    throw serviceError(404, 'Profile not found');
  }

  const user = {
    ...users[0],
    is_active:
      users[0].is_active === true ||
      Number(users[0].is_active) === 1,
  };

  if (!user.is_active) {
    throw serviceError(403, 'Your account is inactive');
  }

  let store = null;

  if (user.role === 'store_manager') {
    const [stores] = await database.query(
      `
      SELECT
        id,
        name,
        store_code,
        city,
        state,
        status
      FROM stores
      WHERE manager_id = ?
      LIMIT 1
      `,
      [userId]
    );

    store = stores[0] || null;
  }

  return { user, store };
}

async function getMyProfile(userId) {
  return readProfile(pool, validateUserId(userId));
}

async function updateMyProfile(userId, fields) {
  const id = validateUserId(userId);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [users] = await connection.query(
      `
      SELECT id, role, is_active
      FROM users
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [id]
    );

    if (!users.length) {
      throw serviceError(404, 'Profile not found');
    }

    if (!['admin', 'store_manager'].includes(users[0].role)) {
      throw serviceError(403, 'Access denied');
    }

    if (
      users[0].is_active !== true &&
      Number(users[0].is_active) !== 1
    ) {
      throw serviceError(403, 'Your account is inactive');
    }

    const [duplicates] = await connection.query(
      `
      SELECT id
      FROM users
      WHERE mobile = ?
        AND id <> ?
      LIMIT 1
      `,
      [fields.mobile, id]
    );

    if (duplicates.length) {
      throw serviceError(
        409,
        'This mobile number is already registered'
      );
    }

    // Only explicitly allowed profile fields are updated.
    await connection.query(
      `
      UPDATE users
      SET
        full_name = ?,
        email = ?,
        mobile = ?
      WHERE id = ?
      `,
      [
        fields.full_name,
        fields.email,
        fields.mobile,
        id,
      ]
    );

    const profile = await readProfile(connection, id);

    await connection.commit();

    return profile;
  } catch (error) {
    await connection.rollback();

    // The database unique constraint handles concurrent mobile updates.
    if (error.code === 'ER_DUP_ENTRY') {
      throw serviceError(
        409,
        'Mobile number or email is already registered'
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getMyProfile,
  updateMyProfile,
};