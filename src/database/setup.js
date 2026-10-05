const mysql = require('mysql2/promise');
require('dotenv').config();

const { hashPassword } = require('../utils/password');

async function setupDatabase() {
  let connection;

  try {
    console.log('Connecting to MySQL...');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    console.log('Connected to MySQL successfully.');

    // Create database
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`
       CHARACTER SET utf8mb4
       COLLATE utf8mb4_unicode_ci`
    );

    console.log(`Database "${process.env.DB_NAME}" is ready.`);

    // Switch to database
    await connection.changeUser({
      database: process.env.DB_NAME,
    });

    // Create Admin
    await createAdmin(connection);

    console.log('Database setup completed successfully.');
  } catch (error) {
    console.error('Database setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Create default Admin account
 */
async function createAdmin(connection) {
  const adminMobile = process.env.ADMIN_MOBILE;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName =
    process.env.ADMIN_FULL_NAME || 'TAAZLY Admin';
  const adminEmail =
    process.env.ADMIN_EMAIL || 'admin@taazly.com';

  if (!adminMobile || !adminPassword) {
    throw new Error(
      'ADMIN_MOBILE and ADMIN_PASSWORD are required in .env'
    );
  }

  // Check existing admin
  const [existingAdmin] = await connection.query(
    `
      SELECT id
      FROM users
      WHERE role = 'admin'
      LIMIT 1
    `
  );

  if (existingAdmin.length > 0) {
    console.log(
      `Admin already exists. ID: ${existingAdmin[0].id}`
    );

    return;
  }

  const passwordHash = await hashPassword(adminPassword);

  await connection.query(
    `
      INSERT INTO users (
        full_name,
        email,
        mobile,
        password_hash,
        role,
        is_active
      )
      VALUES (?, ?, ?, ?, 'admin', TRUE)
    `,
    [
      adminName,
      adminEmail,
      adminMobile,
      passwordHash,
    ]
  );

  console.log('Admin account created successfully.');
  console.log(`Admin Mobile: ${adminMobile}`);
}

setupDatabase();