/**
 * CompreFace Service
 * Service pour interagir avec l'API CompreFace pour la reconnaissance faciale
 */

const axios = require('axios');
const FormData = require('form-data');

class CompreFaceService {
  constructor() {
    // Configuration CompreFace
    this.baseUrl = process.env.COMPREFACE_URL || 'http://localhost:8000';
    this.apiKey = process.env.COMPREFACE_API_KEY || '';
    this.recognitionUrl = `${this.baseUrl}/api/v1/recognition`;
    this.detectionUrl = `${this.baseUrl}/api/v1/detection`;
    this.verificationUrl = `${this.baseUrl}/api/v1/verification`;

    // Seuil de similarité pour la reconnaissance (0-1)
    this.similarityThreshold = parseFloat(process.env.COMPREFACE_THRESHOLD) || 0.85;
  }

  /**
   * Configure l'API key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Headers communs pour les requêtes
   */
  getHeaders() {
    return {
      'x-api-key': this.apiKey
    };
  }

  /**
   * Convertir une image base64 en Buffer
   */
  base64ToBuffer(base64String) {
    // Supprimer le préfixe data:image/...;base64, si présent
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Ajouter un visage au système (enregistrement d'un utilisateur)
   * @param {string} subjectId - ID unique de l'utilisateur (ex: visage_userId)
   * @param {string} imageBase64 - Image en base64
   * @returns {Object} - Résultat de l'ajout
   */
  async addFace(subjectId, imageBase64) {
    try {
      const imageBuffer = this.base64ToBuffer(imageBase64);

      const formData = new FormData();
      formData.append('file', imageBuffer, {
        filename: 'face.jpg',
        contentType: 'image/jpeg'
      });

      const response = await axios.post(
        `${this.recognitionUrl}/faces?subject=${encodeURIComponent(subjectId)}`,
        formData,
        {
          headers: {
            ...this.getHeaders(),
            ...formData.getHeaders()
          },
          timeout: 30000
        }
      );

      return {
        success: true,
        data: response.data,
        imageId: response.data.image_id,
        subjectId: response.data.subject
      };
    } catch (error) {
      console.error('CompreFace addFace error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Supprimer tous les visages d'un sujet
   * @param {string} subjectId - ID de l'utilisateur
   */
  async deleteFaces(subjectId) {
    try {
      const response = await axios.delete(
        `${this.recognitionUrl}/faces?subject=${encodeURIComponent(subjectId)}`,
        { headers: this.getHeaders(), timeout: 10000 }
      );

      return {
        success: true,
        deletedCount: response.data.deleted
      };
    } catch (error) {
      console.error('CompreFace deleteFaces error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Reconnaître un visage (identifier parmi les visages enregistrés)
   * @param {string} imageBase64 - Image à analyser en base64
   * @param {number} limit - Nombre max de résultats
   * @returns {Object} - Résultats de la reconnaissance
   */
  async recognizeFace(imageBase64, limit = 1) {
    try {
      const imageBuffer = this.base64ToBuffer(imageBase64);

      const formData = new FormData();
      formData.append('file', imageBuffer, {
        filename: 'face.jpg',
        contentType: 'image/jpeg'
      });

      const response = await axios.post(
        `${this.recognitionUrl}/recognize?limit=${limit}&prediction_count=1&det_prob_threshold=0.6`,
        formData,
        {
          headers: {
            ...this.getHeaders(),
            ...formData.getHeaders()
          },
          timeout: 30000
        }
      );

      const result = response.data.result;

      if (!result || result.length === 0) {
        return {
          success: true,
          faceDetected: false,
          message: 'Aucun visage détecté'
        };
      }

      const face = result[0];
      const subjects = face.subjects || [];

      if (subjects.length === 0) {
        return {
          success: true,
          faceDetected: true,
          recognized: false,
          message: 'Visage détecté mais non reconnu',
          box: face.box
        };
      }

      const bestMatch = subjects[0];
      const isMatch = bestMatch.similarity >= this.similarityThreshold;

      return {
        success: true,
        faceDetected: true,
        recognized: isMatch,
        subjectId: bestMatch.subject,
        similarity: Math.round(bestMatch.similarity * 100),
        confidence: Math.round(face.box.probability * 100),
        box: face.box,
        allMatches: subjects.map(s => ({
          subjectId: s.subject,
          similarity: Math.round(s.similarity * 100)
        }))
      };
    } catch (error) {
      console.error('CompreFace recognizeFace error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Vérifier si deux visages correspondent (1:1 verification)
   * @param {string} sourceImageBase64 - Image source en base64
   * @param {string} targetImageBase64 - Image cible en base64
   * @returns {Object} - Résultat de la vérification
   */
  async verifyFaces(sourceImageBase64, targetImageBase64) {
    try {
      const sourceBuffer = this.base64ToBuffer(sourceImageBase64);
      const targetBuffer = this.base64ToBuffer(targetImageBase64);

      const formData = new FormData();
      formData.append('source_image', sourceBuffer, {
        filename: 'source.jpg',
        contentType: 'image/jpeg'
      });
      formData.append('target_image', targetBuffer, {
        filename: 'target.jpg',
        contentType: 'image/jpeg'
      });

      const response = await axios.post(
        `${this.verificationUrl}/verify`,
        formData,
        {
          headers: {
            ...this.getHeaders(),
            ...formData.getHeaders()
          },
          timeout: 30000
        }
      );

      const result = response.data.result;

      if (!result || result.length === 0) {
        return {
          success: true,
          verified: false,
          message: 'Impossible de comparer les visages'
        };
      }

      const verification = result[0];
      const similarity = verification.face_matches?.[0]?.similarity || 0;
      const isMatch = similarity >= this.similarityThreshold;

      return {
        success: true,
        verified: isMatch,
        similarity: Math.round(similarity * 100),
        sourceBox: verification.box,
        message: isMatch ? 'Visages identiques' : 'Visages différents'
      };
    } catch (error) {
      console.error('CompreFace verifyFaces error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Détecter les visages dans une image (sans reconnaissance)
   * @param {string} imageBase64 - Image en base64
   * @returns {Object} - Visages détectés
   */
  async detectFaces(imageBase64) {
    try {
      const imageBuffer = this.base64ToBuffer(imageBase64);

      const formData = new FormData();
      formData.append('file', imageBuffer, {
        filename: 'face.jpg',
        contentType: 'image/jpeg'
      });

      const response = await axios.post(
        `${this.detectionUrl}/detect?limit=10&det_prob_threshold=0.8&face_plugins=age,gender,landmarks`,
        formData,
        {
          headers: {
            ...this.getHeaders(),
            ...formData.getHeaders()
          },
          timeout: 30000
        }
      );

      const result = response.data.result || [];

      return {
        success: true,
        facesCount: result.length,
        faces: result.map(face => ({
          box: face.box,
          probability: Math.round(face.box.probability * 100),
          age: face.age,
          gender: face.gender,
          landmarks: face.landmarks
        }))
      };
    } catch (error) {
      console.error('CompreFace detectFaces error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Lister tous les sujets enregistrés
   * @returns {Object} - Liste des sujets
   */
  async listSubjects() {
    try {
      const response = await axios.get(
        `${this.recognitionUrl}/subjects`,
        { headers: this.getHeaders(), timeout: 10000 }
      );

      return {
        success: true,
        subjects: response.data.subjects || []
      };
    } catch (error) {
      console.error('CompreFace listSubjects error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Vérifier la santé du service CompreFace
   * @returns {Object} - État du service
   */
  async healthCheck() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/recognition/status`,
        {
          headers: this.getHeaders(),
          timeout: 5000
        }
      );

      return {
        success: true,
        status: 'online',
        data: response.data
      };
    } catch (error) {
      // Essayer un autre endpoint
      try {
        const response = await axios.get(`${this.baseUrl}/healthcheck`, { timeout: 5000 });
        return {
          success: true,
          status: 'online',
          data: response.data
        };
      } catch (e) {
        return {
          success: false,
          status: 'offline',
          error: error.message
        };
      }
    }
  }
}

// Export singleton instance
module.exports = new CompreFaceService();
