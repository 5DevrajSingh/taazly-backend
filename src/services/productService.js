const pool = require('../config/database');
const fs = require('fs/promises');
const path = require('path');

/**
 * Get all active products for a store
 */
async function getAllProducts(storeId) {
  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      p.store_id,
      p.category_id,
      c.name AS category_name,
      p.name,
      p.slug,
      p.description,
      p.sku,
      p.unit,
      p.base_price,
      p.is_active,
      p.created_at,
      p.updated_at,
(
  SELECT i.file_url
  FROM product_images pi
  INNER JOIN images i ON i.id = pi.image_id
  WHERE pi.product_id = p.id
  ORDER BY pi.sort_order ASC, pi.id ASC
  LIMIT 1
) AS product_image
    FROM products p
    INNER JOIN categories c
      ON c.id = p.category_id
      AND c.store_id = p.store_id
    WHERE p.store_id = ?
      AND p.is_active = TRUE
    ORDER BY p.id DESC
    `,
    [storeId]
  );

  return rows;
}

/**
 * Get product by ID
 */
async function getProductById(id, storeId) {
  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      p.store_id,
      p.category_id,
      c.name AS category_name,
      p.name,
      p.slug,
      p.description,
      p.sku,
      p.unit,
      p.base_price,
      p.is_active,
      p.created_at,
      p.updated_at,
(
  SELECT i.file_url
  FROM product_images pi
  INNER JOIN images i ON i.id = pi.image_id
  WHERE pi.product_id = p.id
  ORDER BY pi.sort_order ASC, pi.id ASC
  LIMIT 1
) AS product_image
    FROM products p
    INNER JOIN categories c
      ON c.id = p.category_id
      AND c.store_id = p.store_id
    WHERE p.id = ?
      AND p.store_id = ?
    LIMIT 1
    `,
    [id, storeId]
  );

  if (!rows.length) return null;

  const product = rows[0];
  product.images = await readProductImages(pool, product.id);

  return product;
}

/**
 * Create product
 */
async function createProduct({
  store_id,
  category_id,
  name,
  slug,
  description,
  sku,
  unit,
  base_price,
}) {
  /*
   * Verify that the category belongs to the same store.
   */
  const [categoryRows] = await pool.query(
    `
    SELECT id
    FROM categories
    WHERE id = ?
      AND store_id = ?
      AND is_active = TRUE
    LIMIT 1
    `,
    [category_id, store_id]
  );

  if (categoryRows.length === 0) {
    const error = new Error(
      'Category does not belong to this store or is inactive'
    );

    error.code = 'INVALID_CATEGORY';

    throw error;
  }

  const [result] = await pool.query(
    `
    INSERT INTO products (
      store_id,
      category_id,
      name,
      slug,
      description,
      sku,
      unit,
      base_price,
      is_active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
    `,
    [
      store_id,
      category_id,
      name,
      slug,
      description || null,
      sku,
      unit || null,
      base_price ?? 0,
    ]
  );

  return getProductById(result.insertId, store_id);
}

/**
 * Update product
 */
