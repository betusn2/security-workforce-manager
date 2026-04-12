/**
 * Face Recognition Controller
 * API endpoints for facial recognition and verification
 * Supports both local face-api.js and CompreFace backend
 */

const faceRecognitionService = require('../services/faceRecognitionService');
const compreFaceService = require('../services/compreFaceService');
const { User, Attendance } = require('../models');
const { Op } = require('sequelize');

// Mode de reconnaissance: 'compreface' ou 'local'
const RECOGNITION_MODE = process.env.FACE_RECOGNITION_MODE || 'compreface';

// Anomaly tracking
const anomalyTracker = {
  attempts: new Map(), // userId -> { count, lastAttempt, failures }
  alerts: [],
  maxFailures: 3,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
};

/**
 * Initialize face recognition models
 */
exports.initialize = async (req, res) => {
  try {
    const result = await faceRecognitionService.initialize();
    res.json({
      success: result,
      message: result ? 'Face recognition models loaded' : 'Failed to load models',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error initializing face recognition',
      error: error.message,
    });
  }
};

/**
 * Register face for a user
 * Supports both CompreFace and local mode
 */
exports.registerFace = async (req, res) => {
  try {
    const { userId, images, image } = req.body;
    const imageData = image || (images && images[0]);

    if (!userId || !imageData) {
      return res.status(400).json({
        success: false,
        message: 'User ID and image are required',
      });
    }

    // Verify user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    let result;

    if (RECOGNITION_MODE === 'compreface') {
      // Mode CompreFace
      const subjectId = `user_${userId}`;

      // Supprimer anciens visages
      await compreFaceService.deleteFaces(subjectId);

      // Ajouter nouveau visage
      result = await compreFaceService.addFace(subjectId, imageData);

      if (result.success) {
        // CompreFace OK → aussi extraire et stocker le descriptor local (face-api.js)
        // pour permettre la vérification locale si CompreFace devient indisponible
        user.profilePhoto = imageData;
        user.facialVectorUpdatedAt = new Date();
        await user.save();

        // Extraction du descriptor en arrière-plan (non bloquant)
        _extractAndStoreDescriptor(userId, imageData).catch(e =>
          console.warn('[RegisterFace] Extraction descriptor local échouée:', e.message)
        );

        logActivity('FACE_REGISTERED_COMPREFACE', userId, {
          imageId: result.imageId,
          subjectId: result.subjectId,
        });

        return res.json({
          success: true,
          message: 'Visage enregistré avec succès (CompreFace)',
          imageId: result.imageId,
          subjectId: result.subjectId,
        });
      } else {
        // CompreFace KO → utiliser face-api.js local
        console.warn('[RegisterFace] CompreFace KO, utilisation face-api.js local');
        return await _registerWithLocalFaceApi(res, userId, imageData, user);
      }
    } else {
      // Mode local → face-api.js
      return await _registerWithLocalFaceApi(res, userId, imageData, user);
    }
  } catch (error) {
    console.error('Face registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering face',
      error: error.message,
    });
  }
};

/**
 * Verify face for attendance
 * Supports both CompreFace and local mode
 */
