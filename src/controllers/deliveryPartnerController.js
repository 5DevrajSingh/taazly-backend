const deliveryPartnerService = require('../services/deliveryPartnerService');

function validId(value) {
  return (
    typeof value === 'string' &&
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value))
  );
}

function enabled(value) {
  return value === true || Number(value) === 1;
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireRole(req, allowedRoles) {
  if (!req.user) {
    throw httpError(401, 'Authentication required');
  }

  if (!allowedRoles.includes(req.user.role)) {
    throw httpError(403, 'Access denied');
  }
}

function requireParamId(req, label) {
  const { id } = req.params;

  if (!validId(id)) {
    throw httpError(400, `Invalid ${label} ID`);
  }

  return Number(id);
}

// Resolve store access from the authenticated user.
// Never trust a manager's requested store without checking the database.
async function resolveStoreScope(req) {
  requireRole(req, ['admin', 'store_manager']);

  const { userId, role } = req.user;
  const requestedStore = req.query.store_id;

  let storeId = null;

  if (role === 'admin') {
    if (
      requestedStore !== undefined &&
      requestedStore !== 'all'
    ) {
      if (!validId(requestedStore)) {
        throw httpError(400, 'Invalid store_id');
      }

      storeId = Number(requestedStore);
    }
  } else {
    const assignedStoreId =
      await deliveryPartnerService.getManagerStoreId(userId);

    if (assignedStoreId === null) {
      throw httpError(
        403,
        'No store is assigned to this manager'
      );
    }

    storeId = assignedStoreId;

    // Manager may omit store_id or request the assigned store.
    if (
      requestedStore !== undefined &&
      (
        !validId(requestedStore) ||
        Number(requestedStore) !== storeId
      )
    ) {
      throw httpError(
        403,
        'You can only access your assigned store'
      );
    }
  }

  return {
    role,
    store_id: storeId,
  };
}

function sendError(res, error, context, fallback) {
  console.error(`${context}:`, error);

  const knownErrors = {
    'Delivery partner not found': 404,
    'Delivery partner profile not found': 404,
    'Delivery assignment not found': 404,
    'Delivery partner not found or already verified': 400,
    'Delivery partner not found or already rejected': 400,
    'Delivery partner must be verified before going online': 403,
    'Only verified delivery partners can update location': 403,
    'Delivery partner account is inactive': 403,
    'Delivery partner is not verified': 403,
    'Delivery partner is offline': 400,
  };

  let statusCode = error.statusCode || knownErrors[error.message];

  if (
    !statusCode &&
    /^Order cannot be (accepted|rejected|picked up|delivered) because /.test(
      error.message || ''
    )
  ) {
    statusCode = 400;
  }

  if (!statusCode) statusCode = 500;

  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? fallback : error.message,
  });
}

