const pool = require('../config/database');
const db = require('../config/database');

async function getAllDeliveryPartners(storeId = null) {
  validateStoreId(storeId);

  const params = [];

  const storeCondition =
    storeId === null
      ? ''
      : `
        AND EXISTS (
          SELECT 1
          FROM order_delivery_assignments oda
          INNER JOIN orders o
            ON o.id = oda.order_id
          WHERE oda.delivery_partner_id = dp.id
            AND o.store_id = ?
        )
      `;

  if (storeId !== null) {
    params.push(Number(storeId));
  }

  const [rows] = await pool.query(
    `
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.mobile,
      u.is_active,
      u.created_at,

      dp.id AS profile_id,
      dp.vehicle_type,
      dp.vehicle_number,
      dp.driving_license_number,
      dp.emergency_contact_name,
      dp.emergency_contact_mobile,
      dp.current_latitude,
      dp.current_longitude,
      dp.is_online,
      dp.verification_status,
      dp.verified_at,

      EXISTS (
        SELECT 1
        FROM order_delivery_assignments active_assignment
        WHERE active_assignment.delivery_partner_id = dp.id
          AND active_assignment.status IN (
            'assigned',
            'accepted',
            'picked_up',
            'out_for_delivery'
          )
      ) AS has_active_delivery

    FROM users u
    INNER JOIN delivery_partner_profiles dp
      ON dp.user_id = u.id

    WHERE u.role = 'delivery_partner'
    ${storeCondition}

    ORDER BY u.created_at DESC, u.id DESC
    `,
    params
  );

  return rows.map(normalizePartner);
}

function validPositiveId(value) {
  return (
    (typeof value === 'string' || typeof value === 'number') &&
    /^[1-9]\d*$/.test(String(value)) &&
    Number.isSafeInteger(Number(value))
  );
}

function validateStoreId(storeId) {
  if (storeId !== null && !validPositiveId(storeId)) {
    throw new Error('Invalid store ID');
  }
}

function normalizePartner(partner) {
  return {
    ...partner,
    is_active:
      partner.is_active === true ||
      Number(partner.is_active) === 1,
    is_online:
      partner.is_online === true ||
      Number(partner.is_online) === 1,
    ...(partner.has_active_delivery !== undefined
      ? {
          has_active_delivery:
            partner.has_active_delivery === true ||
            Number(partner.has_active_delivery) === 1,
        }
      : {}),
  };
}

async function getManagerStoreId(managerUserId) {
  if (!validPositiveId(managerUserId)) {
    throw new Error('Invalid manager user ID');
  }

  const [rows] = await pool.query(
    `
    SELECT id
    FROM stores
    WHERE manager_id = ?
    LIMIT 1
    `,
    [Number(managerUserId)]
  );

  if (!rows.length) return null;

  if (!validPositiveId(rows[0].id)) {
    throw new Error('Invalid assigned store ID');
  }

  return Number(rows[0].id);
}

async function getDeliveryPartnerById(id, storeId = null) {
  if (!validPositiveId(id)) {
    throw new Error('Invalid delivery partner ID');
  }

  validateStoreId(storeId);

  const params = [Number(id)];

  const storeCondition =
    storeId === null
      ? ''
      : `
        AND EXISTS (
          SELECT 1
          FROM order_delivery_assignments oda
          INNER JOIN orders o
            ON o.id = oda.order_id
          WHERE oda.delivery_partner_id = dp.id
            AND o.store_id = ?
        )
      `;

  if (storeId !== null) {
    params.push(Number(storeId));
  }

  const [rows] = await pool.query(
    `
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.mobile,
      u.role,
      u.is_active,
      u.created_at,

      dp.id AS profile_id,
      dp.vehicle_type,
      dp.vehicle_number,
      dp.driving_license_number,
      dp.emergency_contact_name,
      dp.emergency_contact_mobile,
      dp.current_latitude,
      dp.current_longitude,
      dp.is_online,
      dp.verification_status,
      dp.verified_at,
      dp.created_at AS profile_created_at,
      dp.updated_at AS profile_updated_at,

      EXISTS (
        SELECT 1
        FROM order_delivery_assignments active_assignment
        WHERE active_assignment.delivery_partner_id = dp.id
          AND active_assignment.status IN (
            'assigned',
            'accepted',
            'picked_up',
            'out_for_delivery'
          )
      ) AS has_active_delivery

    FROM users u
    INNER JOIN delivery_partner_profiles dp
      ON dp.user_id = u.id

    WHERE u.id = ?
      AND u.role = 'delivery_partner'
      ${storeCondition}

    LIMIT 1
    `,
    params
  );

  if (!rows.length) {
    const error = new Error('Delivery partner not found');
    error.statusCode = 404;
    throw error;
  }

  return normalizePartner(rows[0]);
}

