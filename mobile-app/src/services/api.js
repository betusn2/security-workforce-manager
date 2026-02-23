import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://security-guard-backend-w3qv.onrender.com/api'; // Production Render

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60s pour le cold start Render (free tier peut prendre 30-60s)
});

// Réveille le serveur si besoin (cold start Render)
export const wakeUpServer = async () => {
  try {
    await axios.get(`${API_URL}/health`, { timeout: 90000 });
  } catch (_) { /* ignore */ }
};

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    // Vérifier d'abord accessToken, sinon checkInToken
    const accessToken = await SecureStore.getItemAsync('accessToken');
    const checkInToken = await SecureStore.getItemAsync('checkInToken');
    const token = accessToken || checkInToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh-token`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          await SecureStore.setItemAsync('accessToken', accessToken);
          await SecureStore.setItemAsync('refreshToken', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  loginByCin: (data) => api.post('/auth/login-cin', data),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  updateFacialVector: (data) => api.put('/auth/facial-vector', data),
};

export const eventsAPI = {
  getMyEvents: (params) => api.get('/events/my-events', { params }),
  getToday: () => api.get('/events/today'),
  getById: (id) => api.get(`/events/${id}`),
};

export const assignmentsAPI = {
  getMyAssignments: (params) => api.get('/assignments/my-assignments', { params }),
  getById: (id) => api.get(`/assignments/${id}`),
  respond: (id, response) => api.post(`/assignments/${id}/respond`, { response }),
};

export const attendanceAPI = {
  checkIn: (data) => api.post('/attendance/check-in', data),
  checkOut: (id, data) => api.post(`/attendance/check-out/${id}`, data),
  getMyAttendance: (params) => api.get('/attendance/my-attendance', { params }),
  getTodayStatus: () => api.get('/attendance/today-status'),
  getTodayAttendance: (eventId) => api.get('/attendance/today-status', { params: { eventId } }),
  updateLocation: (data) => api.post('/attendance/update-location', data),
};

export const zonesAPI = {
  getById: (id) => api.get(`/zones/${id}`),
};

export const usersAPI = {
  getById: (id) => api.get(`/users/${id}`),
};

export const notificationsAPI = {
  getMy: (params) => api.get('/notifications/my-notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/mark-all-read'),
};

export default api;
