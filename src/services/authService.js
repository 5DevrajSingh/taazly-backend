const pool = require('../config/database');

const {
  hashPassword,
  comparePassword,
} = require('../utils/password');

const {
  generateToken,
} = require('../utils/jwt');

const userColumns = `
  id,
  full_name,
  email,
  mobile,
  profile_img,
  role,
  is_active,
  last_login_at,
  created_at
`;

const deliveryProfileColumns = `
  id,
  user_id,
  vehicle_type,
  vehicle_number,
  driving_license_number,
  emergency_contact_name,
  emergency_contact_mobile,
  current_latitude,
  current_longitude,
  is_online,
  verification_status,
  verified_at,
  created_at,
  updated_at
`;

function serviceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function enabled(value) {
  return value === true || Number(value) === 1;
}

function validateUserId(value) {
  if (
    !['string', 'number'].includes(typeof value) ||
    !/^[1-9]\d*$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value))
  ) {
    throw serviceError(401, 'Invalid login session');
  }

  return Number(value);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    mobile: user.mobile,
    profile_img: user.profile_img || null,
    role: user.role,
    is_active: enabled(user.is_active),
    last_login_at: user.last_login_at,
    created_at: user.created_at,
  };
}

function sanitizeDeliveryProfile(profile) {
  return {
    ...profile,
    is_online: enabled(profile.is_online),
  };
}

function optionalText(value, label) {
  if (value === undefined || value === null) return null;

  if (typeof value !== 'string') {
    throw serviceError(400, `${label} must be a string`);
  }

  return value.trim() || null;
}

function validateCredentials(mobile, password) {
  if (
    typeof mobile !== 'string' ||
    !/^\d{10}$/.test(mobile.trim())
  ) {
    throw serviceError(
      400,
      'Enter a valid 10-digit mobile number'
    );
  }

  if (typeof password !== 'string' || !password) {
    throw serviceError(400, 'Password is required');
  }

  return {
    mobile: mobile.trim(),
    password,
  };
}

function validateRegistration(fields) {
  const credentials = validateCredentials(
    fields.mobile,
    fields.password
  );

  if (
    typeof fields.fullName !== 'string' ||
    !fields.fullName.trim()
  ) {
    throw serviceError(400, 'Full name is required');
  }

  const email = optionalText(fields.email, 'Email');

  if (
    email &&
    (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
  ) {
    throw serviceError(400, 'Enter a valid email address');
  }

  return {
    fullName: fields.fullName.trim(),
    email,
    ...credentials,
  };
}

async function getAssignedStore(managerId, required = true) {
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
      status
    FROM stores
    WHERE manager_id = ?
    LIMIT 1
    `,
    [managerId]
  );

  if (!stores.length && required) {
    throw serviceError(
      403,
      'No store assigned to this manager'
    );
  }

  return stores[0] || null;
}

async function login(mobile, password, expectedRole) {
  const credentials = validateCredentials(mobile, password);

  const [users] = await pool.query(
    `
    SELECT
      ${userColumns},
      password_hash
    FROM users
    WHERE mobile = ?
    LIMIT 1
    `,
    [credentials.mobile]
  );

  if (
    !users.length ||
    users[0].role !== expectedRole
  ) {
    throw serviceError(
      401,
      'Invalid mobile number or password'
    );
  }

  const user = users[0];

  const passwordMatched = await comparePassword(
    credentials.password,
    user.password_hash
  );

  if (!passwordMatched) {
    throw serviceError(
      401,
      'Invalid mobile number or password'
    );
  }

  if (!enabled(user.is_active)) {
    throw serviceError(403, 'Your account is inactive');
  }

  let store = null;

  if (user.role === 'store_manager') {
    store = await getAssignedStore(user.id);
  }

  const token = generateToken({
    userId: user.id,
    role: user.role,
  });

  await pool.query(
    `
    UPDATE users
    SET last_login_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [user.id]
  );

  return {
    token,
    user: sanitizeUser({
      ...user,
      last_login_at: new Date(),
    }),
    ...(store ? { store } : {}),
  };
}

