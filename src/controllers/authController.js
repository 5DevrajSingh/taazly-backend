const fs = require('fs');
const path = require('path');

const authService = require('../services/authService');

function sendError(res, error, context, fallback) {
  console.error(`${context}:`, error);

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? fallback : error.message,
  });
}

function createLoginHandler(serviceMethod, message) {
  return async function loginHandler(req, res) {
    try {
      const { mobile, password } = req.body || {};

      const result = await authService[serviceMethod](
        mobile,
        password
      );

      return res.status(200).json({
        success: true,
        message,
        data: result,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        `${serviceMethod} error`,
        'Unable to login'
      );
    }
  };
}

const adminLogin = createLoginHandler(
  'adminLogin',
  'Admin login successful'
);

const storeManagerLogin = createLoginHandler(
  'storeManagerLogin',
  'Store manager login successful'
);

const customerLogin = createLoginHandler(
  'customerLogin',
  'Customer login successful'
);

const deliveryPartnerLogin = createLoginHandler(
  'deliveryPartnerLogin',
  'Delivery partner login successful'
);

async function registerCustomer(req, res) {
  try {
    const {
      fullName,
      email,
      mobile,
      password,
    } = req.body || {};

    const result = await authService.registerCustomer({
      fullName,
      email,
      mobile,
      password,
    });

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      data: result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Customer registration error',
      'Customer registration failed'
    );
  }
}

async function registerDeliveryPartner(req, res) {
  try {
    const {
      fullName,
      email,
      mobile,
      password,
      vehicleType,
      vehicleNumber,
      drivingLicenseNumber,
      emergencyContactName,
      emergencyContactMobile,
    } = req.body || {};

    const result = await authService.registerDeliveryPartner({
      fullName,
      email,
      mobile,
      password,
      vehicleType,
      vehicleNumber,
      drivingLicenseNumber,
      emergencyContactName,
      emergencyContactMobile,
    });

    return res.status(201).json({
      success: true,
      message: 'Delivery partner registered successfully',
      data: result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Delivery partner registration error',
      'Delivery partner registration failed'
    );
  }
}

async function getMyProfile(req, res) {
  try {
    const result = await authService.getMyProfile(
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: 'Profile fetched successfully',
      data: result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Get profile error',
      'Failed to fetch profile'
    );
  }
}

async function deleteFileIfExists(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function updateProfileImage(req, res) {
  const uploadedFilePath = req.file?.path || null;
  let databaseUpdated = false;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Profile image is required',
      });
    }

    if (!req.user?.userId) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    const userId = req.user.userId;
    const profileImg =
      `/uploads/profiles/${req.file.filename}`;

    const result = await authService.updateProfileImage(
      userId,
      profileImg
    );

    databaseUpdated = true;

    // Failure to delete the old file must not undo the upload.
    if (result.oldProfileImage) {
      try {
        const oldValue =
          result.oldProfileImage.replace(/\\/g, '/');

        const prefix = '/uploads/profiles/';

        if (oldValue.startsWith(prefix)) {
          const uploadDir = path.resolve(
            __dirname,
            '../../uploads/profiles'
          );

          const oldPath = path.resolve(
            uploadDir,
            oldValue.slice(prefix.length)
          );

          const newPath = path.resolve(uploadedFilePath);

          if (
            oldPath.startsWith(uploadDir + path.sep) &&
            oldPath !== newPath
          ) {
            await deleteFileIfExists(oldPath);
          }
        }
      } catch (cleanupError) {
        console.error(
          'Failed to delete old profile image:',
          cleanupError
        );
      }
    }

    const baseUrl =
      `${req.protocol}://${req.get('host')}`;

    return res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        user_id: userId,
        profile_img: profileImg,
        profile_image_url: `${baseUrl}${profileImg}`,
      },
    });
  } catch (error) {
    if (!databaseUpdated && uploadedFilePath) {
      try {
        await deleteFileIfExists(uploadedFilePath);
      } catch (cleanupError) {
        console.error(
          'Failed to delete uploaded file:',
          cleanupError
        );
      }
    }

    return sendError(
      res,
      error,
      'Profile image upload error',
      'Failed to upload profile image'
    );
  }
}

module.exports = {
  adminLogin,
  storeManagerLogin,
  registerCustomer,
  customerLogin,
  registerDeliveryPartner,
  deliveryPartnerLogin,
  getMyProfile,
  updateProfileImage,
};