exports.verifyFace = async (req, res) => {
  try {
    const { userId, image, eventId, checkType } = req.body;

    if (!userId || !image) {
      return res.status(400).json({
        success: false,
        message: 'User ID and image are required',
      });
    }

    // Check for lockout
    const lockoutStatus = checkLockout(userId);
    if (lockoutStatus.locked) {
      logAnomaly('LOCKOUT_ATTEMPT', userId, {
        remainingTime: lockoutStatus.remainingTime,
      });

      return res.status(429).json({
        success: false,
        verified: false,
        errorCode: 'ACCOUNT_LOCKED',
        message: `Compte temporairement bloqué. Réessayez dans ${Math.ceil(lockoutStatus.remainingTime / 60000)} minutes`,
        remainingTime: lockoutStatus.remainingTime,
      });
    }

    // Load user from database
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
    }

    let result;

    if (RECOGNITION_MODE === 'compreface') {
      // Mode CompreFace - Reconnaissance et vérification
      const recognitionResult = await compreFaceService.recognizeFace(image, 1);

      if (!recognitionResult.success) {
        // CompreFace KO → utiliser face-api.js local pour une vraie comparaison biométrique
        // Même algorithme que le tableau de bord web (CheckInOut.jsx)
        console.warn('[FaceVerif] CompreFace KO, basculement sur face-api.js local:', recognitionResult.error);
        return await _verifyWithLocalFaceApi(req, res, user, image, userId, eventId, checkType);
      }

      if (!recognitionResult.faceDetected) {
        return res.json({
          success: true,
          verified: false,
          faceDetected: false,
          confidence: 0,
          message: 'Aucun visage détecté',
          errorCode: 'NO_FACE',
        });
      }

      const expectedSubjectId = `user_${userId}`;
      const isVerified = recognitionResult.recognized &&
                         recognitionResult.subjectId === expectedSubjectId;

      result = {
        success: true,
        verified: isVerified,
        confidence: recognitionResult.similarity || 0,
        faceDetected: true,
        message: isVerified ? 'Identité vérifiée' : 'Identité non confirmée',
        errorCode: isVerified ? null : 'FACE_MISMATCH',
      };

      // Track attempt
      trackAttempt(userId, result.verified);

      if (result.verified) {
        logActivity('FACE_VERIFIED_COMPREFACE', userId, {
          confidence: result.confidence,
          eventId,
          checkType,
        });
        resetAttempts(userId);
      } else {
        logActivity('FACE_VERIFICATION_FAILED', userId, {
          errorCode: result.errorCode,
          eventId,
          recognizedAs: recognitionResult.subjectId,
        });
        checkForAnomalies(userId, result);
      }

      return res.json(result);
    } else {
      // Mode local → vraie comparaison faciale via face-api.js
      return await _verifyWithLocalFaceApi(req, res, user, image, userId, eventId, checkType);
    }
  } catch (error) {
    console.error('Face verification error:', error);
    res.status(500).json({
      success: false,
      verified: false,
      message: 'Erreur lors de la vérification faciale',
      error: error.message,
    });
  }
};

/**
 * Identify face (1:N matching)
 */
exports.identifyFace = async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Image is required',
      });
    }

    // Load all registered faces into cache
    await loadAllFaceDescriptors();

    const result = await faceRecognitionService.identifyFace(image, {
      maxResults: 5,
      requireLiveness: true,
    });

    if (result.success && result.identified && result.matches.length > 0) {
      // Get user details for matches
      const userIds = result.matches.map(m => m.userId);
      const users = await User.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ['id', 'firstName', 'lastName', 'employeeId', 'profilePhoto'],
      });

      const userMap = new Map(users.map(u => [u.id.toString(), u]));

      result.matches = result.matches.map(match => ({
        ...match,
        user: userMap.get(match.userId) || null,
      }));

      logActivity('FACE_IDENTIFIED', result.matches[0].userId, {
        confidence: result.matches[0].confidence,
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Face identification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error identifying face',
      error: error.message,
    });
  }
};

/**
 * Detect faces in image
 */
exports.detectFaces = async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Image is required',
      });
    }

    const result = await faceRecognitionService.detectFaces(image);

    res.json(result);
  } catch (error) {
    console.error('Face detection error:', error);
    res.status(500).json({
      success: false,
      message: 'Error detecting faces',
      error: error.message,
    });
  }
};

/**
 * Get service statistics
 */
exports.getStats = async (req, res) => {
  try {
    const serviceStats = faceRecognitionService.getStats();

    // Add database stats
    const dbStats = await User.count({
      where: { facialDescriptor: { [Op.ne]: null } },
    });

    // Recent anomalies
    const recentAnomalies = anomalyTracker.alerts
      .filter(a => Date.now() - a.timestamp < 24 * 60 * 60 * 1000)
      .slice(-20);

    res.json({
      success: true,
      data: {
        service: serviceStats,
        registeredUsers: dbStats,
        anomalies: {
          total: recentAnomalies.length,
          recent: recentAnomalies,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting stats',
      error: error.message,
    });
  }
};

/**
 * Get anomaly alerts
 */
exports.getAnomalies = async (req, res) => {
  try {
    const { hours = 24, type } = req.query;
    const since = Date.now() - (parseInt(hours) * 60 * 60 * 1000);

    let alerts = anomalyTracker.alerts.filter(a => a.timestamp >= since);

    if (type) {
      alerts = alerts.filter(a => a.type === type);
    }

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        period: `${hours} hours`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting anomalies',
      error: error.message,
    });
  }
};