async function adminLogin(mobile, password) {
  return login(mobile, password, 'admin');
}

async function storeManagerLogin(mobile, password) {
  return login(mobile, password, 'store_manager');
}

async function customerLogin(mobile, password) {
  return login(mobile, password, 'customer');
}

async function deliveryPartnerLogin(mobile, password) {
  return login(mobile, password, 'delivery_partner');
}

async function checkUserDuplicates(connection, mobile, email) {
  const [existingMobile] = await connection.query(
    `
    SELECT id
    FROM users
    WHERE mobile = ?
    LIMIT 1
    `,
    [mobile]
  );

  if (existingMobile.length) {
    throw serviceError(
      409,
      'Mobile number already registered'
    );
  }

  if (email) {
    const [existingEmail] = await connection.query(
      `
      SELECT id
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    if (existingEmail.length) {
      throw serviceError(409, 'Email already registered');
    }
  }
}

async function insertUser(connection, fields, role, passwordHash) {
  const [result] = await connection.query(
    `
    INSERT INTO users (
      full_name,
      email,
      mobile,
      password_hash,
      role,
      is_active
    )
    VALUES (?, ?, ?, ?, ?, TRUE)
    `,
    [
      fields.fullName,
      fields.email,
      fields.mobile,
      passwordHash,
      role,
    ]
  );

  const [users] = await connection.query(
    `
    SELECT ${userColumns}
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [result.insertId]
  );

  if (!users.length) {
    throw serviceError(500, 'User registration failed');
  }

  return users[0];
}

function registrationError(error) {
  if (error.code === 'ER_DUP_ENTRY') {
    return serviceError(
      409,
      'Registration details are already in use'
    );
  }

  return error;
}

async function registerCustomer(fields) {
  const validated = validateRegistration(fields);
  const passwordHash = await hashPassword(validated.password);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await checkUserDuplicates(
      connection,
      validated.mobile,
      validated.email
    );

    const user = await insertUser(
      connection,
      validated,
      'customer',
      passwordHash
    );

    // Generate before committing, so a token-generation error
    // does not leave a successful registration reported as failed.
    const token = generateToken({
      userId: user.id,
      role: user.role,
    });

    await connection.commit();

    return {
      token,
      user: sanitizeUser(user),
    };
  } catch (error) {
    await connection.rollback();
    throw registrationError(error);
  } finally {
    connection.release();
  }
}

