const express = require('express');
const cors = require('cors');
require('dotenv').config();

const categoryRoutes = require('./routes/categoryRoutes');
const profileRoutes = require('./routes/profileRoutes');
const authRoutes = require("./routes/authRoutes");
const customerRoutes = require('./routes/customerRoutes');
const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const addressRoutes = require('./routes/addressRoutes');
const orderRoutes = require('./routes/orderRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const deliveryPartnerRoutes = require('./routes/deliveryPartnerRoutes');
const adminStoreRoutes = require('./routes/adminStoreRoutes');


const app = express();
const path = require('path');

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  '/uploads',
  express.static(
    path.join(__dirname, '../uploads')
  )
);
app.use("/api/auth", authRoutes);
app.use('/api/admin/customers', customerRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'TAAZLY API is running',
  });
});
app.use('/api/categories', categoryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/delivery-partners', deliveryPartnerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin/stores', adminStoreRoutes);


app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TAAZLY API running on port ${PORT}`);
});

// app.listen(PORT, () => {
//   console.log(`TAAZLY API running on http://localhost:${PORT}`);
// });