async function verifyDeliveryPartner(id) {
  const [result] = await pool.query(`
    UPDATE delivery_partner_profiles dp
    INNER JOIN users u
      ON u.id = dp.user_id
    SET
      dp.verification_status = 'verified',
      dp.verified_at = CURRENT_TIMESTAMP
    WHERE dp.user_id = ?
      AND u.role = 'delivery_partner'
      AND dp.verification_status IN ('pending', 'rejected')
  `, [id]);

  if (result.affectedRows === 0) {
    throw new Error(
      'Delivery partner not found or already verified'
    );
  }

  return getDeliveryPartnerById(id);
}

async function rejectDeliveryPartner(id) {
  const [result] = await pool.query(`
    UPDATE delivery_partner_profiles dp
    INNER JOIN users u
      ON u.id = dp.user_id
    SET
      dp.verification_status = 'rejected',
      dp.verified_at = NULL
    WHERE dp.user_id = ?
      AND u.role = 'delivery_partner'
      AND dp.verification_status IN ('pending', 'verified')
  `, [id]);

  if (result.affectedRows === 0) {
    throw new Error(
      'Delivery partner not found or already rejected'
    );
  }

  return getDeliveryPartnerById(id);
}

async function updateOnlineStatus(userId, isOnline) {
  const [partners] = await pool.query(
    `
    SELECT
      dp.id,
      dp.user_id,
      dp.verification_status,
      dp.is_online
    FROM delivery_partner_profiles dp
    INNER JOIN users u
      ON u.id = dp.user_id
    WHERE dp.user_id = ?
      AND u.role = 'delivery_partner'
    LIMIT 1
    `,
    [userId]
  );

  if (partners.length === 0) {
    throw new Error('Delivery partner not found');
  }

  const partner = partners[0];

  // Only verified partner can go online
  if (isOnline && partner.verification_status !== 'verified') {
    throw new Error(
      'Delivery partner must be verified before going online'
    );
  }

  await pool.query(
    `
    UPDATE delivery_partner_profiles
    SET is_online = ?
    WHERE user_id = ?
    `,
    [isOnline ? 1 : 0, userId]
  );

  return getDeliveryPartnerById(userId);
}


async function updateDeliveryPartnerLocation(
  userId,
  latitude,
  longitude
) {
  const [partners] = await pool.query(
    `
    SELECT
      dp.id,
      dp.user_id,
      dp.verification_status,
      dp.is_online
    FROM delivery_partner_profiles dp
    INNER JOIN users u
      ON u.id = dp.user_id
    WHERE dp.user_id = ?
      AND u.role = 'delivery_partner'
    LIMIT 1
    `,
    [userId]
  );

  if (partners.length === 0) {
    throw new Error('Delivery partner not found');
  }

  const partner = partners[0];

  if (partner.verification_status !== 'verified') {
    throw new Error(
      'Only verified delivery partners can update location'
    );
  }

  await pool.query(
    `
    UPDATE delivery_partner_profiles
    SET
      current_latitude = ?,
      current_longitude = ?
    WHERE user_id = ?
    `,
    [latitude, longitude, userId]
  );

  return getDeliveryPartnerById(userId);
}

