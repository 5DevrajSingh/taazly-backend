module.exports = {
  async up(connection) {
    await connection.query(`
      ALTER TABLE stores
      ADD COLUMN manager_id BIGINT UNSIGNED NULL AFTER logo,
      ADD CONSTRAINT fk_stores_manager
        FOREIGN KEY (manager_id)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
    `);

    await connection.query(`
      CREATE UNIQUE INDEX uq_stores_manager_id
      ON stores(manager_id)
    `);
  },
};