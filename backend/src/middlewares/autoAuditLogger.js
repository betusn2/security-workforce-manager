/**
 * Middleware global d'audit automatique
 * Trace automatiquement tous les appels POST, PUT, PATCH, DELETE
 * sans avoir besoin d'ajouter ActivityLog.create dans chaque route.
 */

// Mapping URL → entityType
const ENTITY_MAP = [
  { pattern: /\/users/,        entity: 'user' },
  { pattern: /\/events/,       entity: 'event' },
  { pattern: /\/assignments/,  entity: 'assignment' },
  { pattern: /\/attendance/,   entity: 'attendance' },
  { pattern: /\/incidents/,    entity: 'incident' },
  { pattern: /\/zones/,        entity: 'zone' },
  { pattern: /\/auth/,         entity: 'auth' },
  { pattern: /\/tracking/,     entity: 'tracking' },
  { pattern: /\/sos/,          entity: 'sos' },
  { pattern: /\/badges/,       entity: 'badge' },
  { pattern: /\/reports/,      entity: 'report' },
  { pattern: /\/messages/,     entity: 'message' },
  { pattern: /\/notifications/, entity: 'notification' },
  { pattern: /\/documents/,    entity: 'document' },
  { pattern: /\/permissions/,  entity: 'permission' },
];

// Mapping méthode HTTP → action
const ACTION_MAP = {
  POST:   'CREATE',
  PUT:    'UPDATE',
  PATCH:  'UPDATE',
  DELETE: 'DELETE',
};

// Actions spécifiques par sous-chemin
const SPECIFIC_ACTIONS = {
  '/auth/login':       'LOGIN',
  '/auth/logout':      'LOGOUT',
  '/auth/register':    'REGISTER',
  '/attendance/checkin':  'CHECK_IN',
  '/attendance/checkout': 'CHECK_OUT',
  '/sos':              'SOS_ALERT',
  '/tracking/location': 'GPS_UPDATE',
  '/tracking/position': 'GPS_UPDATE',
};

function getEntityType(path) {
  for (const { pattern, entity } of ENTITY_MAP) {
    if (pattern.test(path)) return entity;
  }
  return 'system';
}

function getAction(method, path) {
  // Check specific actions first
  for (const [subPath, action] of Object.entries(SPECIFIC_ACTIONS)) {
    if (path.endsWith(subPath) || path.includes(subPath + '/')) return action;
  }
  return ACTION_MAP[method] || method;
}

function extractEntityId(path, responseData) {
  // Try to get ID from response data
  const data = responseData?.data;
  if (data?.id) return data.id;
  if (data?.user?.id) return data.user.id;
  if (data?.assignment?.id) return data.assignment.id;
  if (data?.event?.id) return data.event.id;
  if (data?.incident?.id) return data.incident.id;

  // Try from URL path param (e.g., /users/123abc)
  const uuidMatch = path.match(/([0-9a-f-]{36})/i);
  if (uuidMatch) return uuidMatch[1];

  return null;
}

function sanitizeBody(body) {
  if (!body) return null;
  const safe = { ...body };
  // Remove sensitive fields
  delete safe.password;
  delete safe.passwordConfirm;
  delete safe.refreshToken;
  delete safe.token;
  delete safe.facialVector;
  delete safe.facialDescriptor;
  return Object.keys(safe).length > 0 ? safe : null;
}

module.exports = function autoAuditLogger(req, res, next) {
  // Only trace mutating methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  // Skip audit routes (avoid recursive logging)
  if (req.path.includes('/audit')) return next();

  // Skip GPS tracking (too frequent, would flood logs)
  if (req.path.includes('/tracking/location') || req.path.includes('/tracking/position')) return next();

  // Override res.json to capture the response
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    const result = originalJson(data);

    // Only log if user is authenticated
    if (!req.user) return result;

    const status = res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failure';
    const entityType = getEntityType(req.path);
    const action = getAction(req.method, req.path);
    const entityId = extractEntityId(req.path, data);

    // Build description
    const entityName = data?.data?.name || data?.data?.title || data?.data?.firstName
      ? `${data?.data?.name || data?.data?.title || (data?.data?.firstName + ' ' + data?.data?.lastName)}`
      : '';
    const description = `${action} ${entityType}${entityName ? ': ' + entityName : ''}`;

    // Log asynchronously - never block the response
    try {
      const { ActivityLog } = require('../models');
      ActivityLog.create({
        userId: req.user.id,
        action,
        entityType,
        entityId,
        description,
        status,
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
        newValues: req.method !== 'DELETE' ? sanitizeBody(req.body) : null,
      }).catch(err => {
        console.warn('⚠️ Auto audit log skipped:', err.message);
      });
    } catch (e) {
      // Never crash the request due to logging
    }

    return result;
  };

  next();
};