async function updateProduct(
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
) {
  /*
   * Verify category belongs to the same store.
   */
  const [categoryRows] = await pool.query(
    `
    SELECT id
    FROM categories
    WHERE id = ?
      AND store_id = ?
      AND is_active = TRUE
    LIMIT 1
    `,
    [category_id, storeId]
  );

  if (categoryRows.length === 0) {
    const error = new Error(
      'Category does not belong to this store or is inactive'
    );

    error.code = 'INVALID_CATEGORY';

    throw error;
  }

  const [result] = await pool.query(
    `
    UPDATE products
    SET
      category_id = ?,
      name = ?,
      slug = ?,
      description = ?,
      sku = ?,
      unit = ?,
      base_price = ?,
      is_active = ?
    WHERE id = ?
      AND store_id = ?
    `,
    [
      category_id,
      name,
      slug,
      description || null,
      sku,
      unit || null,
      base_price ?? 0,
      is_active ?? true,
      id,
      storeId,
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getProductById(id, storeId);
}

/**
 * Deactivate product
 * Soft delete
 */
async function deleteProduct(id, storeId) {
  const [result] = await pool.query(
    `
    UPDATE products
    SET is_active = FALSE
    WHERE id = ?
      AND store_id = ?
    `,
    [id, storeId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getProductById(id, storeId);
}

/**
 * Activate product
 */
async function activateProduct(id, storeId) {
  const [result] = await pool.query(
    `
    UPDATE products
    SET is_active = TRUE
    WHERE id = ?
      AND store_id = ?
    `,
    [id, storeId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getProductById(id, storeId);
}

function imageError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function readProductImages(db, productId) {
  const [rows] = await db.query(
    `
    SELECT
      pi.id,
      pi.image_id,
      pi.sort_order,
      pi.is_primary,
      i.file_url,
      i.file_name
    FROM product_images pi
    INNER JOIN images i ON i.id = pi.image_id
    WHERE pi.product_id = ?
    ORDER BY pi.sort_order ASC, pi.id ASC
    `,
    [productId]
  );

  return rows;
}

// Har mutation same product ko lock karegi.
async function mutateProductImages(productId, storeId, operation) {
  const connection = await pool.getConnection();
  const filesToDelete = [];
  let images;

  try {
    await connection.beginTransaction();

    const [products] = await connection.query(
      `
      SELECT id FROM products
      WHERE id = ? AND store_id = ?
      FOR UPDATE
      `,
      [productId, storeId]
    );

    if (!products.length) {
      throw imageError('Product not found for this store', 404);
    }

    const currentImages = await readProductImages(
      connection,
      productId
    );

    await operation(connection, currentImages, filesToDelete);

    images = await readProductImages(connection, productId);

    // Order normalize karo; first image primary hogi.
    for (let index = 0; index < images.length; index++) {
      await connection.query(
        `
        UPDATE product_images
        SET sort_order = ?, is_primary = ?
        WHERE id = ? AND product_id = ?
        `,
        [index, index === 0, images[index].id, productId]
      );

      images[index].sort_order = index;
      images[index].is_primary = index === 0;
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  // Commit ke baad unused physical files remove karo.
  for (const fileName of filesToDelete) {
    if (
      !fileName ||
      path.basename(fileName) !== fileName
    ) {
      continue;
    }

    try {
      await fs.unlink(
        path.join(__dirname, '../../uploads/products', fileName)
      );
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Product image cleanup failed:', error);
      }
    }
  }

  return images;
}

async function uploadProductImages(productId, storeId, files) {
  if (!files?.length) {
    throw imageError('Please select at least one image');
  }

  return mutateProductImages(
    productId,
    storeId,
    async (connection, currentImages) => {
      // Existing images retain hongi; new images end mein add hongi.
      const nextOrder = currentImages.length
        ? Math.max(
          ...currentImages.map((image) => Number(image.sort_order))
        ) + 1
        : 0;

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const fileUrl = `/uploads/products/${file.filename}`;

        const [result] = await connection.query(
          `
          INSERT INTO images (
            file_name, file_path, file_url, mime_type, file_size
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

        await connection.query(
          `
          INSERT INTO product_images (
            product_id, image_id, sort_order, is_primary
          )
          VALUES (?, ?, ?, FALSE)
          `,
          [productId, result.insertId, nextOrder + index]
        );
      }
    }
  );
}

async function reorderProductImages(productId, storeId, imageIds) {
  if (
    !Array.isArray(imageIds) ||
    imageIds.some(
      (id) => !Number.isSafeInteger(id) || id <= 0
    )
  ) {
    throw imageError('image_ids must contain positive integer IDs');
  }

  return mutateProductImages(
    productId,
    storeId,
    async (connection, currentImages) => {
      const existingIds = new Set(
        currentImages.map((image) => Number(image.id))
      );

      if (
        imageIds.length !== currentImages.length ||
        new Set(imageIds).size !== imageIds.length ||
        imageIds.some((id) => !existingIds.has(id))
      ) {
        throw imageError(
          'Provide every product-image ID exactly once'
        );
      }

      for (let index = 0; index < imageIds.length; index++) {
        await connection.query(
          `
          UPDATE product_images
          SET sort_order = ?
          WHERE id = ? AND product_id = ?
          `,
          [index, imageIds[index], productId]
        );
      }
    }
  );
}

async function deleteProductImage(productId, storeId, imageId) {
  return mutateProductImages(
    productId,
    storeId,
    async (connection, currentImages, filesToDelete) => {
      const image = currentImages.find(
        (item) => Number(item.id) === Number(imageId)
      );

      if (!image) {
        throw imageError('Image not found for this product', 404);
      }

      await connection.query(
        `
        DELETE FROM product_images
        WHERE id = ? AND product_id = ?
        `,
        [imageId, productId]
      );

      // Shared image kisi aur product/category se linked ho
      // toh uska record aur file retain karo.
      const [result] = await connection.query(
        `
        DELETE FROM images
        WHERE id = ?
          AND NOT EXISTS (
            SELECT 1 FROM product_images WHERE image_id = ?
          )
          AND NOT EXISTS (
            SELECT 1 FROM category_images WHERE image_id = ?
          )
        `,
        [image.image_id, image.image_id, image.image_id]
      );

      if (result.affectedRows > 0) {
        filesToDelete.push(image.file_name);
      }
    }
  );
}

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  activateProduct,
  uploadProductImages,
  reorderProductImages,
  deleteProductImage,
};