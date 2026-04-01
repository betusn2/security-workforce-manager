import './src/services/backgroundLocationTask';

import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, AppState, Text, ScrollView, TouchableOpacity } from 'react-native';

// ── Error Boundary — affiche l'erreur au lieu d'écran blanc ────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('💥 App crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 40 }}>💥</Text>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626', marginTop: 12, textAlign: 'center' }}>
            Erreur de l'application
          </Text>
          <ScrollView style={{ marginTop: 16, maxHeight: 300, width: '100%' }}>
            <Text style={{ fontSize: 12, color: '#7f1d1d', fontFamily: 'monospace', backgroundColor: '#fecaca', padding: 12, borderRadius: 8 }}>
              {this.state.error?.toString()}
            </Text>
          </ScrollView>
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: '#dc2626', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import useAuthStore from './src/services/authStore';
import { navigationRef } from './src/services/navigationRef';
import socketService from './src/services/socketService';
import useTracking from './src/services/useTracking';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
  syncPendingPositions,
} from './src/services/backgroundLocationTask';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CheckInScreen from './src/screens/CheckInScreen';
import CheckOutScreen from './src/screens/CheckOutScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import IncidentReportScreen from './src/screens/IncidentReportScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import EventsScreen from './src/screens/EventsScreen';
import AssignmentsScreen from './src/screens/AssignmentsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import UsersScreen from './src/screens/UsersScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import DocumentsScreen from './src/screens/DocumentsScreen';
import LiveTrackingScreen from './src/screens/LiveTrackingScreen';
import BadgesScreen from './src/screens/BadgesScreen';
import HelpScreen from './src/screens/HelpScreen';
import TrackingStatusBanner from './src/components/TrackingStatusBanner';

