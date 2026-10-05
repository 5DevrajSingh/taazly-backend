const express = require('express');

const profileController = require('../controllers/profileController');

const {
  authenticateToken,
} = require('../middleware/authMiddleware');

const {
  authorizeRoles,
} = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(
  authenticateToken,
  authorizeRoles('admin', 'store_manager')
);

router.get('/', profileController.getMyProfile);

router.patch('/', profileController.updateMyProfile);

module.exports = router;