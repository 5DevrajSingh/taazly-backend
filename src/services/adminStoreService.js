const db = require('../config/database');

/**
 * Get all stores for Admin
 */
async function getAllStoresForAdmin() {
  const [rows] = await db.query(`
    SELECT
      id,
      name,
      store_code,
      city,
      state,
      pincode,
      logo,
      status,
      opening_time,
      closing_time,
      manager_id,
      created_at
    FROM stores
    ORDER BY id ASC
  `);

  return rows;
}

module.exports = {
  getAllStoresForAdmin,
};