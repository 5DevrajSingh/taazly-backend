const pool = require('../config/database');

const seedCategories = require('./seeds/categories');
const seedProducts = require('./seeds/products');
const seedStores = require('./seeds/stores');
const seedStoreInventory = require('./seeds/storeInventory');

async function seedDatabase() {
  let connection;

  try {
    connection = await pool.getConnection();

    console.log('Starting database seeding...');

    await connection.beginTransaction();

    // 1. Categories
    await seedCategories(connection);

    // 2. Products
    await seedProducts(connection);

    // 3. Stores
    await seedStores(connection);

    // 4. Store Inventory
    await seedStoreInventory(connection);

    await connection.commit();

    console.log('Database seeding completed successfully.');
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Database seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      connection.release();
    }

    await pool.end();
  }
}

seedDatabase();