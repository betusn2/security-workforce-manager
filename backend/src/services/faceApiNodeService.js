/**
 * Face Recognition Service - Node.js Local Mode
 * Uses @vladmandic/face-api + canvas (same library as web dashboard)
 * Extracts 128-float face descriptors and compares them with euclidean distance
 * Identical algorithm to web CheckInOut.jsx → same match scores
 */

const path = require('path');

let faceapi = null;
let canvas = null;
let modelsLoaded = false;
let initPromise = null;

// Match threshold: distance <= 0.5 → score >= 50% → VERIFIED (same as web MATCH_THRESHOLD = 0.50)
const MATCH_THRESHOLD_SCORE = 50;

/**
 * Initialize face-api.js with Node.js canvas polyfills and load models lazily
 */
async function init() {
  if (modelsLoaded) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('[FaceApiNode] Initializing face-api.js...');

      // Load tensorflow CPU backend (pure JS, no native bindings needed)
      require('@tensorflow/tfjs');

      // Load face-api.js and canvas
      faceapi = require('@vladmandic/face-api');
      canvas = require('canvas');
      const { Canvas, Image, ImageData } = canvas;

      // Monkey-patch Node.js canvas APIs so face-api.js works
      faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

      // Resolve model path from installed @vladmandic/face-api package
      const packageJsonPath = require.resolve('@vladmandic/face-api/package.json');
      const modelPath = path.join(path.dirname(packageJsonPath), 'model');
      console.log('[FaceApiNode] Loading models from:', modelPath);

      // Load only the 3 models needed for descriptor extraction
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath),
        faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
        faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath),
      ]);

      modelsLoaded = true;
      console.log('[FaceApiNode] ✅ Models loaded successfully');
    } catch (err) {
      initPromise = null; // allow retry on next call
      console.error('[FaceApiNode] ❌ Initialization failed:', err.message);
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Extract 128-float face descriptor from a base64 image
 * @param {string} base64Image - base64 JPEG/PNG (with or without data: prefix)
 * @returns {Float32Array|null} - 128-float descriptor, or null if no face detected
 */
async function extractDescriptor(base64Image) {
  await init();

  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  const img = await canvas.loadImage(buffer);

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

  console.log('[FaceApiNode] Face detected, descriptor length:', detection.descriptor.length);
  return detection.descriptor; // Float32Array[128]
}

/**
 * Compute euclidean distance between two face descriptors
 * (same as faceapi.euclideanDistance() in web)
 */
function euclideanDistance(desc1, desc2) {
  const a = toFloat32Array(desc1);
  const b = toFloat32Array(desc2);

  if (a.length !== b.length) {
    throw new Error(`Descriptor length mismatch: ${a.length} vs ${b.length}`);
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * Convert distance to a 0-100 match score
 * Identical to web formula: (1 - min(distance, 1.0)) * 100
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
    // Handle {0: x, 1: y, ...} object format
    return new Float32Array(Object.values(descriptor));
  }
  throw new Error('Invalid descriptor format');
}

/**
 * Compare two face photos directly (extract + compare in one call)
 * @returns {{ distance, score, verified, faceDetected }}
 */
async function comparePhotos(refBase64, capturedBase64) {
  const [refDesc, capturedDesc] = await Promise.all([
    extractDescriptor(refBase64),
    extractDescriptor(capturedBase64),
  ]);

  if (!refDesc) return { faceDetected: false, score: 0, verified: false, error: 'NO_FACE_IN_REF' };
  if (!capturedDesc) return { faceDetected: false, score: 0, verified: false, error: 'NO_FACE' };

  const distance = euclideanDistance(refDesc, capturedDesc);
  const score = distanceToScore(distance);
  const verified = score >= MATCH_THRESHOLD_SCORE;

  return { distance, score, verified, faceDetected: true };
}

module.exports = {
  init,
  extractDescriptor,
  euclideanDistance,
  distanceToScore,
  isValidDescriptor,
  comparePhotos,
  MATCH_THRESHOLD_SCORE,
};
