const productService = require('../services/productService');
const fs = require('fs/promises');

/**
 * Get all products of a store
 */
async function getProducts(req, res) {
  try {
    const { storeId } = req.params;

    const products = await productService.getAllProducts(storeId);

    return res.status(200).json({
      success: true,
      message: 'Products fetched successfully',
      data: products,
    });
  } catch (error) {
    console.error('Get products error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
    });
  }
}

/**
 * Get single product
 */
async function getProduct(req, res) {
  try {
    const { storeId, id } = req.params;

    const product = await productService.getProductById(id, storeId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product fetched successfully',
      data: product,
    });
  } catch (error) {
    console.error('Get product error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
    });
  }
}

/**
 * Create product
 */
async function createProduct(req, res) {
  try {
    const { storeId } = req.params;

    const {
      category_id,
      name,
      slug,
      description,
      sku,
      unit,
      base_price,
    } = req.body;

    // Basic validation
    if (!category_id || !name || !slug || !sku) {
      return res.status(400).json({
        success: false,
        message: 'category_id, name, slug and sku are required',
      });
    }

    const product = await productService.createProduct({
      store_id: storeId,
      category_id,
      name,
      slug,
      description,
      sku,
      unit,
      base_price,
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    console.error('Create product error:', error);

    if (error.code === 'INVALID_CATEGORY') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create product',
    });
  }
}

/**
 * Update product
 */
async function updateProduct(req, res) {
  try {
    const { storeId, id } = req.params;

    const {
      category_id,
      name,
      slug,
      description,
      sku,
      unit,
      base_price,
      is_active,
    } = req.body;

    // Basic validation
    if (!category_id || !name || !slug || !sku) {
      return res.status(400).json({
        success: false,
        message: 'category_id, name, slug and sku are required',
      });
    }

    const product = await productService.updateProduct(
      id,
      storeId,
      {
        category_id,
        name,
        slug,
        description,
        sku,
        unit,
        base_price,
        is_active,
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    });
  } catch (error) {
    console.error('Update product error:', error);

    if (error.code === 'INVALID_CATEGORY') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update product',
    });
  }
}

/**
 * Delete product
 * Soft delete
 */
async function deleteProduct(req, res) {
  try {
    const { storeId, id } = req.params;

    const product = await productService.deleteProduct(id, storeId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product deactivated successfully',
      data: product,
    });
  } catch (error) {
    console.error('Delete product error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to deactivate product',
    });
  }
}

/**
 * Activate product
 */
async function activateProduct(req, res) {
  try {
    const { storeId, id } = req.params;

    const product = await productService.activateProduct(id, storeId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product activated successfully',
      data: product,
    });
  } catch (error) {
    console.error('Activate product error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to activate product',
    });
  }
}

function isValidImageRouteId(value) {
  return (
    /^[1-9]\d*$/.test(String(value)) &&
    Number.isSafeInteger(Number(value))
  );
}

function validateImageRoute(req) {
  const { storeId, id, imageId } = req.params;

  if (
    !isValidImageRouteId(storeId) ||
    !isValidImageRouteId(id) ||
    (
      imageId !== undefined &&
      !isValidImageRouteId(imageId)
    )
  ) {
    const error = new Error('Valid store, product and image IDs are required');
    error.status = 400;
    throw error;
  }
}

function sendProductImageError(res, error) {
  console.error('Product image error:', error);

  return res.status(error.status || 500).json({
    success: false,
    message: error.status
      ? error.message
      : 'Failed to process product images',
  });
}

async function uploadProductImages(req, res) {
  let saved = false;

  try {
    validateImageRoute(req);

    const images = await productService.uploadProductImages(
      req.params.id,
      req.params.storeId,
      req.files
    );

    saved = true;

    return res.status(201).json({
      success: true,
      message: 'Product images uploaded successfully',
      data: images,
    });
  } catch (error) {
    return sendProductImageError(res, error);
  } finally {
    if (!saved) {
      await Promise.all(
        (req.files || []).map(async (file) => {
          try {
            await fs.unlink(file.path);
          } catch (error) {
            if (error.code !== 'ENOENT') {
              console.error('Failed upload cleanup error:', error);
            }
          }
        })
      );
    }
  }
}

async function reorderProductImages(req, res) {
  try {
    validateImageRoute(req);

    const images = await productService.reorderProductImages(
      req.params.id,
      req.params.storeId,
      req.body.image_ids
    );

    return res.json({
      success: true,
      message: 'Product image order updated successfully',
      data: images,
    });
  } catch (error) {
    return sendProductImageError(res, error);
  }
}

async function deleteProductImage(req, res) {
  try {
    validateImageRoute(req);

    const images = await productService.deleteProductImage(
      req.params.id,
      req.params.storeId,
      req.params.imageId
    );

    return res.json({
      success: true,
      message: 'Product image deleted successfully',
      data: images,
    });
  } catch (error) {
    return sendProductImageError(res, error);
  }
}

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  activateProduct,
  uploadProductImages,
reorderProductImages,
deleteProductImage,
};