/**
 * Delete face registration
 */
exports.deleteFaceRegistration = async (req, res) => {
  try {
    const { userId } = req.params;

    // Clear from cache
    faceRecognitionService.clearUserCache(userId);

    // Clear from database
    await User.update(
      {
        facialDescriptor: null,
        facialVectorUpdatedAt: null,
      },
      { where: { id: userId } }
    );

    logActivity('FACE_DELETED', userId);

    res.json({
      success: true,
      message: 'Face registration deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting face registration',
      error: error.message,
    });
  }
};

/**
 * Export face data for backup
 */
exports.exportFaceData = async (req, res) => {
  try {
    // Load all descriptors
    await loadAllFaceDescriptors();

    const data = faceRecognitionService.exportAllData();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error exporting face data',
      error: error.message,
    });
  }
};

/**
 * Import face data from backup
 */
exports.importFaceData = async (req, res) => {
  try {
    const { data } = req.body;

    const result = faceRecognitionService.importAllData(data);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error importing face data',
      error: error.message,
    });
  }
};

/**
 * Adjust recognition threshold
 */
exports.adjustThreshold = async (req, res) => {
  try {
    const { threshold } = req.body;

    if (threshold < 0.1 || threshold > 0.9) {
      return res.status(400).json({
        success: false,
        message: 'Threshold must be between 0.1 and 0.9',
      });
    }

    faceRecognitionService.recognitionThreshold = threshold;

    res.json({
      success: true,
      message: 'Threshold updated',
      newThreshold: threshold,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adjusting threshold',
      error: error.message,
    });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Enregistrement facial local avec face-api.js
 */
async function _registerWithLocalFaceApi(res, userId, imageData, user) {
  try {
    const faceApiNode = require('../services/faceApiNodeService');

    console.log('[RegisterFace] Extraction descriptor avec face-api.js...');
    const descriptor = await faceApiNode.extractDescriptor(imageData);

    if (!descriptor) {
      return res.status(400).json({
        success: false,
        message: 'Aucun visage détecté dans la photo fournie — reprenez une photo avec le visage bien visible',
        errorCode: 'NO_FACE',
      });
    }

    await User.update({
      profilePhoto: imageData,
      facialDescriptor: JSON.stringify(Array.from(descriptor)),
      facialVectorUpdatedAt: new Date(),
    }, { where: { id: userId } });

    logActivity('FACE_REGISTERED', userId, { mode: 'face-api-local' });

    return res.json({
      success: true,
      message: 'Visage enregistré avec succès (face-api.js local)',
      userId,
      source: 'face-api-local',
    });
  } catch (err) {
    console.error('[RegisterFace] Erreur face-api.js:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement facial',
      error: err.message,
    });
  }
}

/**
 * Extrait et stocke le descriptor en arrière-plan (après CompreFace registration)
 */
async function _extractAndStoreDescriptor(userId, imageData) {
  const faceApiNode = require('../services/faceApiNodeService');
  const descriptor = await faceApiNode.extractDescriptor(imageData);
  if (descriptor) {
    await User.update(
      { facialDescriptor: JSON.stringify(Array.from(descriptor)) },
      { where: { id: userId } }
    );
    console.log('[RegisterFace] Descriptor local sauvegardé pour userId:', userId);
  }
}

/**
 * Verification faciale locale avec face-api.js (Node.js)
 * Même algorithme que le tableau de bord web :
 *   1. Récupère le descriptor stocké (facialVector décrypté ou facialDescriptor)
 *   2. Si absent mais profilePhoto → extrait depuis la photo d'enregistrement
 *   3. Extrait le descriptor de la photo capturée (selfie mobile)
 *   4. Calcule la distance euclidienne → score 0-100
 */
async function _verifyWithLocalFaceApi(req, res, user, image, userId, eventId, checkType) {
  try {
    const faceApiNode = require('../services/faceApiNodeService');

    // 1. Récupérer le descriptor de référence
    let storedDescriptor = null;

    // Essayer facialVector (chiffré, mis à jour par le web avec face-api.js)
    const decryptedVector = user.getDecryptedFacialVector();
    if (faceApiNode.isValidDescriptor(decryptedVector)) {
      storedDescriptor = decryptedVector;
      console.log('[FaceVerif] Référence: facialVector décrypté (128 floats, web enrollment)');
    }

    // Essayer facialDescriptor (JSON brut, mis à jour par le backend)
    if (!storedDescriptor && user.facialDescriptor) {
      try {
        const parsed = JSON.parse(user.facialDescriptor);
        if (faceApiNode.isValidDescriptor(parsed)) {
          storedDescriptor = parsed;
          console.log('[FaceVerif] Référence: facialDescriptor JSON (128 floats, backend enrollment)');
        }
      } catch (e) { /* ignore */ }
    }

    // Si aucun descriptor valide mais profilePhoto → extraire maintenant (auto-enroll)
    if (!storedDescriptor && user.profilePhoto) {
      console.log('[FaceVerif] Pas de descriptor valide, extraction depuis profilePhoto...');
      const refDescriptor = await faceApiNode.extractDescriptor(user.profilePhoto);
      if (refDescriptor) {
        storedDescriptor = refDescriptor;
        // Sauvegarder pour les prochaines vérifications
        await User.update(
          { facialDescriptor: JSON.stringify(Array.from(refDescriptor)) },
          { where: { id: userId } }
        );
        console.log('[FaceVerif] Descriptor extrait de profilePhoto et sauvegardé');
      }
    }

    if (!storedDescriptor) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Visage non enregistré — contactez un administrateur',
        errorCode: 'NOT_REGISTERED',
      });
    }

    // 2. Extraire le descriptor de la photo capturée (selfie mobile)
    console.log('[FaceVerif] Extraction du descriptor depuis la photo capturée...');
    const capturedDescriptor = await faceApiNode.extractDescriptor(image);

    if (!capturedDescriptor) {
      return res.json({
        success: true,
        verified: false,
        faceDetected: false,
        confidence: 0,
        message: 'Aucun visage détecté — repositionnez votre visage face à la caméra',
        errorCode: 'NO_FACE',
      });
    }

    // 3. Comparer (même formule que web : distance euclidienne → score 0-100)
    const distance = faceApiNode.euclideanDistance(capturedDescriptor, storedDescriptor);
    const confidence = faceApiNode.distanceToScore(distance);
    const isVerified = confidence >= faceApiNode.MATCH_THRESHOLD_SCORE; // >= 50%

    console.log(`[FaceVerif] distance=${distance.toFixed(3)}, score=${confidence}%, vérifié=${isVerified}`);

    trackAttempt(userId, isVerified);

    if (isVerified) {
      resetAttempts(userId);
      logActivity('FACE_VERIFIED', userId, { confidence, mode: 'face-api-local', eventId, checkType });
    } else {
      logActivity('FACE_VERIFICATION_FAILED', userId, {
        confidence, mode: 'face-api-local', errorCode: 'FACE_MISMATCH', eventId,
      });
      checkForAnomalies(userId, { verified: false, confidence, errorCode: 'FACE_MISMATCH' });
    }

    return res.json({
      success: true,
      verified: isVerified,
      confidence,
      score: confidence,
      faceDetected: true,
      source: 'face-api-local',
      message: isVerified
        ? `Identité confirmée (${confidence}%)`
        : `Identité non confirmée — visage différent (${confidence}%)`,
      errorCode: isVerified ? null : 'FACE_MISMATCH',
    });

  } catch (faceApiError) {
    const errMsg = faceApiError?.message ?? String(faceApiError);
    console.error('[FaceVerif] Erreur face-api.js local:', errMsg);
    if (faceApiError?.stack) console.error('[FaceVerif] Stack:', faceApiError.stack);

    // Dernier recours : si les modèles ne sont pas encore chargés ou erreur temporaire
    // → refuser proprement plutôt que de laisser passer n'importe qui
    return res.status(503).json({
      success: false,
      verified: false,
      message: 'Service de reconnaissance faciale temporairement indisponible — réessayez dans quelques secondes',
      errorCode: 'SERVICE_UNAVAILABLE',
      debug: errMsg,
    });
  }
}

