/**
 * Face Recognition Service - Node.js Local Mode
 * Uses @vladmandic/face-api + @napi-rs/canvas (pre-built binaries, no system deps)
 * Extracts 128-float face descriptors and compares them with euclidean distance
 * Identical algorithm to web CheckInOut.jsx → same match scores
 *
 * Models are bundled in backend/models/face-api/ (committed to repo)
 */

const path = require('path');

let faceapi = null;
let napiCanvas = null;
let modelsLoaded = false;
let initPromise = null;

// Match threshold: score >= 50% → VERIFIED (same as web MATCH_THRESHOLD = 0.50)
const MATCH_THRESHOLD_SCORE = 50;

// Models bundled in repository
const MODEL_DIR = path.join(__dirname, '..', '..', 'models', 'face-api');

/**
 * Initialize face-api.js with @napi-rs/canvas (no system library dependencies)
 */
async function init() {
  if (modelsLoaded) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('[FaceApiNode] Initializing...');

      // Pure JS TF.js backend (no native binaries needed)
      require('@tensorflow/tfjs');

      // face-api.js Node build
      faceapi = require('@vladmandic/face-api/dist/face-api.node.js');

      // @napi-rs/canvas — pre-built binaries, no libcairo system dependency
      napiCanvas = require('@napi-rs/canvas');
      const { Canvas, Image, ImageData } = napiCanvas;
      faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

      console.log('[FaceApiNode] Loading models from:', MODEL_DIR);

      // Load 3 models needed for descriptor extraction (bundled in repo)
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_DIR),
        faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR),
        faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR),
      ]);

      modelsLoaded = true;
      console.log('[FaceApiNode] ✅ Models loaded successfully');
    } catch (err) {
      initPromise = null; // allow retry
      console.error('[FaceApiNode] ❌ Initialization failed:', err.message, err.stack);
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Extract 128-float face descriptor from a base64 image
 * @param {string} base64Image - base64 JPEG/PNG (with or without data: prefix)
 * @returns {Float32Array|null}
 */
async function extractDescriptor(base64Image) {
  await init();

  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  const img = await napiCanvas.loadImage(buffer);

  const detection = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,
      scoreThreshold: 0.4,
    }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    console.log('[FaceApiNode] No face detected in image');
    return null;
  }

  return detection.descriptor; // Float32Array[128]
}

/**
 * Euclidean distance between two face descriptors
 * (same as faceapi.euclideanDistance() in web)
 */
function euclideanDistance(desc1, desc2) {
  const a = toFloat32Array(desc1);
  const b = toFloat32Array(desc2);
  if (a.length !== b.length) throw new Error(`Descriptor length mismatch: ${a.length} vs ${b.length}`);
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

/**
 * Convert distance to 0-100 match score (same formula as web)
 */
function distanceToScore(distance) {
  return Math.max(0, Math.round((1 - Math.min(distance, 1.0)) * 100));
}

/**
 * Validate that a descriptor is a real 128-float face-api.js descriptor
 */
function isValidDescriptor(descriptor) {
  if (!descriptor) return false;
  const arr = Array.isArray(descriptor) ? descriptor : (
    descriptor instanceof Float32Array ? Array.from(descriptor) : null
  );
  if (!arr) return false;
  return arr.length === 128 && arr.some(v => v < 0); // real descriptors have negative values
}

/**
 * Convert various descriptor formats to Float32Array
 */
function toFloat32Array(descriptor) {
  if (descriptor instanceof Float32Array) return descriptor;
  if (Array.isArray(descriptor)) return new Float32Array(descriptor);
  if (typeof descriptor === 'object' && descriptor !== null) {
    return new Float32Array(Object.values(descriptor));
  }
  throw new Error('Invalid descriptor format');
}

module.exports = {
  init,
  extractDescriptor,
  euclideanDistance,
  distanceToScore,
  isValidDescriptor,
  MATCH_THRESHOLD_SCORE,
};

