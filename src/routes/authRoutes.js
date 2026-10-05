const express = require('express');

const {
  adminLogin,
  storeManagerLogin,
  registerCustomer,
  customerLogin,
  registerDeliveryPartner,
  deliveryPartnerLogin,
  getMyProfile,
  updateProfileImage,
} = require('../controllers/authController');

const {
  authenticateToken,
} = require('../middleware/authMiddleware');

const {
  authorizeRoles,
} = require('../middleware/roleMiddleware');

const {
  uploadProfileImage,
} = require('../middleware/uploadMiddleware');

const router = express.Router();

// Admin
router.post('/admin/login', adminLogin);

// Store manager
router.post('/manager/login', storeManagerLogin);

// Customer
router.post('/customer/register', registerCustomer);
router.post('/customer/login', customerLogin);

// Delivery partner
router.post('/delivery/register', registerDeliveryPartner);
router.post('/delivery/login', deliveryPartnerLogin);

// Common authenticated profile
router.get(
  '/me',
  authenticateToken,
  getMyProfile
);

// Common profile image upload
router.patch(
  '/me/profile-image',
  authenticateToken,
  (req, res, next) => {
    uploadProfileImage.single('profile_image')(
      req,
      res,
      (error) => {
        if (!error) return next();

        let message = 'Failed to upload profile image';
        let statusCode = 500;

        if (error.code === 'LIMIT_FILE_SIZE') {
          statusCode = 400;
          message = 'Profile image must be within 5 MB';
        } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          statusCode = 400;
          message = 'Upload one image using the profile_image field';
        } else if (
          error.name === 'MulterError' ||
          error.message ===
            'Only JPG, JPEG, PNG and WEBP images are allowed' ||
          error.message === 'Unsupported image type'
        ) {
          statusCode = 400;
          message = error.message;
        } else {
          console.error('Profile upload middleware error:', error);
        }

        return res.status(statusCode).json({
          success: false,
          message,
        });
      }
    );
  },
  updateProfileImage
);

// Existing admin authentication check
router.get(
  '/admin/me',
  authenticateToken,
  authorizeRoles('admin'),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Admin authentication successful',
      user: req.user,
    });
  }
);

module.exports = router;