async function getDeliveryPartners(req, res) {
  try {
    const scope = await resolveStoreScope(req);

    const partners =
      await deliveryPartnerService.getAllDeliveryPartners(
        scope.store_id
      );

    return res.status(200).json({
      success: true,
      message: 'Delivery partners fetched successfully',
      data: partners,
      scope,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Get delivery partners error',
      'Failed to fetch delivery partners'
    );
  }
}

async function getDeliveryPartner(req, res) {
  try {
    const scope = await resolveStoreScope(req);
    const id = requireParamId(req, 'delivery partner');

    // For managers, the query checks delivery assignment history
    // against their assigned store before returning details.
    const partner =
      await deliveryPartnerService.getDeliveryPartnerById(
        id,
        scope.store_id
      );

    return res.status(200).json({
      success: true,
      message: 'Delivery partner fetched successfully',
      data: partner,
      scope,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Get delivery partner error',
      'Failed to fetch delivery partner'
    );
  }
}

async function verifyDeliveryPartner(req, res) {
  try {
    requireRole(req, ['admin']);
    const id = requireParamId(req, 'delivery partner');

    const partner =
      await deliveryPartnerService.verifyDeliveryPartner(id);

    return res.status(200).json({
      success: true,
      message: 'Delivery partner verified successfully',
      data: partner,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Verify delivery partner error',
      'Failed to verify delivery partner'
    );
  }
}

async function rejectDeliveryPartner(req, res) {
  try {
    requireRole(req, ['admin']);
    const id = requireParamId(req, 'delivery partner');

    const partner =
      await deliveryPartnerService.rejectDeliveryPartner(id);

    return res.status(200).json({
      success: true,
      message: 'Delivery partner rejected successfully',
      data: partner,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Reject delivery partner error',
      'Failed to reject delivery partner'
    );
  }
}

async function getAvailableDeliveryPartners(req, res) {
  try {
    const scope = await resolveStoreScope(req);

    // Use the store-scoped list, which also checks active
    // assignments across all stores.
    const partners =
      await deliveryPartnerService.getAllDeliveryPartners(
        scope.store_id
      );

    const availablePartners = partners.filter(
      (partner) =>
        enabled(partner.is_active) &&
        enabled(partner.is_online) &&
        partner.verification_status === 'verified' &&
        !enabled(partner.has_active_delivery)
    );

    return res.status(200).json({
      success: true,
      message: 'Available delivery partners fetched successfully',
      data: availablePartners,
      scope,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Get available delivery partners error',
      'Failed to fetch available delivery partners'
    );
  }
}

async function updateOnlineStatus(req, res) {
  try {
    requireRole(req, ['delivery_partner']);

    const { is_online } = req.body || {};

    if (typeof is_online !== 'boolean') {
      throw httpError(
        400,
        'is_online must be true or false'
      );
    }

    const partner =
      await deliveryPartnerService.updateOnlineStatus(
        req.user.userId,
        is_online
      );

    return res.status(200).json({
      success: true,
      message: is_online
        ? 'Delivery partner is now online'
        : 'Delivery partner is now offline',
      data: partner,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Update online status error',
      'Failed to update online status'
    );
  }
}

async function updateLocation(req, res) {
  try {
    requireRole(req, ['delivery_partner']);

    const { latitude, longitude } = req.body || {};

    if (latitude === undefined || longitude === undefined) {
      throw httpError(
        400,
        'latitude and longitude are required'
      );
    }

    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      throw httpError(
        400,
        'latitude and longitude must be finite numbers'
      );
    }

    if (latitude < -90 || latitude > 90) {
      throw httpError(400, 'Invalid latitude');
    }

    if (longitude < -180 || longitude > 180) {
      throw httpError(400, 'Invalid longitude');
    }

    const partner =
      await deliveryPartnerService.updateDeliveryPartnerLocation(
        req.user.userId,
        latitude,
        longitude
      );

    return res.status(200).json({
      success: true,
      message: 'Delivery partner location updated successfully',
      data: partner,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Update location error',
      'Failed to update delivery partner location'
    );
  }
}

async function getMyDeliveryOrders(req, res) {
  try {
    requireRole(req, ['delivery_partner']);

    const orders =
      await deliveryPartnerService.getMyDeliveryOrders(
        req.user.userId
      );

    return res.status(200).json({
      success: true,
      message: 'Delivery partner orders fetched successfully',
      data: orders,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Get my delivery orders error',
      'Failed to fetch delivery orders'
    );
  }
}

// Shared validation and response handling for delivery actions.
function createDeliveryAction(serviceMethod, message, fallback) {
  return async function deliveryAction(req, res) {
    try {
      requireRole(req, ['delivery_partner']);
      const assignmentId = requireParamId(req, 'delivery assignment');

      const args = [req.user.userId, assignmentId];

      if (serviceMethod === 'rejectDeliveryOrder') {
        const { rejection_reason } = req.body || {};

        if (
          rejection_reason !== undefined &&
          rejection_reason !== null &&
          typeof rejection_reason !== 'string'
        ) {
          throw httpError(
            400,
            'rejection_reason must be a string'
          );
        }

        args.push(rejection_reason);
      }

      const result =
        await deliveryPartnerService[serviceMethod](...args);

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
        fallback
      );
    }
  };
}

const acceptDeliveryOrder = createDeliveryAction(
  'acceptDeliveryOrder',
  'Delivery order accepted successfully',
  'Failed to accept delivery order'
);

const rejectDeliveryOrder = createDeliveryAction(
  'rejectDeliveryOrder',
  'Delivery order rejected successfully',
  'Failed to reject delivery order'
);

const pickupDeliveryOrder = createDeliveryAction(
  'pickupDeliveryOrder',
  'Order picked up successfully',
  'Failed to pick up delivery order'
);

const deliverDeliveryOrder = createDeliveryAction(
  'deliverDeliveryOrder',
  'Order delivered successfully',
  'Failed to deliver order'
);

module.exports = {
  getDeliveryPartners,
  getDeliveryPartner,
  verifyDeliveryPartner,
  rejectDeliveryPartner,
  updateOnlineStatus,
  updateLocation,
  getAvailableDeliveryPartners,
  getMyDeliveryOrders,
  acceptDeliveryOrder,
  rejectDeliveryOrder,
  pickupDeliveryOrder,
  deliverDeliveryOrder,
};