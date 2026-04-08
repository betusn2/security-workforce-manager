/**
 * Face Recognition Service - Node.js Local Mode
 * Uses @vladmandic/face-api + sharp (pre-built binaries, NO canvas/libcairo deps)
 * Extracts 128-float face descriptors and compares them with euclidean distance
 * Identical algorithm to web CheckInOut.jsx → same match scores
 *
 * Models are bundled in backend/models/face-api/ (committed to repo)
 * Image decoding: sharp → raw RGB pixels → tf.Tensor3D (no canvas needed)
 */

const path = require('path');

let faceapi = null;
let sharpLib = null;
let modelsLoaded = false;
let initPromise = null;

// Match threshold: score >= 50% → VERIFIED (same as web MATCH_THRESHOLD = 0.50)
const MATCH_THRESHOLD_SCORE = 50;

// Models bundled in repository
const MODEL_DIR = path.join(__dirname, '..', '..', 'models', 'face-api');

/**
 * Initialize face-api.js with sharp for image decoding (no canvas required)
 */
async function init() {
  if (modelsLoaded) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('[FaceApiNode] Initializing (sharp + tfjs, no canvas)...');

      // Pure JS TF.js backend (no native binaries needed)
      require('@tensorflow/tfjs');

      // face-api.js Node build — we pass tf.Tensor3D directly, no canvas monkeyPatch
      faceapi = require('@vladmandic/face-api/dist/face-api.node.js');

      // sharp — pre-built binaries, decodes JPEG/PNG → raw RGB pixels
      sharpLib = require('sharp');
      console.log('[FaceApiNode] sharp loaded:', typeof sharpLib);

      console.log('[FaceApiNode] Loading models from:', MODEL_DIR);

      // Load 3 models needed for descriptor extraction (bundled in repo)
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_DIR),
        faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR),
        faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR),
      ]);

      modelsLoaded = true;
      console.log('[FaceApiNode] ✅ Models loaded successfully (no canvas)');
    } catch (err) {
      initPromise = null; // allow retry
      const errMsg = err?.message ?? String(err);
      console.error('[FaceApiNode] ❌ Initialization failed:', errMsg);
      if (err?.stack) console.error('[FaceApiNode] Stack:', err.stack);
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Extract 128-float face descriptor from a base64 image
 * Uses sharp to decode JPEG → raw RGB pixels → tf.Tensor3D (no canvas needed)
 * @param {string} base64Image - base64 JPEG/PNG (with or without data: prefix)
 * @returns {Float32Array|null}
 */
async function extractDescriptor(base64Image) {
  await init();

  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Decode image with sharp: resize to 640px wide (keep aspect), strip alpha, raw RGB
  const { data, info } = await sharpLib(buffer)
    .resize({ width: 640, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Create tf.Tensor3D from raw uint8 RGB data (shape [H, W, 3])
  // face-api.js TinyFaceDetector expects uint8 values 0-255 as float32 tensor
  const tensor = faceapi.tf.tensor3d(
    new Uint8Array(data),
    [info.height, info.width, 3]
  );

  try {
    const detection = await faceapi
      .detectSingleFace(tensor, new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.3,
      }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      console.log('[FaceApiNode] No face detected in image');
      return null;
    }

    return detection.descriptor; // Float32Array[128]
  } finally {
    faceapi.tf.dispose(tensor);
  }
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

