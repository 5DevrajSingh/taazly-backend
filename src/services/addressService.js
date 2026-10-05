const pool = require('../config/database');

/**
 * Get all active addresses of a customer
 */
async function getCustomerAddresses(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      user_id,
      address_type,
      full_name,
      mobile,
      address_line_1,
      address_line_2,
      area,
      landmark,
      city,
      state,
      pincode,
      latitude,
      longitude,
      is_default,
      is_active,
      created_at,
      updated_at
    FROM addresses
    WHERE user_id = ?
      AND is_active = TRUE
    ORDER BY is_default DESC, id DESC
    `,
    [userId]
  );

  return rows;
}

/**
 * Get single active address
 */
async function getAddressById(id, userId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      user_id,
      address_type,
      full_name,
      mobile,
      address_line_1,
      address_line_2,
      area,
      landmark,
      city,
      state,
      pincode,
      latitude,
      longitude,
      is_default,
      is_active,
      created_at,
      updated_at
    FROM addresses
    WHERE id = ?
      AND user_id = ?
      AND is_active = TRUE
    LIMIT 1
    `,
    [id, userId]
  );

  return rows[0] || null;
}

/**
 * Create address
 */
async function createAddress({
  user_id,
  address_type,
  full_name,
  mobile,
  address_line_1,
  address_line_2,
  area,
  landmark,
  city,
  state,
  pincode,
  latitude,
  longitude,
  is_default,
}) {
  /*
   * If this is the first address,
   * automatically make it default.
   */
  const [countRows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM addresses
    WHERE user_id = ?
      AND is_active = TRUE
    `,
    [user_id]
  );

  let makeDefault = Boolean(is_default);

  if (countRows[0].total === 0) {
    makeDefault = true;
  }

  /*
   * If this address is default,
   * remove default from existing addresses.
   */
  if (makeDefault) {
    await pool.query(
      `
      UPDATE addresses
      SET is_default = FALSE
      WHERE user_id = ?
        AND is_active = TRUE
      `,
      [user_id]
    );
  }

  const [result] = await pool.query(
    `
    INSERT INTO addresses (
      user_id,
      address_type,
      full_name,
      mobile,
      address_line_1,
      address_line_2,
      area,
      landmark,
      city,
      state,
      pincode,
      latitude,
      longitude,
      is_default,
      is_active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
    `,
    [
      user_id,
      address_type || 'home',
      full_name,
      mobile || null,
      address_line_1,
      address_line_2 || null,
      area || null,
      landmark || null,
      city,
      state,
      pincode,
      latitude ?? null,
      longitude ?? null,
      makeDefault,
    ]
  );

  return getAddressById(result.insertId, user_id);
}

/**
 * Update address
 */
async function updateAddress(
  id,
  userId,
  {
    address_type,
    full_name,
    mobile,
    address_line_1,
    address_line_2,
    area,
    landmark,
    city,
    state,
    pincode,
    latitude,
    longitude,
    is_default,
  }
) {
  /*
   * Check address exists
   */
  const existingAddress = await getAddressById(id, userId);

  if (!existingAddress) {
    return null;
  }

  const makeDefault = Boolean(is_default);

  /*
   * If setting this address as default,
   * remove default from other addresses.
   */
  if (makeDefault) {
    await pool.query(
      `
      UPDATE addresses
      SET is_default = FALSE
      WHERE user_id = ?
        AND id != ?
        AND is_active = TRUE
      `,
      [userId, id]
    );
  }

  const [result] = await pool.query(
    `
    UPDATE addresses
    SET
      address_type = ?,
      full_name = ?,
      mobile = ?,
      address_line_1 = ?,
      address_line_2 = ?,
      area = ?,
      landmark = ?,
      city = ?,
      state = ?,
      pincode = ?,
      latitude = ?,
      longitude = ?,
      is_default = ?
    WHERE id = ?
      AND user_id = ?
      AND is_active = TRUE
    `,
    [
      address_type,
      full_name,
      mobile || null,
      address_line_1,
      address_line_2 || null,
      area || null,
      landmark || null,
      city,
      state,
      pincode,
      latitude ?? null,
      longitude ?? null,
      makeDefault,
      id,
      userId,
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getAddressById(id, userId);
}

/**
 * Soft delete address
 */
async function deleteAddress(id, userId) {
  const existingAddress = await getAddressById(id, userId);

  if (!existingAddress) {
    return null;
  }

  const [result] = await pool.query(
    `
    UPDATE addresses
    SET
      is_active = FALSE,
      is_default = FALSE
    WHERE id = ?
      AND user_id = ?
    `,
    [id, userId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  /*
   * If deleted address was default,
   * make the newest active address default.
   */
  if (existingAddress.is_default) {
    const [rows] = await pool.query(
      `
      SELECT id
      FROM addresses
      WHERE user_id = ?
        AND is_active = TRUE
      ORDER BY id DESC
      LIMIT 1
      `,
      [userId]
    );

    if (rows.length > 0) {
      await pool.query(
        `
        UPDATE addresses
        SET is_default = TRUE
        WHERE id = ?
          AND user_id = ?
        `,
        [rows[0].id, userId]
      );
    }
  }

  return true;
}

/**
 * Set address as default
 */
async function setDefaultAddress(id, userId) {
  const existingAddress = await getAddressById(id, userId);

  if (!existingAddress) {
    return null;
  }

  await pool.query(
    `
    UPDATE addresses
    SET is_default = FALSE
    WHERE user_id = ?
      AND is_active = TRUE
    `,
    [userId]
  );

  await pool.query(
    `
    UPDATE addresses
    SET is_default = TRUE
    WHERE id = ?
      AND user_id = ?
      AND is_active = TRUE
    `,
    [id, userId]
  );

  return getAddressById(id, userId);
}

module.exports = {
  getCustomerAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};