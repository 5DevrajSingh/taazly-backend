const pool = require('../config/database');
const fs = require('fs/promises');
const path = require('path');

/**
 * Get all categories of a store
 */
/**
 * Get all categories, optionally filtered by store.
 */
async function getAllCategories(storeId) {
  const hasStoreId = storeId !== undefined && storeId !== null;

  const [rows] = await pool.query(
    `
    SELECT
      c.id,
      c.store_id,
      c.name,
      c.slug,
      c.description,
      c.sort_order,
      c.is_active,
      c.created_at,
      c.updated_at,
      s.name AS store_name,
(
  SELECT i.file_url
  FROM category_images ci
  INNER JOIN images i ON i.id = ci.image_id
  WHERE ci.category_id = c.id
  ORDER BY ci.is_primary DESC, ci.sort_order ASC, ci.id ASC
  LIMIT 1
) AS category_image
    FROM categories c
    INNER JOIN stores s ON s.id = c.store_id
    ${hasStoreId ? 'WHERE c.store_id = ?' : ''}
    ORDER BY c.sort_order ASC, c.id ASC
    `,
    hasStoreId ? [storeId] : []
  );

  return rows;
}

/**
 * Get category by ID
 */
async function getCategoryById(id, storeId) {
  const [rows] = await pool.query(
    `
    SELECT
      c.id,
      c.store_id,
      c.name,
      c.slug,
      c.description,
      c.sort_order,
      c.is_active,
      c.created_at,
      c.updated_at,
      s.name AS store_name,
(
  SELECT i.file_url
  FROM category_images ci
  INNER JOIN images i ON i.id = ci.image_id
  WHERE ci.category_id = c.id
  ORDER BY ci.is_primary DESC, ci.sort_order ASC, ci.id ASC
  LIMIT 1
) AS category_image
    FROM categories c
    INNER JOIN stores s ON s.id = c.store_id
    WHERE c.id = ?
      AND c.store_id = ?
    LIMIT 1
    `,
    [id, storeId]
  );

  return rows[0] || null;
}

/**
 * Create category
 */
async function createCategory({
  store_id,
  name,
  slug,
  description,
  sort_order,
}) {
  const [result] = await pool.query(
    `
    INSERT INTO categories (
      store_id,
      name,
      slug,
      description,
      sort_order,
      is_active
    )
    VALUES (?, ?, ?, ?, ?, TRUE)
    `,
    [
      store_id,
      name,
      slug,
      description || null,
      sort_order ?? 0,
    ]
  );

  return getCategoryById(result.insertId, store_id);
}

/**
 * Update category
 */
async function updateCategory(
  id,
  storeId,
  {
    name,
    slug,
    description,
    sort_order,
    is_active,
  }
) {
  const [result] = await pool.query(
    `
    UPDATE categories
    SET
      name = ?,
      slug = ?,
      description = ?,
      sort_order = ?,
      is_active = ?
    WHERE id = ?
      AND store_id = ?
    `,
    [
      name,
      slug,
      description || null,
      sort_order ?? 0,
      is_active ?? true,
      id,
      storeId,
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getCategoryById(id, storeId);
}

/**
 * Soft delete category
 */
async function deleteCategory(id, storeId) {
  const [result] = await pool.query(
    `
    UPDATE categories
    SET is_active = FALSE
    WHERE id = ?
      AND store_id = ?
    `,
    [id, storeId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getCategoryById(id, storeId);
}

async function saveCategoryImage(id, storeId, file) {
  const connection = await pool.getConnection();
  const oldFilesToRemove = [];
  let committed = false;

  try {
    await connection.beginTransaction();

    // Category ko lock karo aur store verify karo.
    const [categories] = await connection.query(
      `
      SELECT id
      FROM categories
      WHERE id = ? AND store_id = ?
      FOR UPDATE
      `,
      [id, storeId]
    );

    if (!categories.length) {
      await connection.rollback();
      return null;
    }

    // Is category ki existing images fetch karo.
    const [oldImages] = await connection.query(
      `
      SELECT DISTINCT i.id, i.file_name
      FROM category_images ci
      INNER JOIN images i ON i.id = ci.image_id
      WHERE ci.category_id = ?
      `,
      [id]
    );

    const fileUrl = `/uploads/categories/${file.filename}`;

    const [imageResult] = await connection.query(
      `
      INSERT INTO images (
        file_name,
        file_path,
        file_url,
        mime_type,
        file_size
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        file.filename,
        fileUrl,
        fileUrl,
        file.mimetype,
        file.size,
      ]
    );

    // Purane category-image links remove karo.
    await connection.query(
      'DELETE FROM category_images WHERE category_id = ?',
      [id]
    );

    // Latest image ka link save karo.
    await connection.query(
      `
      INSERT INTO category_images (
        category_id,
        image_id,
        is_primary,
        sort_order
      )
      VALUES (?, ?, TRUE, 0)
      `,
      [id, imageResult.insertId]
    );

    for (const oldImage of oldImages) {
      // Kisi aur category/product mein used image delete mat karo.
      const [result] = await connection.query(
        `
        DELETE FROM images
        WHERE id = ?
          AND NOT EXISTS (
            SELECT 1
            FROM category_images
            WHERE image_id = ?
          )
          AND NOT EXISTS (
            SELECT 1
            FROM product_images
            WHERE image_id = ?
          )
        `,
        [oldImage.id, oldImage.id, oldImage.id]
      );

      if (result.affectedRows > 0) {
        oldFilesToRemove.push(oldImage.file_name);
      }
    }

    await connection.commit();
    committed = true;
  } catch (error) {
    if (!committed) {
      await connection.rollback();
    }

    throw error;
  } finally {
    connection.release();
  }

  // New image successfully save hone ke baad old files delete karo.
  const uploadDir = path.join(
    __dirname,
    '../../uploads/categories'
  );

  for (const fileName of oldFilesToRemove) {
    if (
      !fileName ||
      path.basename(fileName) !== fileName ||
      fileName === file.filename
    ) {
      continue;
    }

    try {
      await fs.unlink(path.join(uploadDir, fileName));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Old category image cleanup failed:', error);
      }
    }
  }

  return {
    category_image: `/uploads/categories/${file.filename}`,
  };
}


async function activateCategory(id, storeId) {
  const [result] = await pool.query(
    `
    UPDATE categories
    SET is_active = TRUE
    WHERE id = ?
      AND store_id = ?
    `,
    [id, storeId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getCategoryById(id, storeId);
}

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  saveCategoryImage,
  updateCategory,
  deleteCategory,
  activateCategory
};