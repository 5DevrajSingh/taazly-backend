const inventoryService = require('../services/inventoryService');

/**
 * Get all inventory of a store
 */
async function getInventory(req, res) {
  try {
    const { storeId } = req.params;

    const inventory = await inventoryService.getStoreInventory(storeId);

    return res.status(200).json({
      success: true,
      message: 'Inventory fetched successfully',
      data: inventory,
    });
  } catch (error) {
    console.error('Get inventory error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory',
    });
  }
}

/**
 * Get inventory of a single product
 */
async function getProductInventory(req, res) {
  try {
    const { storeId, productId } = req.params;

    const inventory = await inventoryService.getInventoryByProduct(
      productId,
      storeId
    );

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Inventory not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Inventory fetched successfully',
      data: inventory,
    });
  } catch (error) {
    console.error('Get product inventory error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch product inventory',
    });
  }
}

/**
 * Create inventory
 */
async function createInventory(req, res) {
  try {
    const { storeId } = req.params;

    const {
      product_id,
      selling_price,
      stock_quantity,
      low_stock_threshold,
      is_available,
    } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'product_id is required',
      });
    }

    if (selling_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'selling_price is required',
      });
    }

    if (stock_quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'stock_quantity is required',
      });
    }

    const inventory = await inventoryService.createInventory({
      store_id: storeId,
      product_id,
      selling_price,
      stock_quantity,
      low_stock_threshold,
      is_available,
    });

    return res.status(201).json({
      success: true,
      message: 'Inventory created successfully',
      data: inventory,
    });
  } catch (error) {
    console.error('Create inventory error:', error);

    if (error.code === 'INVALID_PRODUCT') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === 'INVENTORY_EXISTS') {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create inventory',
    });
  }
}

/**
 * Update complete inventory
 */
async function updateInventory(req, res) {
  try {
    const { storeId, productId } = req.params;

    const {
      selling_price,
      stock_quantity,
      low_stock_threshold,
      is_available,
    } = req.body;

    if (selling_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'selling_price is required',
      });
    }

    if (stock_quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'stock_quantity is required',
      });
    }

    if (low_stock_threshold === undefined) {
      return res.status(400).json({
        success: false,
        message: 'low_stock_threshold is required',
      });
    }

    const inventory = await inventoryService.updateInventory(
      productId,
      storeId,
      {
        selling_price,
        stock_quantity,
        low_stock_threshold,
        is_available,
      }
    );

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Inventory not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Inventory updated successfully',
      data: inventory,
    });
  } catch (error) {
    console.error('Update inventory error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update inventory',
    });
  }
}

/**
 * Update stock quantity
 */
async function updateStock(req, res) {
  try {
    const { storeId, productId } = req.params;
    const { stock_quantity } = req.body;

    if (stock_quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'stock_quantity is required',
      });
    }

    if (stock_quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'stock_quantity cannot be negative',
      });
    }

    const inventory = await inventoryService.updateStock(
      productId,
      storeId,
      stock_quantity
    );

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Inventory not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      data: inventory,
    });
  } catch (error) {
    console.error('Update stock error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update stock',
    });
  }
}

/**
 * Update product availability
 */
async function updateAvailability(req, res) {
  try {
    const { storeId, productId } = req.params;
    const { is_available } = req.body;

    if (is_available === undefined) {
      return res.status(400).json({
        success: false,
        message: 'is_available is required',
      });
    }

    const inventory = await inventoryService.updateAvailability(
      productId,
      storeId,
      is_available
    );

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Inventory not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product availability updated successfully',
      data: inventory,
    });
  } catch (error) {
    console.error('Update availability error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to update product availability',
    });
  }
}

module.exports = {
  getInventory,
  getProductInventory,
  createInventory,
  updateInventory,
  updateStock,
  updateAvailability,
};