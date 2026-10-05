const fs = require('fs');
const mysql = require('mysql2/promise');

require('dotenv').config();

const sslEnabled = process.env.DB_SSL === 'true';

if (sslEnabled && !process.env.DB_SSL_CA_PATH) {
  throw new Error('DB_SSL_CA_PATH is required when DB_SSL is enabled');
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ...(sslEnabled
    ? {
        ssl: {
          ca: fs.readFileSync(process.env.DB_SSL_CA_PATH, 'utf8'),
          rejectUnauthorized: true,
        },
      }
    : {}),

  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

module.exports = pool;


// const mysql = require('mysql2/promise');
// require('dotenv').config();

// const pool = mysql.createPool({
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT),
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });

// module.exports = pool;