async function registerDeliveryPartner(fields) {
  const validated = validateRegistration(fields);

  const vehicleType =
    fields.vehicleType === undefined
      ? 'bike'
      : fields.vehicleType;

  if (!['bike', 'scooter', 'cycle', 'other'].includes(vehicleType)) {
    throw serviceError(400, 'Invalid vehicle type');
  }

  const vehicleNumber = optionalText(
    fields.vehicleNumber,
    'Vehicle number'
  );

  const drivingLicenseNumber = optionalText(
    fields.drivingLicenseNumber,
    'Driving license number'
  );

  const emergencyContactName = optionalText(
    fields.emergencyContactName,
    'Emergency contact name'
  );

  const emergencyContactMobile = optionalText(
    fields.emergencyContactMobile,
    'Emergency contact mobile'
  );

  if (
    emergencyContactMobile &&
    !/^\d{10}$/.test(emergencyContactMobile)
  ) {
    throw serviceError(
      400,
      'Emergency mobile must contain 10 digits'
    );
  }

  const passwordHash = await hashPassword(validated.password);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await checkUserDuplicates(
      connection,
      validated.mobile,
      validated.email
    );

    if (vehicleNumber) {
      const [vehicles] = await connection.query(
        `
        SELECT id
        FROM delivery_partner_profiles
        WHERE vehicle_number = ?
        LIMIT 1
        `,
        [vehicleNumber]
      );

      if (vehicles.length) {
        throw serviceError(
          409,
          'Vehicle number is already registered'
        );
      }
    }

    if (drivingLicenseNumber) {
      const [licenses] = await connection.query(
        `
        SELECT id
        FROM delivery_partner_profiles
        WHERE driving_license_number = ?
        LIMIT 1
        `,
        [drivingLicenseNumber]
      );

      if (licenses.length) {
        throw serviceError(
          409,
          'Driving license number is already registered'
        );
      }
    }

    const user = await insertUser(
      connection,
      validated,
      'delivery_partner',
      passwordHash
    );

    await connection.query(
      `
      INSERT INTO delivery_partner_profiles (
        user_id,
        vehicle_type,
        vehicle_number,
        driving_license_number,
        emergency_contact_name,
        emergency_contact_mobile,
        is_online,
        verification_status
      )
      VALUES (?, ?, ?, ?, ?, ?, FALSE, 'pending')
      `,
      [
        user.id,
        vehicleType,
        vehicleNumber,
        drivingLicenseNumber,
        emergencyContactName,
        emergencyContactMobile,
      ]
    );

    const [profiles] = await connection.query(
      `
      SELECT ${deliveryProfileColumns}
      FROM delivery_partner_profiles
      WHERE user_id = ?
      LIMIT 1
      `,
      [user.id]
    );

    if (!profiles.length) {
      throw serviceError(
        500,
        'Delivery partner profile creation failed'
      );
    }

    const token = generateToken({
      userId: user.id,
      role: user.role,
    });

    await connection.commit();

    return {
      token,
      user: sanitizeUser(user),
      profile: sanitizeDeliveryProfile(profiles[0]),
    };
  } catch (error) {
    await connection.rollback();
    throw registrationError(error);
  } finally {
    connection.release();
  }
}

async function getMyProfile(userId) {
  const id = validateUserId(userId);

  const [users] = await pool.query(
    `
    SELECT ${userColumns}
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  if (!users.length) {
    throw serviceError(404, 'User not found');
  }

  const user = users[0];

  if (!enabled(user.is_active)) {
    throw serviceError(403, 'Your account is inactive');
  }

  let store = null;
  let profile = null;

  if (user.role === 'store_manager') {
    // Missing assignment is allowed when viewing the profile.
    // Database errors still propagate.
    store = await getAssignedStore(user.id, false);
  }

  if (user.role === 'delivery_partner') {
    const [profiles] = await pool.query(
      `
      SELECT ${deliveryProfileColumns}
      FROM delivery_partner_profiles
      WHERE user_id = ?
      LIMIT 1
      `,
      [user.id]
    );

    if (profiles.length) {
      profile = sanitizeDeliveryProfile(profiles[0]);
    }
  }

  return {
    user: sanitizeUser(user),
    ...(store ? { store } : {}),
    ...(profile ? { profile } : {}),
  };
}

async function updateProfileImage(userId, profileImg) {
  const id = validateUserId(userId);

  if (
    typeof profileImg !== 'string' ||
    !/^\/uploads\/profiles\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(
      profileImg
    )
  ) {
    throw serviceError(400, 'Invalid profile image path');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [users] = await connection.query(
      `
      SELECT
        id,
        profile_img,
        is_active
      FROM users
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [id]
    );

    if (!users.length) {
      throw serviceError(404, 'User not found');
    }

    const user = users[0];

    if (!enabled(user.is_active)) {
      throw serviceError(403, 'Your account is inactive');
    }

    await connection.query(
      `
      UPDATE users
      SET
        profile_img = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [profileImg, id]
    );

    await connection.commit();

    return {
      oldProfileImage: user.profile_img,
      newProfileImage: profileImg,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  adminLogin,
  storeManagerLogin,
  registerCustomer,
  customerLogin,
  registerDeliveryPartner,
  deliveryPartnerLogin,
  getMyProfile,
  updateProfileImage,
};