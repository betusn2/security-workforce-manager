import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 
                   process.env.REACT_APP_SOCKET_URL || 
                   'https://security-guard-backend.onrender.com';

let globalSocket = null;

/**
 * Hook de synchronisation temps réel automatique
 * Met à jour automatiquement les données quand elles changent en base
 * 
 * @param {string} entity - Type d'entité ('events', 'users', 'assignments', 'attendance', etc.)
 * @param {function} onUpdate - Callback appelé quand les données changent
 * @param {object} user - Utilisateur connecté (pour auth Socket.IO)
 */
export const useRealTimeSync = (entity, onUpdate, user = null) => {
  const callbackRef = useRef(onUpdate);
  
  useEffect(() => {
    callbackRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!entity || !user) return;

    // Créer ou réutiliser la connexion Socket.IO globale
    if (!globalSocket || !globalSocket.connected) {
      console.log('🔌 Initialisation Socket.IO Real-Time Sync:', SOCKET_URL);
      
      globalSocket = io(SOCKET_URL, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      globalSocket.on('connect', () => {
        console.log('✅ Socket.IO Real-Time connecté');
        
        // Authentification automatique
        const token = localStorage.getItem('token') || 
                     localStorage.getItem('accessToken') || 
                     localStorage.getItem('checkInToken');
        
        if (token && user) {
          globalSocket.emit('auth', {
            userId: user.id,
            role: user.role,
            token: token
          });
        }
      });

      globalSocket.on('auth:success', () => {
        console.log('✅ Auth Socket.IO Real-Time réussie');
      });

      globalSocket.on('disconnect', (reason) => {
        console.log('❌ Socket.IO Real-Time déconnecté:', reason);
      });

      globalSocket.on('connect_error', (error) => {
        console.error('❌ Erreur connexion Socket.IO:', error);
      });
    }

    // Écouter les événements de mise à jour pour cette entité
    const eventTypes = ['created', 'updated', 'deleted'];
    const handlers = {};

    eventTypes.forEach(type => {
      const eventName = `${entity}:${type}`;
      
      const handler = (data) => {
        console.log(`🔄 Mise à jour temps réel: ${eventName}`, data);
        
        // Appeler le callback pour rafraîchir les données
        if (callbackRef.current) {
          callbackRef.current({ type, data });
        }
      };

      handlers[eventName] = handler;
      globalSocket.on(eventName, handler);
    });

    // Cleanup
    return () => {
      eventTypes.forEach(type => {
        const eventName = `${entity}:${type}`;
        if (handlers[eventName]) {
          globalSocket.off(eventName, handlers[eventName]);
        }
      });
    };
  }, [entity, user]);

  return globalSocket;
};

/**
 * Hook pour polling automatique (fallback si Socket.IO échoue)
 * 
 * @param {function} fetchFunction - Fonction async qui récupère les données
 * @param {number} interval - Intervalle en ms (défaut: 30s)
 */
export const useAutoRefresh = (fetchFunction, interval = 30000) => {
  useEffect(() => {
    if (!fetchFunction) return;

    // Fetch initial
    fetchFunction();

    // Polling automatique
    const intervalId = setInterval(() => {
      console.log('🔄 Auto-refresh polling...');
      fetchFunction();
    }, interval);

    return () => clearInterval(intervalId);
  }, [fetchFunction, interval]);
};

/**
 * Disconnect Socket.IO global (pour logout)
 */
export const disconnectRealTimeSync = () => {
  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
    console.log('🔌 Socket.IO Real-Time déconnecté');
  }
};

export default useRealTimeSync;
