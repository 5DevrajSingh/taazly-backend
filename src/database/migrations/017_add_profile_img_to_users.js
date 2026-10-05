module.exports = {
  up: async (connection) => {
    await connection.query(`
      ALTER TABLE users
      ADD COLUMN profile_img VARCHAR(500) NULL
      AFTER mobile
    `);
  },

  down: async (connection) => {
    await connection.query(`
      ALTER TABLE users
      DROP COLUMN profile_img
    `);
  },
};