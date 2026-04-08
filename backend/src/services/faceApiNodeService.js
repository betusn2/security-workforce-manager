/**
 * Face Recognition Service - Node.js Local Mode
 * Uses @vladmandic/face-api + canvas (same library as web dashboard)
 * Extracts 128-float face descriptors and compares them with euclidean distance
 * Identical algorithm to web CheckInOut.jsx → same match scores
 *
 * Models are downloaded from GitHub CDN on first use and cached in /tmp
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');

let faceapi = null;
let canvas = null;
let modelsLoaded = false;
let initPromise = null;

// Match threshold: score >= 50% → VERIFIED (same as web MATCH_THRESHOLD = 0.50)
const MATCH_THRESHOLD_SCORE = 50;

// Model files hosted on GitHub raw content
const MODEL_BASE_URL = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model';
const MODEL_FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
];

const MODEL_CACHE_DIR = path.join(os.tmpdir(), 'security-guard-face-api-models');

/**
 * Download a file via HTTPS with redirect support
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) return resolve(); // already cached

    const file = fs.createWriteStream(dest + '.tmp');
    const request = (targetUrl) => {
      https.get(targetUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          return request(response.headers.location);
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest + '.tmp');
          return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          fs.renameSync(dest + '.tmp', dest);
          resolve();
        });
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(dest + '.tmp')) fs.unlinkSync(dest + '.tmp');
        reject(err);
      });
    };
    request(url);
  });
}

/**
 * Download all required model files to cache directory
 */
async function downloadModels() {
  if (!fs.existsSync(MODEL_CACHE_DIR)) {
    fs.mkdirSync(MODEL_CACHE_DIR, { recursive: true });
    console.log('[FaceApiNode] Created model cache dir:', MODEL_CACHE_DIR);
  }

  console.log('[FaceApiNode] Downloading model files...');
  for (const file of MODEL_FILES) {
    const dest = path.join(MODEL_CACHE_DIR, file);
    if (!fs.existsSync(dest)) {
      console.log('[FaceApiNode] Downloading:', file);
      await downloadFile(`${MODEL_BASE_URL}/${file}`, dest);
    }
  }
  console.log('[FaceApiNode] All model files ready');
}

/**
 * Initialize face-api.js with Node.js canvas polyfills and load models
 */
async function init() {
  if (modelsLoaded) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('[FaceApiNode] Initializing face-api.js...');

      // Download models if not cached
      await downloadModels();

      // Load tensorflow CPU backend (pure JS, no native bindings)
      require('@tensorflow/tfjs');

      // Load face-api.js Node build and canvas
      faceapi = require('@vladmandic/face-api/dist/face-api.node.js');
      canvas = require('canvas');
      const { Canvas, Image, ImageData } = canvas;

      // Monkey-patch canvas APIs so face-api.js works in Node.js
      faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

      // Load the 3 models from local cache
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_CACHE_DIR),
        faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_CACHE_DIR),
        faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_CACHE_DIR),
      ]);

      modelsLoaded = true;
      console.log('[FaceApiNode] ✅ Models loaded successfully');
    } catch (err) {
      initPromise = null; // allow retry
      console.error('[FaceApiNode] ❌ Initialization failed:', err.message);
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

