import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authAPI, assignmentsAPI } from './api';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isCheckInMode: false, // Mode pointage (CIN)
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login({ email, password });
      const { user, accessToken, refreshToken } = response.data.data;

      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);

      set({ user, isAuthenticated: true, isCheckInMode: false, isLoading: false });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Erreur de connexion';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  // Login par CIN pour le pointage
  loginByCin: async (cin, deviceInfo, userType = 'agent') => {
    set({ isLoading: true, error: null });
    try {
      // 1. Connexion par CIN avec le type d'utilisateur
      const loginResponse = await authAPI.loginByCin({ cin, deviceInfo, userType });
      const { user, checkInToken } = loginResponse.data.data;

      // Stocker le token check-in
      await SecureStore.setItemAsync('checkInToken', checkInToken);

      // 2. Vérifier les assignations pour aujourd'hui ou dans les 2h
      const assignmentsResponse = await assignmentsAPI.getMyAssignments({
        status: 'confirmed',
        today: true
      });

      const assignments = assignmentsResponse.data.data || [];
      const now = new Date();
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const today = now.toISOString().split('T')[0];

      const validAssignments = assignments.filter(a => {
        if (!a.event?.startDate) return false;
        const eventDate = new Date(a.event.startDate);
        const eventDateStr = eventDate.toISOString().split('T')[0];
        if (eventDateStr === today) return true;
        if (eventDate >= now && eventDate <= twoHoursLater) return true;
        return false;
      });

      if (validAssignments.length === 0) {
        await SecureStore.deleteItemAsync('checkInToken');
        const roleMessage = userType === 'agent' 
          ? "Aucun événement trouvé. Assurez-vous d'être connecté via la section 'Agents' et d'être affecté à un événement confirmé aujourd'hui ou dans les 2 prochaines heures."
          : "Aucun événement trouvé. Assurez-vous d'être connecté via la section 'Responsables' et d'être affecté à un événement confirmé aujourd'hui ou dans les 2 prochaines heures.";
        set({ isLoading: false, error: roleMessage });
        return { success: false, error: roleMessage };
      }

      // Stocker les infos utilisateur
      await SecureStore.setItemAsync('checkInUser', JSON.stringify(user));
      set({ user, isAuthenticated: true, isCheckInMode: true, isLoading: false });
      return { success: true };
    } catch (error) {
      let message = error.response?.data?.message || 'Erreur de connexion CIN';
      // Enrichir le message "CIN non trouvé" avec du contexte utile
      if (message === 'CIN non trouvé' || message === 'CIN not found') {
        const roleHint = userType === 'agent'
          ? 'Agents'
          : 'Responsables';
        message = `CIN non trouvé\n\n⚠️ Votre compte n\'existe pas encore. Demandez à l\'administrateur de créer votre compte via le tableau de bord web (section ${roleHint}).`;
      }
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('checkInToken');
      await SecureStore.deleteItemAsync('checkInUser');
      set({ user: null, isAuthenticated: false, isCheckInMode: false });
    }
  },

  // Logout spécifique au mode check-in
  logoutCheckIn: async () => {
    await SecureStore.deleteItemAsync('checkInToken');
    await SecureStore.deleteItemAsync('checkInUser');
    set({ user: null, isAuthenticated: false, isCheckInMode: false });
  },

  checkAuth: async () => {
    try {
      // Vérifier d'abord accessToken (connexion normale)
      const accessToken = await SecureStore.getItemAsync('accessToken');
      if (accessToken) {
        const response = await authAPI.getProfile();
        set({ user: response.data.data, isAuthenticated: true, isCheckInMode: false });
        return true;
      }

      // Vérifier checkInToken (mode pointage)
      const checkInToken = await SecureStore.getItemAsync('checkInToken');
      if (checkInToken) {
        const checkInUserStr = await SecureStore.getItemAsync('checkInUser');
        if (checkInUserStr) {
          const user = JSON.parse(checkInUserStr);
          set({ user, isAuthenticated: true, isCheckInMode: true });
          return true;
        }
      }
    } catch (error) {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('checkInToken');
      await SecureStore.deleteItemAsync('checkInUser');
    }
    set({ user: null, isAuthenticated: false, isCheckInMode: false });
    return false;
  },

  updateProfile: async (data) => {
    try {
      const response = await authAPI.updateProfile(data);
      set({ user: response.data.data });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message };
    }
  },

  updateFacialVector: async (vector) => {
    try {
      await authAPI.updateFacialVector({ facialVector: vector });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message };
    }
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