/**
 * Load all face descriptors from database
 */
async function loadAllFaceDescriptors() {
  const users = await User.findAll({
    where: {
      facialDescriptor: { [Op.ne]: null },
    },
    attributes: ['id', 'facialDescriptor', 'facialVectorUpdatedAt'],
  });

  for (const user of users) {
    try {
      const descriptor = JSON.parse(user.facialDescriptor);
      faceRecognitionService.importUserData(user.id.toString(), {
        descriptor,
        registeredAt: user.facialVectorUpdatedAt,
      });
    } catch (e) {
      console.error(`Error loading descriptor for user ${user.id}:`, e);
    }
  }

  return users.length;
}

/**
 * Check if user is locked out
 */
function checkLockout(userId) {
  const attempts = anomalyTracker.attempts.get(userId);
  if (!attempts) return { locked: false };

  if (attempts.failures >= anomalyTracker.maxFailures) {
    const timeSinceLast = Date.now() - attempts.lastAttempt;
    if (timeSinceLast < anomalyTracker.lockoutDuration) {
      return {
        locked: true,
        remainingTime: anomalyTracker.lockoutDuration - timeSinceLast,
      };
    } else {
      // Lockout expired, reset
      resetAttempts(userId);
    }
  }

  return { locked: false };
}

/**
 * Track verification attempt
 */
