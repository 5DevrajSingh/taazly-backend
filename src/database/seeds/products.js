module.exports = async function seedProducts(connection) {
  const [categories] = await connection.query(`
    SELECT id, slug
    FROM categories
  `);

  const categoryMap = {};

  for (const category of categories) {
    categoryMap[category.slug] = category.id;
  }

  const products = [
    {
      category: 'grocery',
      name: 'Tata Salt 1kg',
      slug: 'tata-salt-1kg',
      sku: 'TATA-SALT-1KG',
      description: 'Iodized edible salt',
      unit: '1 kg',
      base_price: 28.00,
    },
    {
      category: 'grocery',
      name: 'Aashirvaad Atta 5kg',
      slug: 'aashirvaad-atta-5kg',
      sku: 'AASH-ATTA-5KG',
      description: 'Whole wheat flour',
      unit: '5 kg',
      base_price: 275.00,
    },
    {
      category: 'fruits-vegetables',
      name: 'Fresh Apple',
      slug: 'fresh-apple',
      sku: 'APPLE-FRESH-1KG',
      description: 'Fresh apples',
      unit: '1 kg',
      base_price: 160.00,
    },
    {
      category: 'dairy-breakfast',
      name: 'Amul Taaza Milk',
      slug: 'amul-taaza-milk',
      sku: 'AMUL-MILK-500ML',
      description: 'Fresh toned milk',
      unit: '500 ml',
      base_price: 30.00,
    },
    {
      category: 'snacks',
      name: 'Lay’s Classic Salted',
      slug: 'lays-classic-salted',
      sku: 'LAYS-CLASSIC-50G',
      description: 'Classic salted potato chips',
      unit: '50 g',
      base_price: 20.00,
    },
    {
      category: 'beverages',
      name: 'Coca Cola 750ml',
      slug: 'coca-cola-750ml',
      sku: 'COKE-750ML',
      description: 'Refreshing soft drink',
      unit: '750 ml',
      base_price: 45.00,
    },
  ];

  for (const product of products) {
    const categoryId = categoryMap[product.category];

    if (!categoryId) {
      console.log(
        `Skipping ${product.name}: category not found`
      );
      continue;
    }

    await connection.query(
      `
      INSERT INTO products
        (
          category_id,
          name,
          slug,
          description,
          sku,
          unit,
          base_price,
          is_active
        )
      VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE
        category_id = VALUES(category_id),
        name = VALUES(name),
        description = VALUES(description),
        unit = VALUES(unit),
        base_price = VALUES(base_price)
      `,
      [
        categoryId,
        product.name,
        product.slug,
        product.description,
        product.sku,
        product.unit,
        product.base_price,
      ]
    );
  }

  console.log('Products seeded successfully.');
};