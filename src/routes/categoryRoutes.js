const express = require('express');

const categoryController = require('../controllers/categoryController');
const {
  uploadCategoryImage,
} = require('../middleware/uploadMiddleware');

const router = express.Router();

// Get categories across all stores
router.get(
  '/',
  categoryController.getCategories
);

// Get all categories for a store
router.get(
  '/store/:storeId',
  categoryController.getCategories
);

// Get single category
router.get(
  '/store/:storeId/:id',
  categoryController.getCategory
);

// Create category
router.post(
  '/store/:storeId',
  categoryController.createCategory
);

// Update category
router.put(
  '/store/:storeId/:id',
  categoryController.updateCategory
);

// Deactivate category
router.delete(
  '/store/:storeId/:id',
  categoryController.deleteCategory
);

router.patch(
  '/store/:storeId/:id/activate',
  categoryController.activateCategory
);

// Upload or replace category image
router.patch(
  '/store/:storeId/:id/image',
  (req, res, next) => {
    uploadCategoryImage.single('category_image')(
      req,
      res,
      (error) => {
        if (error) {
          return res.status(
            error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
          ).json({
            success: false,
            message:
              error.code === 'LIMIT_FILE_SIZE'
                ? 'Image size must be 5 MB or less'
                : error.message,
          });
        }

        next();
      }
    );
  },
  categoryController.uploadCategoryImage
);

module.exports = router;