function trackAttempt(userId, success) {
  const current = anomalyTracker.attempts.get(userId) || {
    count: 0,
    failures: 0,
    lastAttempt: 0,
  };

  current.count++;
  current.lastAttempt = Date.now();

  if (!success) {
    current.failures++;
  }

  anomalyTracker.attempts.set(userId, current);
}

/**
 * Reset attempts for user
 */
function resetAttempts(userId) {
  anomalyTracker.attempts.delete(userId);
}

/**
 * Check for anomalies
 */
function checkForAnomalies(userId, result) {
  const attempts = anomalyTracker.attempts.get(userId);

  // Multiple failures
  if (attempts && attempts.failures >= 2) {
    logAnomaly('MULTIPLE_FAILURES', userId, {
      failures: attempts.failures,
      totalAttempts: attempts.count,
    });
  }

  // Spoof attempt detected
  if (result.errorCode === 'LIVENESS_FAILED') {
    logAnomaly('SPOOF_ATTEMPT', userId, {
      livenessScore: result.livenessScore,
    });
  }
}

/**
 * Log anomaly
 */
function logAnomaly(type, userId, details = {}) {
  const alert = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    type,
    userId,
    timestamp: Date.now(),
    details,
    severity: getSeverity(type),
  };

  anomalyTracker.alerts.push(alert);

  // Keep only last 1000 alerts
  if (anomalyTracker.alerts.length > 1000) {
    anomalyTracker.alerts = anomalyTracker.alerts.slice(-1000);
  }

  console.warn(`[ANOMALY] ${type} for user ${userId}:`, details);
}

/**
 * Get severity level for anomaly type
 */
function getSeverity(type) {
  const severities = {
    SPOOF_ATTEMPT: 'critical',
    LOCKOUT_ATTEMPT: 'high',
    MULTIPLE_FAILURES: 'medium',
    UNUSUAL_LOCATION: 'medium',
    UNUSUAL_TIME: 'low',
  };
  return severities[type] || 'low';
}

/**
 * Log activity
 */
function logActivity(action, userId, details = {}) {
  console.log(`[ACTIVITY] ${action} - User ${userId}:`, details);
  // Could also store in database for audit trail
}

// ============================================
// ⚡ FAST VERIFY — event-scoped cache
// ============================================

/**
 * POST /face-recognition/verify-fast
 * Body: { userId, image, eventId }
 *
 * Flow:
 *   1. Extract descriptor from incoming image (TF inference — only 1× per request)
 *   2. Look up stored descriptor from in-memory cache (0 DB queries on cache hit)
 *   3. Compute euclidean distance in pure JS (~0.1 ms for 30 agents)
 *   → Total: ~200-400 ms vs 3-10 s with old approach
 */
