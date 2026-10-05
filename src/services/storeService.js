const pool = require('../config/database');

const {
  hashPassword,
} = require('../utils/password');

async function createStore({
  name,
  slug,
  storeCode,
  phone,
  email,
  addressLine1,
  addressLine2,
  city,
  state,
  pincode,
  latitude,
  longitude,
  openingTime,
  closingTime,
  logo,
}) {
  const [existingStores] = await pool.query(
    `
      SELECT id, slug, store_code
      FROM stores
      WHERE slug = ? OR store_code = ?
      LIMIT 1
    `,
    [slug, storeCode]
  );

  if (existingStores.length > 0) {
    const existing = existingStores[0];

    if (existing.slug === slug) {
      throw new Error('Store slug already exists');
    }

    if (existing.store_code === storeCode) {
      throw new Error('Store code already exists');
    }
  }

  const [result] = await pool.query(
    `
      INSERT INTO stores (
        name,
        slug,
        store_code,
        phone,
        email,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        latitude,
        longitude,
        opening_time,
        closing_time,
        logo,
        manager_id,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'active')
    `,
    [
      name,
      slug,
      storeCode,
      phone || null,
      email || null,
      addressLine1 || null,
      addressLine2 || null,
      city || null,
      state || null,
      pincode || null,
      latitude ?? null,
      longitude ?? null,
      openingTime || null,
      closingTime || null,
      logo || null,
    ]
  );

  const [stores] = await pool.query(
    `
      SELECT
        id,
        name,
        slug,
        store_code,
        phone,
        email,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        latitude,
        longitude,
        opening_time,
        closing_time,
        logo,
        manager_id,
        status,
        created_at,
        updated_at
      FROM stores
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return stores[0];
}

async function createStoreManager({
  storeId,
  fullName,
  email,
  mobile,
  password,
  assignedByUserId,
}) {
  if (!Number.isSafeInteger(storeId) || storeId <= 0) {
    throw new Error('Valid store ID is required');
  }

  if (
    !Number.isSafeInteger(assignedByUserId) ||
    assignedByUserId <= 0
  ) {
    throw new Error('Valid assigning admin ID is required');
  }

  if (typeof fullName !== 'string' || !fullName.trim()) {
    throw new Error('Manager full name is required');
  }

  if (
    typeof mobile !== 'string' ||
    !/^\d{10}$/.test(mobile.trim())
  ) {
    throw new Error('Valid 10-digit mobile number is required');
  }

  if (typeof password !== 'string' || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  if (
    email != null &&
    (
      typeof email !== 'string' ||
      (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    )
  ) {
    throw new Error('Valid email address is required');
  }

  const managerName = fullName.trim();
  const managerMobile = mobile.trim();
  const managerEmail = email?.trim() || null;

  // Hash before opening the transaction to reduce lock duration.
  const passwordHash = await hashPassword(password);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock and check store.
    const [stores] = await connection.query(
      `
      SELECT
        id,
        name,
        manager_id,
        status
      FROM stores
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [storeId]
    );

    if (stores.length === 0) {
      throw new Error('Store not found');
    }

    const store = stores[0];

    // 2. Creation must not replace an existing manager.
    if (store.manager_id != null) {
      throw new Error(
        'This store already has a manager. Use Change Manager.'
      );
    }

    // 3. Check mobile across all user roles.
    const [existingMobile] = await connection.query(
      `
      SELECT id
      FROM users
      WHERE mobile = ?
      LIMIT 1
      `,
      [managerMobile]
    );

    if (existingMobile.length > 0) {
      throw new Error('Mobile number is already registered');
    }

    // 4. Check optional email.
    if (managerEmail) {
      const [existingEmail] = await connection.query(
        `
        SELECT id
        FROM users
        WHERE email = ?
        LIMIT 1
        `,
        [managerEmail]
      );

      if (existingEmail.length > 0) {
        throw new Error('Email is already registered');
      }
    }

    // 5. Create manager account.
    const [userResult] = await connection.query(
      `
      INSERT INTO users (
        full_name,
        email,
        mobile,
        password_hash,
        role,
        is_active
      )
      VALUES (?, ?, ?, ?, 'store_manager', TRUE)
      `,
      [
        managerName,
        managerEmail,
        managerMobile,
        passwordHash,
      ]
    );

    const managerId = userResult.insertId;

    // 6. Assign new manager to store.
    await connection.query(
      `
      UPDATE stores
      SET manager_id = ?
      WHERE id = ?
      `,
      [managerId, storeId]
    );

    // 7. Deactivate stale active assignments for this store.
    await connection.query(
      `
      UPDATE store_manager_assignments
      SET is_active = FALSE
      WHERE store_id = ?
        AND is_active = TRUE
      `,
      [storeId]
    );

    // 8. Save assignment with the assigning admin's ID.
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

    // 9. Fetch manager without password fields.
    const [managers] = await connection.query(
      `
      SELECT
        id,
        full_name,
        email,
        mobile,
        role,
        is_active,
        created_at
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [managerId]
    );

    // 10. Fetch updated store.
    const [updatedStores] = await connection.query(
      `
      SELECT
        id,
        name,
        store_code,
        manager_id,
        status
      FROM stores
      WHERE id = ?
      LIMIT 1
      `,
      [storeId]
    );

    await connection.commit();

    return {
      manager: managers[0],
      store: updatedStores[0],
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getAllStores() {
  const [stores] = await pool.query(`
    SELECT
      s.id,
      s.name,
      s.slug,
      s.store_code,
      s.phone,
      s.email,
      s.address_line1,
      s.address_line2,
      s.city,
      s.state,
      s.pincode,
      s.latitude,
      s.longitude,
      s.opening_time,
      s.closing_time,
      s.logo,
      s.manager_id,
      s.status,
      s.created_at,
      s.updated_at,

      u.full_name AS manager_name,
      u.email AS manager_email,
      u.mobile AS manager_mobile

    FROM stores s

    LEFT JOIN users u
      ON u.id = s.manager_id

    ORDER BY s.id DESC
  `);

  return stores;
}

async function getStoreById(storeId) {
  const [stores] = await pool.query(
    `
      SELECT
        s.id,
        s.name,
        s.slug,
        s.store_code,
        s.phone,
        s.email,
        s.address_line1,
        s.address_line2,
        s.city,
        s.state,
        s.pincode,
        s.latitude,
        s.longitude,
        s.opening_time,
        s.closing_time,
        s.logo,
        s.manager_id,
        s.status,
        s.created_at,
        s.updated_at,

        u.full_name AS manager_name,
        u.email AS manager_email,
        u.mobile AS manager_mobile,
        u.is_active AS manager_is_active

      FROM stores s

      LEFT JOIN users u
        ON u.id = s.manager_id

      WHERE s.id = ?
      LIMIT 1
    `,
    [storeId]
  );

  if (stores.length === 0) {
    throw new Error('Store not found');
  }

  return stores[0];
}

async function getActiveStores() {
  const [stores] = await pool.query(`
    SELECT
      id,
      name,
      city,
      state,
      latitude,
      longitude
    FROM stores
    WHERE status = 'active'
    ORDER BY name ASC, id ASC
  `);

  return stores;
}

module.exports = {
  createStore,
  createStoreManager,
  getAllStores,
  getActiveStores,
  getStoreById
};