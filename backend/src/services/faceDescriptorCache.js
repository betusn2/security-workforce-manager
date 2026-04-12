/**
 * faceDescriptorCache.js
 * =====================
 * In-memory cache of 128-float face descriptors, keyed by eventId.
 * 
 * Strategy:
 *  - On first verify for an event, load ALL assignments for that event
 *    → fetch each assigned agent's stored facialDescriptor from DB
 *    → keep in RAM: Map<eventId, Map<userId, Float32Array>>
 *  - Subsequent verifications: pure JS dot-product comparison (0 DB query)
 *  - Cache TTL: 2 hours (auto-evicted)
 *  - Single-user miss: lazy-load that user's descriptor into the cache
 *  - Manual invalidation: clearEvent(eventId) or clearUser(userId)
 *
 * Performance:
 *  - 30-agent event → 30 × 128 floats = ~15 KB RAM
 *  - Euclidean distance (pure JS) for 30 descriptors ≈ 0.1 ms
 *  → No DB hit, no TF inference on reference side → verify in ~200-400ms
 */

const { User, Assignment } = require('../models');
const { Op } = require('sequelize');

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// Map<eventId, { descriptors: Map<userId, Float32Array>, loadedAt: number }>
const eventCache = new Map();

// Map<userId, Float32Array> — single-user lookups
const userCache = new Map();

// ── Helpers ────────────────────────────────────────────────────────────────────
function toFloat32(raw) {
  if (!raw) return null;
  try {
    if (raw instanceof Float32Array) return raw;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed) && parsed.length === 128) return new Float32Array(parsed);
    if (typeof parsed === 'object') {
      const vals = Object.values(parsed);
      if (vals.length === 128) return new Float32Array(vals);
    }
  } catch { /* ignore */ }
  return null;
}

function isExpired(loadedAt) {
  return Date.now() - loadedAt > CACHE_TTL_MS;
}

// ── Load all descriptors for an event ──────────────────────────────────────────
async function loadEventDescriptors(eventId) {
  // Find all confirmed/pending assignments for the event
  const assignments = await Assignment.findAll({
    where: {
      eventId,
      status: { [Op.in]: ['confirmed', 'pending'] },
    },
    attributes: ['agentId'],
  });

  const agentIds = [...new Set(assignments.map(a => a.agentId).filter(Boolean))];

  if (agentIds.length === 0) {
    console.log(`[FaceCache] Event ${eventId}: no assigned agents found`);
    eventCache.set(eventId, { descriptors: new Map(), loadedAt: Date.now() });
    return new Map();
  }

  // Load descriptors from DB (only columns we need)
  const users = await User.findAll({
    where: { id: { [Op.in]: agentIds } },
    attributes: ['id', 'facialDescriptor', 'facialVector'],
  });

  const descriptors = new Map();
  let loaded = 0;

  for (const u of users) {
    // Try facialDescriptor first (JSON), then facialVector (encrypted stored by web)
    let desc = toFloat32(u.facialDescriptor);

    if (!desc && u.facialVector) {
      // facialVector may be stored as encrypted blob — use getDecryptedFacialVector if available
      try {
        const decrypted = typeof u.getDecryptedFacialVector === 'function'
          ? u.getDecryptedFacialVector()
          : null;
        desc = toFloat32(decrypted);
      } catch { /* ignore */ }
    }

    if (desc) {
      descriptors.set(u.id, desc);
      userCache.set(u.id, desc); // also populate single-user cache
      loaded++;
    }
  }

  eventCache.set(eventId, { descriptors, loadedAt: Date.now() });
  console.log(`[FaceCache] Event ${eventId}: cached ${loaded}/${agentIds.length} descriptors`);
  return descriptors;
}