exports.verifyFast = async (req, res) => {
  const t0 = Date.now();
  try {
    const { userId, image, eventId } = req.body;

    if (!userId || !image) {
      return res.status(400).json({ success: false, message: 'userId et image sont requis' });
    }

    // Lockout check
    const lockout = checkLockout(userId);
    if (lockout.locked) {
      return res.status(429).json({
        success: false, verified: false, errorCode: 'ACCOUNT_LOCKED',
        message: `Compte bloqué. Réessayez dans ${Math.ceil(lockout.remainingTime / 60000)} min`,
        remainingTime: lockout.remainingTime,
      });
    }

    const faceApiNode = require('../services/faceApiNodeService');
    const faceCache   = require('../services/faceDescriptorCache');

    // 1. Extract descriptor from incoming photo (the only TF inference call)
    const capturedDescriptor = await faceApiNode.extractDescriptor(image);

    if (!capturedDescriptor) {
      return res.json({
        success: true, verified: false, faceDetected: false,
        confidence: 0, errorCode: 'NO_FACE',
        message: 'Aucun visage détecté — repositionnez votre visage',
        ms: Date.now() - t0,
      });
    }

    // 2. Get stored reference descriptor from cache (0 DB query on hit)
    const storedDescriptor = await faceCache.getUserDescriptor(userId, eventId);

    if (!storedDescriptor) {
      return res.status(400).json({
        success: false, verified: false,
        errorCode: 'NOT_REGISTERED',
        message: 'Visage non enregistré — contactez un administrateur',
        ms: Date.now() - t0,
      });
    }

    // 3. Compare — pure JS, microsecond range
    const distance   = faceCache.euclideanDistance(capturedDescriptor, storedDescriptor);
    const confidence = Math.max(0, Math.round((1 - Math.min(distance, 1.0)) * 100));
    const isVerified = confidence >= faceApiNode.MATCH_THRESHOLD_SCORE;

    const ms = Date.now() - t0;
    console.log(`[VerifyFast] userId=${userId} score=${confidence}% verified=${isVerified} ms=${ms}`);

    trackAttempt(userId, isVerified);
    if (isVerified) {
      resetAttempts(userId);
      logActivity('FACE_VERIFIED_FAST', userId, { confidence, eventId, ms });
    } else {
      logActivity('FACE_VERIFICATION_FAILED_FAST', userId, { confidence, eventId, ms });
      checkForAnomalies(userId, { verified: false, confidence, errorCode: 'FACE_MISMATCH' });
    }

    return res.json({
      success: true,
      verified: isVerified,
      confidence,
      score: confidence,
      faceDetected: true,
      source: 'fast-cache',
      ms,
      message: isVerified
        ? `Identité confirmée (${confidence}%)`
        : `Identité non confirmée (${confidence}%)`,
      errorCode: isVerified ? null : 'FACE_MISMATCH',
    });
  } catch (err) {
    console.error('[VerifyFast] Error:', err.message);
    return res.status(503).json({
      success: false, verified: false,
      errorCode: 'SERVICE_UNAVAILABLE',
      message: 'Service de reconnaissance temporairement indisponible',
      ms: Date.now() - t0,
    });
  }
};

/**
 * POST /face-recognition/warm-cache/:eventId
 * Pre-load all agent descriptors for an event into RAM.
 * Call this when an event starts to ensure first check-in is instant.
 */
exports.warmCache = async (req, res) => {
  try {
    const { eventId } = req.params;
    const faceCache = require('../services/faceDescriptorCache');
    const descriptors = await faceCache.loadEventDescriptors(eventId);
    return res.json({
      success: true,
      message: `Cache réchauffé: ${descriptors.size} agent(s) chargés`,
      agentCount: descriptors.size,
      eventId,
    });
  } catch (err) {
    console.error('[WarmCache] Error:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur lors du chargement du cache' });
  }
};

/**
 * GET /face-recognition/cache-stats
 */
exports.getCacheStats = async (req, res) => {
  try {
    const faceCache = require('../services/faceDescriptorCache');
    return res.json({ success: true, data: faceCache.getCacheStats() });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur cache stats' });
  }
};
