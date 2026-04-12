import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Vérifier les tokens dans cet ordre: accessToken (auth normale) → token (alias) → checkInToken (pointage CIN)
    const accessToken = localStorage.getItem('accessToken');
    const token = localStorage.getItem('token');
    const checkInToken = localStorage.getItem('checkInToken');
    
    const selectedToken = accessToken || token || checkInToken;
    
    // Debug logging for specific endpoints
    if (config.url.includes('assignments/my-assignments')) {
      console.log('🔐 Auth token for /my-assignments:', {
        hasAccessToken: !!accessToken,
        hasToken: !!token,
        hasCheckInToken: !!checkInToken,
        selectedToken: selectedToken ? `${selectedToken.substring(0, 20)}...` : 'NONE',
        url: config.url
      });
    }
    
    if (selectedToken) {
      config.headers.Authorization = `Bearer ${selectedToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)

);

// Response interceptor to handle token refresh and 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si erreur 401 (Unauthorized)
    if (error.response?.status === 401) {
      
      // Vérifier si on a un checkInToken (mode pointage)
      const checkInToken = localStorage.getItem('checkInToken');
      if (checkInToken) {
        // Session check-in expirée
        console.warn('Session check-in expirée');
        localStorage.removeItem('checkInToken');
        localStorage.removeItem('checkInUser');
        // Ne pas rediriger immédiatement pour éviter les boucles
        return Promise.reject(error);
      }

      // Si on a un accessToken (connexion normale) et pas encore essayé de refresh
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            const response = await axios.post(`${API_URL}/auth/refresh-token`, {
              refreshToken,
            });

            if (response.data.success) {
              const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;
              localStorage.setItem('accessToken', newAccessToken);
              if (newRefreshToken) {
                localStorage.setItem('refreshToken', newRefreshToken);
              }

              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              return api(originalRequest);
            }
          }
        } catch (refreshError) {
          console.error('Refresh token failed:', refreshError);
          // Nettoyer les tokens et rediriger vers login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      } else if (accessToken && originalRequest._retry) {
        // Déjà essayé de rafraîchir, rediriger vers login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// Fonction utilitaire pour gérer les erreurs d'API
const handleApiError = (error) => {
  if (error.response) {
    // La requête a été faite et le serveur a répondu avec un code d'erreur
    console.error('API Error Response:', {
      status: error.response.status,
      data: error.response.data,
      headers: error.response.headers
    });
    
    // Relancer l'erreur pour que le composant puisse la gérer dans son catch
    throw error;
  } else if (error.request) {
    // La requête a été faite mais aucune réponse n'a été reçue
    console.error('API Error Request:', error.request);
    const networkError = new Error('Pas de réponse du serveur. Vérifiez votre connexion internet.');
    networkError.isNetworkError = true;
    throw networkError;
  } else {
    // Une erreur s'est produite lors de la configuration de la requête
    console.error('API Error:', error.message);
    throw error;
  }
};

// Auth API
export const authAPI = {
  login: (data) => api.post('/auth/login', data).catch(handleApiError),
  register: (data) => api.post('/auth/register', data).catch(handleApiError),
  logout: () => api.post('/auth/logout').catch(handleApiError),
  getProfile: () => api.get('/auth/profile').catch(handleApiError),
  updateProfile: (data) => api.put('/auth/profile', data).catch(handleApiError),
  changePassword: (data) => api.put('/auth/change-password', data).catch(handleApiError),
  // Login par CIN (Agents & Responsables)
  loginByCin: (data) => api.post('/auth/login-cin', data).catch(handleApiError),
  verifyCin: (data) => api.post('/auth/verify-cin', data).catch(handleApiError),
  // Endpoint pour récupérer le vecteur facial en mode check-in
  getFacialVectorForCheckIn: () => {
    return api.get('/auth/facial-vector-checkin')
      .then(response => response)
      .catch(error => {
        // Si 404, essayer l'endpoint alternatif
        if (error.response?.status === 404) {
          console.log('Trying alternative facial vector endpoint...');
          return api.get('/auth/facial-vector')
            .catch(handleApiError);
        }
        return handleApiError(error);
      });
  },
  // Gestion appareils autorisés
  getAuthorizedDevices: (userId) => api.get(`/auth/devices/${userId || ''}`).catch(handleApiError),
  addAuthorizedDevice: (data) => api.post('/auth/devices/add', data).catch(handleApiError),
  removeAuthorizedDevice: (data) => api.post('/auth/devices/remove', data).catch(handleApiError),
  checkDeviceAuthorization: (data) => api.post('/auth/devices/check', data).catch(handleApiError),
  // Check-in specific endpoints - NO error handling to preserve error structure
  checkInLogin: (data) => api.post('/auth/checkin-login', data),
  verifyCheckInToken: () => api.get('/auth/verify-checkin-token'),
};

// Users API
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }).catch(handleApiError),
  getById: (id) => api.get(`/users/${id}`).catch(handleApiError),
  create: (data) => api.post('/users', data).catch(handleApiError),
  update: (id, data) => api.put(`/users/${id}`, data).catch(handleApiError),
  delete: (id) => api.delete(`/users/${id}`).catch(handleApiError),
  getAgents: (params) => api.get('/users/agents', { params }).catch(handleApiError),
  getSupervisors: () => api.get('/users/supervisors').catch(handleApiError),
  getSupervisedAgents: (id) => api.get(`/users/supervised/${id || ''}`).catch(handleApiError),
  getStats: (id, params) => api.get(`/users/stats/${id || ''}`, { params }).catch(handleApiError),
  resetPassword: (id, data) => api.post(`/users/${id}/reset-password`, data).catch(handleApiError),
  getFacialVector: (id) => api.get(`/users/${id}/facial-vector`).catch(handleApiError),
  updateFacialVector: (id, data) => api.put(`/users/${id}/facial-vector`, data).catch(handleApiError),
  searchByCin: (cin) => api.get(`/users/search/cin/${cin}`).catch(handleApiError),
  // Vérification d'unicité en temps réel
  checkEmailUnique: (email, excludeId) => api.get('/users/check-email', { params: { email, excludeId } }).catch(handleApiError),
  checkCinUnique: (cin, excludeId) => api.get('/users/check-cin', { params: { cin, excludeId } }).catch(handleApiError),
  checkPhoneUnique: (phone, excludeId) => api.get('/users/check-phone', { params: { phone, excludeId } }).catch(handleApiError),
};

// Events API
export const eventsAPI = {
  getAll: (params) => api.get('/events', { params }).catch(handleApiError),
  getById: (id) => api.get(`/events/${id}`).catch(handleApiError),
  create: (data) => api.post('/events', data).catch(handleApiError),
  update: (id, data) => api.put(`/events/${id}`, data).catch(handleApiError),
  delete: (id) => api.delete(`/events/${id}`).catch(handleApiError),
  getToday: () => api.get('/events/today').catch(handleApiError),
  getMyEvents: (params) => api.get('/events/my-events', { params }).catch(handleApiError),
  getStats: (id) => api.get(`/events/${id}/stats`).catch(handleApiError),
  getChronology: (id) => api.get(`/events/${id}/chronology`).catch(handleApiError),
};

// Phase management API
export const phaseAPI = {
  getStatus: (eventId) => api.get(`/events/${eventId}/phases`).catch(handleApiError),
  confirmPhase: (eventId, phase, checklist) => api.post(`/events/${eventId}/phases/${phase}/confirm`, { checklist }).catch(handleApiError),
  confirmSetupZones: (eventId, zoneIds) => api.post(`/events/${eventId}/phases/setup/zones`, { zoneIds }).catch(handleApiError),
  getSupervisedAgents: (eventId) => api.get(`/events/${eventId}/supervised-agents`).catch(handleApiError),
};

// Assignments API - IMPORTANT: Corrigé pour le check-in
export const assignmentsAPI = {
  getAll: (params) => api.get('/assignments', { params }).catch(handleApiError),
  getById: (id) => api.get(`/assignments/${id}`).catch(handleApiError),
  create: (data) => api.post('/assignments', data).catch(handleApiError),
  createBulk: (data) => api.post('/assignments/bulk', data).catch(handleApiError),
  update: (id, data) => api.put(`/assignments/${id}`, data).catch(handleApiError),
  delete: (id) => api.delete(`/assignments/${id}`).catch(handleApiError),
  respond: (id, response) => api.post(`/assignments/${id}/respond`, { response }).catch(handleApiError),
  bulkConfirm: (data) => api.post('/assignments/bulk-confirm', data).catch(handleApiError),
  // IMPORTANT: Corriger l'endpoint pour le check-in
  getMyAssignments: (params) => {
    console.log('📋 getMyAssignments called with params:', params);
    console.log('📋 Current token:', localStorage.getItem('checkInToken') ? '✅' : '❌');
    return api.get('/assignments/my-assignments', { params })
      .then(response => {
        console.log('✅ getMyAssignments SUCCESS:', response.data);
        return response;
      })
      .catch(error => {
        console.error('❌ getMyAssignments ERROR:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        // Si 404, essayer l'endpoint alternatif
        if (error.response?.status === 404) {
          console.log('Trying alternative assignments endpoint...');
          return api.get('/assignments/me', { params })
            .catch(error => {
              throw error; // Rejeter l'erreur au lieu de la retourner
            });
        }
        throw error; // Rejeter l'erreur au lieu de la retourner
      });
  },
};

// Attendance API - IMPORTANT: Corrigé pour le check-in
export const attendanceAPI = {
  getAll: (params) => api.get('/attendance', { params }).catch(handleApiError),
  getById: (id) => api.get(`/attendance/${id}`).catch(handleApiError),
  checkIn: (data) => api.post('/attendance/check-in', data),
  checkOut: (id, data) => api.post(`/attendance/check-out/${id}`, data),
  update: (id, data) => api.put(`/attendance/${id}`, data).catch(handleApiError),
  markAbsent: (data) => api.post('/attendance/mark-absent', data).catch(handleApiError),
  getMyAttendance: (params) => api.get('/attendance/my-attendance', { params }).catch(handleApiError),
  getDeviceInfo: () => api.get('/attendance/device-info/current').catch(handleApiError),
  // IMPORTANT: Corriger l'endpoint pour le check-in
  getTodayStatus: () => {
    return api.get('/attendance/today-status')
      .catch(error => {
        // Si 404, essayer l'endpoint alternatif
        if (error.response?.status === 404) {
          console.log('Trying alternative today status endpoint...');
          return api.get('/attendance/today')
            .catch(handleApiError);
        }
        return handleApiError(error);
      });
  },
  getStats: (params) => api.get('/attendance/stats', { params }).catch(handleApiError),
};

// Notifications API
export const notificationsAPI = {
  getMy: (params) => api.get('/notifications/my-notifications', { params }).catch(handleApiError),
  getUnreadCount: () => api.get('/notifications/unread-count').catch(handleApiError),
  markAsRead: (id) => api.put(`/notifications/${id}/read`).catch(handleApiError),
  markAllAsRead: () => api.put('/notifications/mark-all-read').catch(handleApiError),
  delete: (id) => api.delete(`/notifications/${id}`).catch(handleApiError),
  send: (data) => api.post('/notifications/send', data).catch(handleApiError),
  broadcast: (data) => api.post('/notifications/broadcast', data).catch(handleApiError),
  getAll: (params) => api.get('/notifications', { params }).catch(handleApiError),
  getStats: (params) => api.get('/notifications/stats', { params }).catch(handleApiError),
};

// Reports API
export const reportsAPI = {
  getDashboard: () => api.get('/reports/dashboard').catch(handleApiError),
  getAttendanceTrends: (params) => api.get('/reports/attendance-trends', { params }).catch(handleApiError),
  downloadPDF: (params) => api.get('/reports/attendance/pdf', { params, responseType: 'blob' }).catch(handleApiError),
  downloadExcel: (params) => api.get('/reports/attendance/excel', { params, responseType: 'blob' }).catch(handleApiError),
  getAgentReport: (agentId, params) => api.get(`/reports/agent/${agentId}`, { params }).catch(handleApiError),
  getActivityLogs: (params) => api.get('/reports/activity-logs', { params }).catch(handleApiError),
};

// Incidents API
export const incidentsAPI = {
  getAll: (params) => api.get('/incidents', { params }).catch(handleApiError),
  getById: (id) => api.get(`/incidents/${id}`).catch(handleApiError),
  create: (data) => api.post('/incidents', data).catch(handleApiError),
  update: (id, data) => api.put(`/incidents/${id}`, data).catch(handleApiError),
  delete: (id) => api.delete(`/incidents/${id}`).catch(handleApiError),
  getStats: (params) => api.get('/incidents/stats/summary', { params }).catch(handleApiError),
};

// Badges API
export const badgesAPI = {
  getAll: () => api.get('/badges').catch(handleApiError),
  getMyBadges: () => api.get('/badges/my').catch(handleApiError),
  getUserBadges: (userId) => api.get(`/badges/user/${userId}`).catch(handleApiError),
  create: (data) => api.post('/badges', data).catch(handleApiError),
  award: (data) => api.post('/badges/award', data).catch(handleApiError),
  revoke: (userId, badgeId) => api.delete(`/badges/revoke/${userId}/${badgeId}`).catch(handleApiError),
  getLeaderboard: () => api.get('/badges/leaderboard').catch(handleApiError),
  seed: () => api.post('/badges/seed').catch(handleApiError),
};

// Tracking API
export const trackingAPI = {
  getEventLivePositions: (eventId) => api.get(`/tracking/event/${eventId}/live`).catch(handleApiError),
  getAllLivePositions: () => api.get('/tracking/all/live').catch(handleApiError),
  getRealtimePositions: (eventId) => api.get(`/tracking/realtime/${eventId}`).catch(handleApiError),
  getUserHistory: (userId, eventId) => api.get(`/tracking/history/${userId}/${eventId}`).catch(handleApiError),
  getAlerts: (params) => api.get('/tracking/alerts', { params }).catch(handleApiError),
  recordLocation: (data) => api.post('/tracking/record', data).catch(handleApiError),
  purgeHistory: (data) => api.delete('/tracking/purge', { data }).catch(handleApiError),
  getPurgeCount: (params) => api.get('/tracking/purge/count', { params }).catch(handleApiError),
};

// Geofencing API
export const geofencingAPI = {
  checkPosition: (data) => api.post('/geofencing/check', data).catch(handleApiError),
  getEventZone: (eventId) => api.get(`/geofencing/event/${eventId}`).catch(handleApiError),
  getNearbyEvents: (params) => api.get('/geofencing/nearby', { params }).catch(handleApiError),
  updateAgentLocation: (data) => api.post('/geofencing/update-location', data).catch(handleApiError),
};

// Documents API
export const documentsAPI = {
  getTypes: () => api.get('/documents/types').catch(handleApiError),
  getUserDocuments: (userId) => api.get(`/documents/user/${userId}`).catch(handleApiError),
  getDocument: (id) => api.get(`/documents/${id}`).catch(handleApiError),
  downloadDocument: (id) => api.get(`/documents/${id}/download`, { responseType: 'blob' }).catch(handleApiError),
  uploadDocuments: (userId, data) => api.post(`/documents/user/${userId}`, data).catch(handleApiError),
  updateDocument: (id, data) => api.put(`/documents/${id}`, data).catch(handleApiError),
  verifyDocument: (id, data) => api.put(`/documents/${id}/verify`, data).catch(handleApiError),
  deleteDocument: (id) => api.delete(`/documents/${id}`).catch(handleApiError),
};

// Permissions API
export const permissionsAPI = {
  getMyPermissions: () => api.get('/permissions/my').catch(handleApiError),
  getAllPermissions: () => api.get('/permissions').catch(handleApiError),
  initialize: () => api.post('/permissions/initialize').catch(handleApiError),
  getAllRolesPermissions: () => api.get('/permissions/roles').catch(handleApiError),
  getRolePermissions: (role) => api.get(`/permissions/role/${role}`).catch(handleApiError),
  updateRolePermissions: (role, data) => api.put(`/permissions/role/${role}`, data).catch(handleApiError),
  getUserPermissions: (userId) => api.get(`/permissions/user/${userId}`).catch(handleApiError),
  updateUserPermissions: (userId, data) => api.put(`/permissions/user/${userId}`, data).catch(handleApiError),
};

// Zones API
export const zonesAPI = {
  getAll: (params) => api.get('/zones', { params }).catch(handleApiError),
  getByEvent: (eventId, params) => api.get(`/zones/event/${eventId}`, { params }).catch(handleApiError),
  getById: (id) => api.get(`/zones/${id}`).catch(handleApiError),
  getEventStats: (eventId) => api.get(`/zones/event/${eventId}/stats`).catch(handleApiError),
  getStats: () => api.get('/zones/stats').catch(handleApiError),
  getManagedZones: () => api.get('/supervisor/managed-zones').catch(handleApiError),
  getManagedEvents: () => api.get('/supervisor/managed-events').catch(handleApiError),
  create: (data) => api.post('/zones', data).catch(handleApiError),
  createBulk: (data) => api.post('/zones/bulk', data).catch(handleApiError),
  update: (id, data) => api.put(`/zones/${id}`, data).catch(handleApiError),
  delete: (id) => api.delete(`/zones/${id}`).catch(handleApiError),
  duplicate: (id, targetEventId) => api.post(`/zones/${id}/duplicate`, { targetEventId }).catch(handleApiError),
};

// Export par défaut
export default api;