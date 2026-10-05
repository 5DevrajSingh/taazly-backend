module.exports = async function seedCategories(connection) {
  const categories = [
    {
      name: 'Grocery',
      slug: 'grocery',
      description: 'Daily grocery products',
      sort_order: 1,
    },
    {
      name: 'Fruits & Vegetables',
      slug: 'fruits-vegetables',
      description: 'Fresh fruits and vegetables',
      sort_order: 2,
    },
    {
      name: 'Dairy & Breakfast',
      slug: 'dairy-breakfast',
      description: 'Milk, dairy and breakfast products',
      sort_order: 3,
    },
    {
      name: 'Snacks',
      slug: 'snacks',
      description: 'Chips, biscuits and snacks',
      sort_order: 4,
    },
    {
      name: 'Beverages',
      slug: 'beverages',
      description: 'Cold drinks, juices and beverages',
      sort_order: 5,
    },
    {
      name: 'Personal Care',
      slug: 'personal-care',
      description: 'Personal care products',
      sort_order: 6,
    },
  ];

  for (const category of categories) {
    await connection.query(
      `
      INSERT INTO categories
        (name, slug, description, sort_order, is_active)
      VALUES (?, ?, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description),
        sort_order = VALUES(sort_order)
      `,
      [
        category.name,
        category.slug,
        category.description,
        category.sort_order,
      ]
    );
  }

  console.log('Categories seeded successfully.');
};