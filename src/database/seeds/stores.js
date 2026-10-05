module.exports = async function seedStores(connection) {
  const stores = [
    {
      store_code: 'TAAZLY-DEL-001',
      name: 'TAAZLY Delhi Store',
      description: 'TAAZLY quick commerce store - Delhi',
      phone: '9876543210',
      email: 'delhi@taazly.com',
      address_line_1: 'Main Market Road',
      address_line_2: null,
      area: 'Delhi',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      latitude: null,
      longitude: null,
      opening_time: '07:00:00',
      closing_time: '23:00:00',
    },
    {
      store_code: 'TAAZLY-NOI-001',
      name: 'TAAZLY Noida Store',
      description: 'TAAZLY quick commerce store - Noida',
      phone: '9876543211',
      email: 'noida@taazly.com',
      address_line_1: 'Sector 18 Market',
      address_line_2: null,
      area: 'Sector 18',
      city: 'Noida',
      state: 'Uttar Pradesh',
      pincode: '201301',
      latitude: null,
      longitude: null,
      opening_time: '07:00:00',
      closing_time: '23:00:00',
    },
    {
      store_code: 'TAAZLY-GGN-001',
      name: 'TAAZLY Gurgaon Store',
      description: 'TAAZLY quick commerce store - Gurgaon',
      phone: '9876543212',
      email: 'gurgaon@taazly.com',
      address_line_1: 'Main Market Road',
      address_line_2: null,
      area: 'Sector 29',
      city: 'Gurgaon',
      state: 'Haryana',
      pincode: '122001',
      latitude: null,
      longitude: null,
      opening_time: '07:00:00',
      closing_time: '23:00:00',
    },
  ];

  for (const store of stores) {
    await connection.query(
      `
      INSERT INTO stores (
        store_code,
        name,
        description,
        phone,
        email,
        address_line_1,
        address_line_2,
        area,
        city,
        state,
        pincode,
        latitude,
        longitude,
        opening_time,
        closing_time,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description),
        phone = VALUES(phone),
        email = VALUES(email),
        address_line_1 = VALUES(address_line_1),
        address_line_2 = VALUES(address_line_2),
        area = VALUES(area),
        city = VALUES(city),
        state = VALUES(state),
        pincode = VALUES(pincode),
        opening_time = VALUES(opening_time),
        closing_time = VALUES(closing_time)
      `,
      [
        store.store_code,
        store.name,
        store.description,
        store.phone,
        store.email,
        store.address_line_1,
        store.address_line_2,
        store.area,
        store.city,
        store.state,
        store.pincode,
        store.latitude,
        store.longitude,
        store.opening_time,
        store.closing_time,
      ]
    );
  }

  console.log('Stores seeded successfully.');
};