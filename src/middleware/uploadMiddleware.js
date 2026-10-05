const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

function createImageUpload(folder, prefix) {
  const uploadDir = path.join(
    __dirname,
    '../../uploads',
    folder
  );

  fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
      const extension = path
        .extname(file.originalname)
        .toLowerCase();

      const fileName =
        `${prefix}-${randomUUID()}${extension}`;

      cb(null, fileName);
    },
  });

  return multer({
    storage,

    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        return cb(null, true);
      }

      const error = new Error('Only image files are allowed');
      error.status = 400;
      cb(error);
    },

    limits: {
      fileSize: 5 * 1024 * 1024,
    },
  });
}

const uploadProfileImage = createImageUpload(
  'profiles',
  'user'
);

const uploadCategoryImage = createImageUpload(
  'categories',
  'category'
);

const uploadProductImage = createImageUpload(
  'products',
  'product'
);

module.exports = {
  uploadProfileImage,
  uploadCategoryImage,
  uploadProductImage,
};