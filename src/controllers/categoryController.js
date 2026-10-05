const fs = require('fs/promises');

const categoryService = require('../services/categoryService');


async function getCategories(req, res) {
  try {
    const { storeId } = req.params;

    if (
      storeId !== undefined &&
      !/^[1-9]\d*$/.test(String(storeId))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Store ID',
      });
    }

    const categories = await categoryService.getAllCategories(
      storeId
    );

    return res.json({
      success: true,
      message: 'Categories fetched successfully',
      data: categories,
    });
  } catch (error) {
    console.error('Get categories error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
    });
  }
}

async function getCategory(req, res) {
  try {
    const { storeId, id } = req.params;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required',
      });
    }

    const category = await categoryService.getCategoryById(
      id,
      storeId
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Get category error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
    });
  }
}

async function createCategory(req, res) {
  try {
    const { storeId } = req.params;

    const {
      name,
      slug,
      description,
      sort_order,
    } = req.body;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required',
      });
    }

    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: 'Name and slug are required',
      });
    }

    const category = await categoryService.createCategory({
      store_id: storeId,
      name,
      slug,
      description,
      sort_order,
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  } catch (error) {
    console.error('Create category error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Category slug already exists for this store',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create category',
    });
  }
}

async function updateCategory(req, res) {
  try {
    const { storeId, id } = req.params;

    const {
      name,
      slug,
      description,
      sort_order,
      is_active,
    } = req.body;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required',
      });
    }

    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: 'Name and slug are required',
      });
    }

    const category = await categoryService.updateCategory(
      id,
      storeId,
      {
        name,
        slug,
        description,
        sort_order,
        is_active,
      }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category,
    });
  } catch (error) {
    console.error('Update category error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Category slug already exists for this store',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update category',
    });
  }
}

async function deleteCategory(req, res) {
  try {
    const { storeId, id } = req.params;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required',
      });
    }

    const category = await categoryService.deleteCategory(
      id,
      storeId
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.json({
      success: true,
      message: 'Category deactivated successfully',
      data: category,
    });
  } catch (error) {
    console.error('Delete category error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to deactivate category',
    });
  }
}

async function activateCategory(req, res) {
  try {
    const { storeId, id } = req.params;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required',
      });
    }

    const category = await categoryService.activateCategory(
      id,
      storeId
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.json({
      success: true,
      message: 'Category activated successfully',
      data: category,
    });
  } catch (error) {
    console.error('Activate category error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to activate category',
    });
  }
}

async function uploadCategoryImage(req, res) {
  let saved = false;

  try {
    const { storeId, id } = req.params;

    if (
      !/^[1-9]\d*$/.test(String(storeId)) ||
      !/^[1-9]\d*$/.test(String(id)) ||
      !Number.isSafeInteger(Number(storeId)) ||
      !Number.isSafeInteger(Number(id))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid store ID and category ID are required',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Category image is required',
      });
    }

    const result = await categoryService.saveCategoryImage(
      id,
      storeId,
      req.file
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Category not found for this store',
      });
    }

    saved = true;

    return res.json({
      success: true,
      message: 'Category image uploaded successfully',
      data: {
        id: Number(id),
        store_id: Number(storeId),
        ...result,
      },
    });
  } catch (error) {
    console.error('Upload category image error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to upload category image',
    });
  } finally {
    // Validation/DB failure par uploaded file remove karo.
    if (req.file && !saved) {
      await fs.unlink(req.file.path).catch((error) => {
        console.error('Category image cleanup error:', error);
      });
    }
  }
}

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,

  uploadCategoryImage,
  deleteCategory,
  activateCategory
};