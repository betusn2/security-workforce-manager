import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from './api';
import { navigateToLogin } from './navigationRef';

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

  // Login par CIN pour le pointage (même logique que /checkin web)
  loginByCin: async (cin, deviceFingerprint, deviceInfo, userType = 'agent') => {
    set({ isLoading: true, error: null });
    try {
      // 🆕 Connexion par CIN avec MÊMES paramètres que le web
      console.log('📞 API Call: authAPI.loginByCin', {
        cin,
        hasFingerprint: !!deviceFingerprint,
        hasDeviceInfo: !!deviceInfo,
        userType
      });
      
      const loginResponse = await authAPI.loginByCin({ 
        cin, 
        deviceFingerprint,  // NOUVEAU - identique au web
        deviceInfo,         // NOUVEAU - identique au web
        userType 
      });
      
      const { user, checkInToken } = loginResponse.data.data;

      // Stocker le token check-in
      await SecureStore.setItemAsync('checkInToken', checkInToken);
      await SecureStore.setItemAsync('checkInUser', JSON.stringify(user));

      console.log('✅ Login CIN réussi:', {
        userId: user.id,
        role: user.role,
        hasToken: !!checkInToken
      });

      // Toujours rediriger vers CheckIn après login CIN (comme le web /checkin)
      // Le CheckIn screen gère lui-même la vérification des événements disponibles
      set({ user, isAuthenticated: true, isCheckInMode: true, isLoading: false });
      return { success: true };
    } catch (error) {
      console.error('❌ Login CIN Error:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        code: error.response?.data?.code
      });
      
      let message = error.response?.data?.message || 'Erreur de connexion CIN';
      // Enrichir le message "CIN non trouvé"
      if (message === 'CIN non trouvé' || message === 'CIN not found') {
        const roleHint = userType === 'agent' ? 'Agents' : 'Responsables';
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
      // Rediriger immédiatement vers la page Login
      navigateToLogin();
    }
  },

  // Logout spécifique au mode check-in
  logoutCheckIn: async () => {
    await SecureStore.deleteItemAsync('checkInToken');
    await SecureStore.deleteItemAsync('checkInUser');
    set({ user: null, isAuthenticated: false, isCheckInMode: false });
    navigateToLogin();
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
