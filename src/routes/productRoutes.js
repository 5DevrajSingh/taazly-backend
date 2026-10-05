const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');
const {
  uploadProductImage,
} = require('../middleware/uploadMiddleware');

// Get all products of a store
router.get(
  '/store/:storeId',
  productController.getProducts
);

// Get single product
router.get(
  '/store/:storeId/:id',
  productController.getProduct
);

// Create product
router.post(
  '/store/:storeId',
  productController.createProduct
);

// Update product
router.put(
  '/store/:storeId/:id',
  productController.updateProduct
);

// Deactivate product
router.delete(
  '/store/:storeId/:id',
  productController.deleteProduct
);

// Activate product
router.patch(
  '/store/:storeId/:id/activate',
  productController.activateProduct
);

// Upload multiple images: maximum 10 per request.
router.post(
  '/store/:storeId/:id/images',
  (req, res, next) => {
    uploadProductImage.array('product_images', 10)(
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
                ? 'Each image must be 5 MB or less'
                : error.message,
          });
        }

        next();
      }
    );
  },
  productController.uploadProductImages
);

// Reorder complete gallery.
router.patch(
  '/store/:storeId/:id/images/order',
  productController.reorderProductImages
);

// Delete one gallery image.
router.delete(
  '/store/:storeId/:id/images/:imageId',
  productController.deleteProductImage
);



module.exports = router;