const { verifyToken } = require('../utils/jwt');
const pool = require('../config/database');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Authorization token is required',
    });
  }

  const parts = authHeader.trim().split(/\s+/);

  if (
    parts.length !== 2 ||
    parts[0].toLowerCase() !== 'bearer'
  ) {
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization format',
    });
  }

  let decoded;

  try {
    decoded = verifyToken(parts[1]);

    if (!decoded || !decoded.userId) {
      throw new Error('Invalid token payload');
    }
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }

  let user;

  try {
    const [rows] = await pool.query(
      `
      SELECT id, role, is_active
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [decoded.userId]
    );

    user = rows[0];
  } catch (error) {
    console.error('Authentication database error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to verify account',
    });
  }

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Account not found',
    });
  }

  if (!user.is_active) {
    return res.status(403).json({
      success: false,
      message: 'Your account is blocked or inactive',
    });
  }

  req.user = {
    ...decoded,
    userId: user.id,
    role: user.role,
  };

  return next();
}

module.exports = {
  authenticateToken,
};