async function getAvailableDeliveryPartners() {
  const [rows] = await pool.query(`
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.mobile,
      dp.id AS profile_id,
      dp.vehicle_type,
      dp.vehicle_number,
      dp.current_latitude,
      dp.current_longitude,
      dp.is_online,
      dp.verification_status
    FROM users u
    INNER JOIN delivery_partner_profiles dp
      ON dp.user_id = u.id
    WHERE u.role = 'delivery_partner'
      AND u.is_active = 1
      AND dp.is_online = 1
      AND dp.verification_status = 'verified'
    ORDER BY u.full_name ASC
  `);

  return rows;
}

const getMyDeliveryOrders = async (userId) => {
  const connection = await db.getConnection();

  try {
    // Find delivery partner profile
    const [profiles] = await connection.query(
      `
      SELECT
        dp.id AS profile_id,
        u.id AS user_id,
        u.full_name,
        u.mobile
      FROM delivery_partner_profiles dp
      INNER JOIN users u
        ON u.id = dp.user_id
      WHERE dp.user_id = ?
        AND u.role = 'delivery_partner'
      LIMIT 1
      `,
      [userId]
    );

    if (profiles.length === 0) {
      throw new Error('Delivery partner profile not found');
    }

    const profileId = profiles[0].profile_id;

    // Get assigned orders
    const [orders] = await connection.query(
      `
      SELECT
        oda.id AS assignment_id,
        oda.status AS assignment_status,
        oda.assigned_at,
        oda.accepted_at,
        oda.rejected_at,
        oda.picked_up_at,
        oda.delivered_at,
        oda.rejection_reason,
        oda.cancellation_reason,

        o.id AS order_id,
        o.order_number,
        o.status AS order_status,
        o.payment_status,
        o.payment_method,
        o.subtotal,
        o.delivery_fee,
        o.discount_amount,
        o.tax_amount,
        o.total_amount,
        o.customer_note,
        o.placed_at,
        o.delivery_full_name,
        o.delivery_mobile,

        u.id AS customer_id,
        u.full_name AS customer_name,
        u.mobile AS customer_mobile

      FROM order_delivery_assignments oda

      INNER JOIN orders o
        ON o.id = oda.order_id

      INNER JOIN users u
        ON u.id = o.user_id

      WHERE oda.delivery_partner_id = ?

      ORDER BY oda.created_at DESC
      `,
      [profileId]
    );

    return orders;
  } finally {
    connection.release();
  }
};

