const profileService = require('../services/profileService');

function sendError(res, error, fallback) {
  console.error(fallback, error);

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? fallback : error.message,
  });
}

async function getMyProfile(req, res) {
  try {
    const profile = await profileService.getMyProfile(
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: 'Profile fetched successfully',
      data: profile,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to fetch profile');
  }
}

async function updateMyProfile(req, res) {
  try {
    const body = req.body;

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile data',
      });
    }

    const allowedFields = ['full_name', 'email', 'mobile'];

    if (
      Object.keys(body).some(
        (field) => !allowedFields.includes(field)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Only full_name, email and mobile can be updated',
      });
    }

    if (
      typeof body.full_name !== 'string' ||
      !body.full_name.trim() ||
      body.full_name.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required and must be within 100 characters',
      });
    }

    if (
      typeof body.mobile !== 'string' ||
      !/^\d{10}$/.test(body.mobile.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid 10-digit mobile number',
      });
    }

    if (
      body.email !== undefined &&
      body.email !== null &&
      typeof body.email !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Email must be a string',
      });
    }

    const email = (body.email || '').trim();

    if (
      email &&
      (
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email address',
      });
    }

    const profile = await profileService.updateMyProfile(
      req.user.userId,
      {
        full_name: body.full_name.trim(),
        mobile: body.mobile.trim(),
        email: email || null,
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: profile,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to update profile');
  }
}

module.exports = {
  getMyProfile,
  updateMyProfile,
};