// ── Get descriptor for a specific user (with lazy load) ───────────────────────
async function getUserDescriptor(userId, eventId) {
  // 1. Check user cache first
  if (userCache.has(userId)) return userCache.get(userId);

  // 2. Check event cache
  if (eventId && eventCache.has(eventId) && !isExpired(eventCache.get(eventId).loadedAt)) {
    const cached = eventCache.get(eventId).descriptors.get(userId);
    if (cached) return cached;
  }

  // 3. Load from DB + store in user cache
  const user = await User.findByPk(userId, {
    attributes: ['id', 'facialDescriptor', 'facialVector', 'profilePhoto'],
  });
  if (!user) return null;

  let desc = toFloat32(user.facialDescriptor);

  if (!desc && user.facialVector) {
    try {
      const decrypted = typeof user.getDecryptedFacialVector === 'function'
        ? user.getDecryptedFacialVector()
        : null;
      desc = toFloat32(decrypted);
    } catch { /* ignore */ }
  }

  // 4. Auto-enroll from profilePhoto if no descriptor stored
  if (!desc && user.profilePhoto) {
    console.log(`[FaceCache] User ${userId}: no descriptor stored, extracting from profilePhoto...`);
    try {
      const faceApiNode = require('./faceApiNodeService');
      const extracted = await faceApiNode.extractDescriptor(user.profilePhoto);
      if (extracted) {
        desc = extracted;
        // Persist for future calls
        await User.update(
          { facialDescriptor: JSON.stringify(Array.from(extracted)) },
          { where: { id: userId } }
        );
        console.log(`[FaceCache] User ${userId}: descriptor extracted from profilePhoto and cached`);
      }
    } catch (e) {
      console.warn(`[FaceCache] User ${userId}: auto-enroll failed: ${e.message}`);
    }
  }

  if (desc) {
    userCache.set(userId, desc);
    // Also update event cache if loaded
    if (eventId && eventCache.has(eventId)) {
      eventCache.get(eventId).descriptors.set(userId, desc);
    }
  }

  return desc || null;
}

// ── Get or load event descriptors ─────────────────────────────────────────────
async function getEventDescriptors(eventId) {
  const cached = eventCache.get(eventId);
  if (cached && !isExpired(cached.loadedAt)) return cached.descriptors;
  return await loadEventDescriptors(eventId);
}

// ── Euclidean distance (pure JS, no TF) ───────────────────────────────────────
function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < 128; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

// ── Find best match in event (event-scoped 1:N) ───────────────────────────────
async function findBestMatchInEvent(capturedDescriptor, eventId) {
  const descriptors = await getEventDescriptors(eventId);
  if (descriptors.size === 0) return null;

  let bestUserId = null;
  let bestDist = Infinity;

  for (const [uid, ref] of descriptors) {
    const dist = euclideanDistance(capturedDescriptor, ref);
    if (dist < bestDist) {
      bestDist = dist;
      bestUserId = uid;
    }
  }

  const score = Math.max(0, Math.round((1 - Math.min(bestDist, 1.0)) * 100));
  return { userId: bestUserId, distance: bestDist, score };
}

// ── Cache invalidation ─────────────────────────────────────────────────────────
function clearEvent(eventId) {
  eventCache.delete(eventId);
  console.log(`[FaceCache] Event ${eventId} cache cleared`);
}

function clearUser(userId) {
  userCache.delete(userId);
  // Also remove from all event caches
  for (const [, entry] of eventCache) {
    entry.descriptors.delete(userId);
  }
  console.log(`[FaceCache] User ${userId} cache cleared`);
}

function clearAll() {
  eventCache.clear();
  userCache.clear();
  console.log('[FaceCache] All caches cleared');
}

function getCacheStats() {
  const events = Array.from(eventCache.entries()).map(([id, e]) => ({
    eventId: id,
    agentCount: e.descriptors.size,
    ageMins: Math.round((Date.now() - e.loadedAt) / 60000),
    expired: isExpired(e.loadedAt),
  }));
  return {
    events,
    totalEvents: eventCache.size,
    totalUsers: userCache.size,
  };
}

module.exports = {
  getEventDescriptors,
  getUserDescriptor,
  findBestMatchInEvent,
  loadEventDescriptors,
  clearEvent,
  clearUser,
  clearAll,
  getCacheStats,
  euclideanDistance,
};