const acceptDeliveryOrder = async (userId, assignmentId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Get delivery partner profile
    const [profiles] = await connection.query(
      `
      SELECT
        dp.id AS profile_id,
        dp.verification_status,
        dp.is_online,
        u.id AS user_id,
        u.is_active
      FROM delivery_partner_profiles dp
      INNER JOIN users u
        ON u.id = dp.user_id
      WHERE dp.user_id = ?
        AND u.role = 'delivery_partner'
      LIMIT 1
      `,
      [userId]
    );

    if (profiles.length === 0) {
      throw new Error('Delivery partner profile not found');
    }

    const partner = profiles[0];

    if (!partner.is_active) {
      throw new Error('Delivery partner account is inactive');
    }

    if (partner.verification_status !== 'verified') {
      throw new Error('Delivery partner is not verified');
    }

    if (!partner.is_online) {
      throw new Error('Delivery partner is offline');
    }

    // Get assignment
    const [assignments] = await connection.query(
      `
      SELECT
        oda.id,
        oda.order_id,
        oda.delivery_partner_id,
        oda.status,
        o.status AS order_status
      FROM order_delivery_assignments oda
      INNER JOIN orders o
        ON o.id = oda.order_id
      WHERE oda.id = ?
        AND oda.delivery_partner_id = ?
      LIMIT 1
      `,
      [assignmentId, partner.profile_id]
    );

    if (assignments.length === 0) {
      throw new Error('Delivery assignment not found');
    }

    const assignment = assignments[0];

    if (assignment.status !== 'assigned') {
      throw new Error(
        `Order cannot be accepted because assignment status is ${assignment.status}`
      );
    }

    if (assignment.order_status !== 'ready_for_pickup') {
      throw new Error(
        `Order cannot be accepted because order status is ${assignment.order_status}`
      );
    }

    // Accept assignment
    await connection.query(
      `
      UPDATE order_delivery_assignments
      SET
        status = 'accepted',
        accepted_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND delivery_partner_id = ?
      `,
      [assignmentId, partner.profile_id]
    );

    await connection.commit();

    return {
      assignment_id: assignment.id,
      order_id: assignment.order_id,
      assignment_status: 'accepted',
      order_status: assignment.order_status,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};


const rejectDeliveryOrder = async (userId, assignmentId, rejectionReason) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Get delivery partner profile
    const [profiles] = await connection.query(
      `
      SELECT
        dp.id AS profile_id,
        dp.verification_status,
        u.id AS user_id,
        u.is_active
      FROM delivery_partner_profiles dp
      INNER JOIN users u
        ON u.id = dp.user_id
      WHERE dp.user_id = ?
        AND u.role = 'delivery_partner'
      LIMIT 1
      `,
      [userId]
    );

    if (profiles.length === 0) {
      throw new Error('Delivery partner profile not found');
    }

    const partner = profiles[0];

    if (!partner.is_active) {
      throw new Error('Delivery partner account is inactive');
    }

    if (partner.verification_status !== 'verified') {
      throw new Error('Delivery partner is not verified');
    }

    // Get assignment
    const [assignments] = await connection.query(
      `
      SELECT
        oda.id,
        oda.order_id,
        oda.delivery_partner_id,
        oda.status,
        o.status AS order_status
      FROM order_delivery_assignments oda
      INNER JOIN orders o
        ON o.id = oda.order_id
      WHERE oda.id = ?
        AND oda.delivery_partner_id = ?
      LIMIT 1
      `,
      [assignmentId, partner.profile_id]
    );

    if (assignments.length === 0) {
      throw new Error('Delivery assignment not found');
    }

    const assignment = assignments[0];

    if (assignment.status !== 'assigned') {
      throw new Error(
        `Order cannot be rejected because assignment status is ${assignment.status}`
      );
    }

    if (assignment.order_status !== 'ready_for_pickup') {
      throw new Error(
        `Order cannot be rejected because order status is ${assignment.order_status}`
      );
    }

    const reason =
      rejectionReason && rejectionReason.trim()
        ? rejectionReason.trim()
        : null;

    // Reject assignment
    await connection.query(
      `
      UPDATE order_delivery_assignments
      SET
        status = 'rejected',
        rejected_at = CURRENT_TIMESTAMP,
        rejection_reason = ?
      WHERE id = ?
        AND delivery_partner_id = ?
      `,
      [reason, assignmentId, partner.profile_id]
    );

    await connection.commit();

    return {
      assignment_id: assignment.id,
      order_id: assignment.order_id,
      assignment_status: 'rejected',
      order_status: assignment.order_status,
      rejection_reason: reason,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const pickupDeliveryOrder = async (userId, assignmentId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Get delivery partner profile
    const [profiles] = await connection.query(
      `
      SELECT
        dp.id AS profile_id,
        dp.verification_status,
        u.is_active
      FROM delivery_partner_profiles dp
      INNER JOIN users u
        ON u.id = dp.user_id
      WHERE dp.user_id = ?
        AND u.role = 'delivery_partner'
      LIMIT 1
      `,
      [userId]
    );

    if (profiles.length === 0) {
      throw new Error('Delivery partner profile not found');
    }

    const partner = profiles[0];

    if (!partner.is_active) {
      throw new Error('Delivery partner account is inactive');
    }

    if (partner.verification_status !== 'verified') {
      throw new Error('Delivery partner is not verified');
    }

    // Get assignment + order
    const [assignments] = await connection.query(
      `
      SELECT
        oda.id,
        oda.order_id,
        oda.status AS assignment_status,
        o.status AS order_status
      FROM order_delivery_assignments oda
      INNER JOIN orders o
        ON o.id = oda.order_id
      WHERE oda.id = ?
        AND oda.delivery_partner_id = ?
      LIMIT 1
      `,
      [assignmentId, partner.profile_id]
    );

    if (assignments.length === 0) {
      throw new Error('Delivery assignment not found');
    }

    const assignment = assignments[0];

    if (assignment.assignment_status !== 'accepted') {
      throw new Error(
        `Order cannot be picked up because assignment status is ${assignment.assignment_status}`
      );
    }

    if (assignment.order_status !== 'ready_for_pickup') {
      throw new Error(
        `Order cannot be picked up because order status is ${assignment.order_status}`
      );
    }

    // Update assignment
    await connection.query(
      `
      UPDATE order_delivery_assignments
      SET
        status = 'picked_up',
        picked_up_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND delivery_partner_id = ?
      `,
      [assignmentId, partner.profile_id]
    );

    // Update main order
    await connection.query(
      `
      UPDATE orders
      SET
        status = 'out_for_delivery'
      WHERE id = ?
      `,
      [assignment.order_id]
    );

    // Add order status history
    await connection.query(
      `
      INSERT INTO order_status_history (
        order_id,
        status,
        changed_by_user_id,
        note
      )
      VALUES (?, 'out_for_delivery', ?, ?)
      `,
      [
        assignment.order_id,
        userId,
        'Order picked up by delivery partner',
      ]
    );

    await connection.commit();

    return {
      assignment_id: assignment.id,
      order_id: assignment.order_id,
      assignment_status: 'picked_up',
      order_status: 'out_for_delivery',
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deliverDeliveryOrder = async (userId, assignmentId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Get delivery partner profile
    const [profiles] = await connection.query(
      `
      SELECT
        dp.id AS profile_id,
        dp.verification_status,
        u.is_active
      FROM delivery_partner_profiles dp
      INNER JOIN users u
        ON u.id = dp.user_id
      WHERE dp.user_id = ?
        AND u.role = 'delivery_partner'
      LIMIT 1
      `,
      [userId]
    );

    if (profiles.length === 0) {
      throw new Error('Delivery partner profile not found');
    }

    const partner = profiles[0];

    if (!partner.is_active) {
      throw new Error('Delivery partner account is inactive');
    }

    if (partner.verification_status !== 'verified') {
      throw new Error('Delivery partner is not verified');
    }

    // Get assignment + order
    const [assignments] = await connection.query(
      `
      SELECT
        oda.id,
        oda.order_id,
        oda.status AS assignment_status,
        o.status AS order_status
      FROM order_delivery_assignments oda
      INNER JOIN orders o
        ON o.id = oda.order_id
      WHERE oda.id = ?
        AND oda.delivery_partner_id = ?
      LIMIT 1
      `,
      [assignmentId, partner.profile_id]
    );

    if (assignments.length === 0) {
      throw new Error('Delivery assignment not found');
    }

    const assignment = assignments[0];

    if (assignment.assignment_status !== 'picked_up') {
      throw new Error(
        `Order cannot be delivered because assignment status is ${assignment.assignment_status}`
      );
    }

    if (assignment.order_status !== 'out_for_delivery') {
      throw new Error(
        `Order cannot be delivered because order status is ${assignment.order_status}`
      );
    }

    // Update assignment
    await connection.query(
      `
      UPDATE order_delivery_assignments
      SET
        status = 'delivered',
        delivered_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND delivery_partner_id = ?
      `,
      [assignmentId, partner.profile_id]
    );

    // Update main order
    await connection.query(
      `
      UPDATE orders
      SET
        status = 'delivered',
        delivered_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [assignment.order_id]
    );

    // Add order status history
    await connection.query(
      `
      INSERT INTO order_status_history (
        order_id,
        status,
        changed_by_user_id,
        note
      )
      VALUES (?, 'delivered', ?, ?)
      `,
      [
        assignment.order_id,
        userId,
        'Order delivered by delivery partner',
      ]
    );

    await connection.commit();

    return {
      assignment_id: assignment.id,
      order_id: assignment.order_id,
      assignment_status: 'delivered',
      order_status: 'delivered',
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getManagerStoreId,
  getAllDeliveryPartners,
  getDeliveryPartnerById,
  verifyDeliveryPartner,
  rejectDeliveryPartner,
  updateOnlineStatus,
  updateDeliveryPartnerLocation,
  getAvailableDeliveryPartners,
  getMyDeliveryOrders,
  acceptDeliveryOrder,
  rejectDeliveryOrder,
  pickupDeliveryOrder,
  deliverDeliveryOrder,
};