// Écran placeholder pour fonctionnalités bientôt disponibles
const ComingSoonScreen = ({ navigation, route }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6', padding: 32 }}>
    <Ionicons name="construct-outline" size={64} color="#d1d5db" />
    <Text style={{ fontSize: 20, fontWeight: '700', color: '#374151', marginTop: 16, textAlign: 'center' }}>
      {route?.params?.title || 'Fonctionnalité bientôt disponible'}
    </Text>
    <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>
      Cette section sera disponible dans une prochaine mise à jour.
    </Text>
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      style={{ marginTop: 24, backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
    >
      <Text style={{ color: '#fff', fontWeight: '600' }}>Retour</Text>
    </TouchableOpacity>
  </View>
);


// ── Configuration des notifications ────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ── Les composants écrans sont importés depuis src/screens ──────────────────

// Main Tab Navigator — role-based tabs
const MainTabs = () => {
  const { user } = useAuthStore();
  const role = user?.role || 'agent';

  const tabBarScreenOptions = ({ route }) => ({
    tabBarIcon: ({ focused, color, size }) => {
      const icons = {
        'Accueil':       focused ? 'home'             : 'home-outline',
        'Historique':    focused ? 'time'             : 'time-outline',
        'Événements':    focused ? 'calendar'         : 'calendar-outline',
        'Affectations':  focused ? 'briefcase'        : 'briefcase-outline',
        'Notifications': focused ? 'notifications'    : 'notifications-outline',
        'Profil':        focused ? 'person'           : 'person-outline',
        'Utilisateurs':  focused ? 'people'           : 'people-outline',
        'Rapports':      focused ? 'bar-chart'        : 'bar-chart-outline',
        'Paramètres':    focused ? 'settings'         : 'settings-outline',
      };
      return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />;
    },
    tabBarActiveTintColor: role === 'admin' ? '#dc2626' : role === 'supervisor' ? '#d97706' : '#2563eb',
    tabBarInactiveTintColor: '#9ca3af',
    tabBarStyle: {
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
      paddingBottom: 5,
      paddingTop: 5,
      height: 60,
    },
    headerShown: false,
  });

  if (role === 'admin') {
    return (
      <Tab.Navigator screenOptions={tabBarScreenOptions}>
        <Tab.Screen name="Accueil"       component={HomeScreen} />
        <Tab.Screen name="Événements"    component={EventsScreen} />
        <Tab.Screen name="Utilisateurs"  component={UsersScreen} />
        <Tab.Screen name="Suivi"         component={LiveTrackingScreen} options={{ tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? 'location' : 'location-outline'} size={size} color={color} /> }} />
        <Tab.Screen name="Rapports"      component={ReportsScreen} />
        <Tab.Screen name="Profil"        component={ProfileScreen} />
      </Tab.Navigator>
    );
  }

  if (role === 'supervisor') {
    return (
      <Tab.Navigator screenOptions={tabBarScreenOptions}>
        <Tab.Screen name="Accueil"       component={HomeScreen} />
        <Tab.Screen name="Événements"    component={EventsScreen} />
        <Tab.Screen name="Affectations"  component={AssignmentsScreen} />
        <Tab.Screen name="Suivi"         component={LiveTrackingScreen} options={{ tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? 'location' : 'location-outline'} size={size} color={color} /> }} />
        <Tab.Screen name="Notifications" component={NotificationsScreen} />
        <Tab.Screen name="Profil"        component={ProfileScreen} />
      </Tab.Navigator>
    );
  }

  // Agent (default)
  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions}>
      <Tab.Screen name="Accueil"       component={HomeScreen} />
      <Tab.Screen name="Affectations"  component={AssignmentsScreen} />
      <Tab.Screen name="Historique"    component={HistoryScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profil"        component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// Main App Component
export default function App() {
  const { isAuthenticated, isCheckInMode, checkAuth, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [currentEventId, setCurrentEventId] = useState(null);
  const notificationResponseListener = useRef(null);

  // 🔌 Connexion Socket.IO + capture caméra sur demande
  useTracking(currentEventId);

  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
      setIsLoading(false);
    };
    initAuth();

    // Surveillance de la connectivité réseau
    const unsubNetInfo = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });

    // Deep linking depuis notifications
    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (!navigationRef.current) return;
      if (data?.screen === 'Notifications') navigationRef.current.navigate('Notifications');
      else if (data?.screen === 'EventDetail' && data.eventId) navigationRef.current.navigate('EventDetail', { eventId: data.eventId });
      else if (data?.screen === 'IncidentReport') navigationRef.current.navigate('IncidentReport');
    });

    return () => {
      unsubNetInfo();
      if (notificationResponseListener.current) {
        Notifications.removeNotificationSubscription(notificationResponseListener.current);
      }
    };
  }, []);

  // Connecter Socket.IO + démarrer GPS background au login
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      socketService.connect(user.id, user.role, currentEventId);

      // Stocker le token pour la tâche background
      const storeToken = async () => {
        const token = await AsyncStorage.getItem('accessToken')
          || await AsyncStorage.getItem('checkInToken');
        if (token) {
          // Synchroniser les positions offline
          await syncPendingPositions(token);
        }
      };
      storeToken();

      // Démarrer le tracking GPS background seulement pour agents/responsables (pas admin)
      if (user?.role !== 'admin') {
        startBackgroundTracking(user.id, currentEventId);
      } else {
        stopBackgroundTracking(); // s'assurer qu'il est arrêté pour admin
      }

    } else {
      socketService.disconnect();
      stopBackgroundTracking();
    }
  }, [isAuthenticated, user?.id, user?.role, currentEventId]);

  // Synchroniser les positions offline quand l'app revient au premier plan
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active' && isAuthenticated) {
        const token = await AsyncStorage.getItem('accessToken')
          || await AsyncStorage.getItem('checkInToken');
        if (token) syncPendingPositions(token);
      }
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e3a8a' }}>
        <View style={{
          width: 100, height: 100, borderRadius: 50,
          backgroundColor: 'rgba(255,255,255,0.12)',
          justifyContent: 'center', alignItems: 'center', marginBottom: 20,
        }}>
          <View style={{
            width: 82, height: 82, borderRadius: 41,
            backgroundColor: '#2563eb',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Ionicons name="shield-checkmark" size={44} color="#fff" />
          </View>
        </View>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 6, letterSpacing: 0.5 }}>
          Security Guard
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 28 }}>
          Système de gestion sécurité
        </Text>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" />
      {isAuthenticated && <TrackingStatusBanner />}
      {isOffline && (
        <View style={{ backgroundColor: '#ef4444', paddingVertical: 6, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
            📡 Hors ligne — Vérifiez votre connexion
          </Text>
        </View>
      )}
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          /* ── Non authentifié : seulement Login ── */
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : isCheckInMode ? (
          /* ── Mode pointage CIN : CheckIn en premier ── */
          <>
            <Stack.Screen name="CheckIn" component={CheckInScreen} options={{ headerShown: true, headerTitle: 'Pointage', headerStyle: { backgroundColor: '#10b981' }, headerTintColor: '#fff', headerBackVisible: false, gestureEnabled: false }} />
            <Stack.Screen name="CheckOut" component={CheckOutScreen} options={{ headerShown: true, headerTitle: 'Pointage Départ', headerStyle: { backgroundColor: '#f59e0b' }, headerTintColor: '#fff', gestureEnabled: false }} />
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="IncidentReport" component={IncidentReportScreen} options={{ headerShown: true, headerTitle: "Rapport d'incident", headerStyle: { backgroundColor: '#ef4444' }, headerTintColor: '#fff' }} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ headerShown: true, headerTitle: 'Détail événement', headerStyle: { backgroundColor: '#2563eb' }, headerTintColor: '#fff' }} />
          </>
        ) : (
          /* ── Authentifié normal : Main (tabs) en premier ── */
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="CheckIn" component={CheckInScreen} options={{ headerShown: true, headerTitle: 'Pointage', headerStyle: { backgroundColor: '#10b981' }, headerTintColor: '#fff' }} />
            <Stack.Screen name="CheckOut" component={CheckOutScreen} options={{ headerShown: true, headerTitle: 'Pointage Départ', headerStyle: { backgroundColor: '#f59e0b' }, headerTintColor: '#fff' }} />
            <Stack.Screen name="IncidentReport" component={IncidentReportScreen} options={{ headerShown: true, headerTitle: "Rapport d'incident", headerStyle: { backgroundColor: '#ef4444' }, headerTintColor: '#fff' }} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ headerShown: true, headerTitle: 'Détail événement', headerStyle: { backgroundColor: '#2563eb' }, headerTintColor: '#fff' }} />
            <Stack.Screen name="Paramètres" component={SettingsScreen} options={{ headerShown: true, headerTitle: 'Paramètres', headerStyle: { backgroundColor: '#374151' }, headerTintColor: '#fff' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true, headerTitle: 'Mon profil', headerStyle: { backgroundColor: '#2563eb' }, headerTintColor: '#fff' }} />
            <Stack.Screen name="HistoriqueStack" component={HistoryScreen} options={{ headerShown: true, headerTitle: 'Historique', headerStyle: { backgroundColor: '#2563eb' }, headerTintColor: '#fff' }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: true, headerTitle: 'Modifier le profil', headerStyle: { backgroundColor: '#2563eb' }, headerTintColor: '#fff' }} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ headerShown: true, headerTitle: 'Changer le mot de passe', headerStyle: { backgroundColor: '#7c3aed' }, headerTintColor: '#fff' }} />
            <Stack.Screen name="Documents" component={DocumentsScreen} options={{ headerShown: true, headerTitle: 'Mes documents', headerStyle: { backgroundColor: '#8b5cf6' }, headerTintColor: '#fff' }} />
            <Stack.Screen name="Badges" component={BadgesScreen} options={{ headerShown: true, headerTitle: 'Badges & Classement', headerStyle: { backgroundColor: '#78350f' }, headerTintColor: '#fff' }} />
            <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Help" component={HelpScreen} options={{ headerShown: true, headerTitle: 'Aide et support', headerStyle: { backgroundColor: '#0ea5e9' }, headerTintColor: '#fff' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </ErrorBoundary>
  );
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
