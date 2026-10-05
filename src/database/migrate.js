const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function migrate() {
  let connection;

  try {
    connection = await pool.getConnection();

    console.log('Starting database migration...');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      console.log('Migrations directory not found.');
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.js'))
      .sort();

    const [executedMigrations] = await connection.query(
      'SELECT migration_name FROM migrations'
    );

    const executedNames = new Set(
      executedMigrations.map((migration) => migration.migration_name)
    );

    for (const file of files) {
      if (executedNames.has(file)) {
        console.log(`Already executed: ${file}`);
        continue;
      }

      console.log(`Running migration: ${file}`);

      const migrationPath = path.join(migrationsDir, file);
      const migration = require(migrationPath);

      await connection.beginTransaction();

      try {
        await migration.up(connection);

        await connection.query(
          'INSERT INTO migrations (migration_name) VALUES (?)',
          [file]
        );

        await connection.commit();

        console.log(`Completed: ${file}`);
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }

    console.log('Database migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      connection.release();
    }

    await pool.end();
  }
}

migrate();