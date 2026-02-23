/**
 * ⚠️ CET IMPORT DOIT ÊTRE EN PREMIER
 * expo-task-manager exige que la tâche soit définie avant tout autre code
 */
import './src/services/backgroundLocationTask';

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import useAuthStore from './src/services/authStore';
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

// ── Configuration des notifications ────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// ── Les composants écrans sont importés depuis src/screens ──────────────────

// Main Tab Navigator
const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Accueil') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Historique') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Notifications') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Profil') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
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
      })}
    >
      <Tab.Screen name="Accueil" component={HomeScreen} />
      <Tab.Screen name="Historique" component={HistoryScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// Main App Component
export default function App() {
  const { isAuthenticated, isCheckInMode, checkAuth, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');
  const [currentEventId, setCurrentEventId] = useState(null);

  // 🔌 Connexion Socket.IO + capture caméra sur demande
  useTracking(currentEventId);

  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
      setIsLoading(false);
    };
    initAuth();
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

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setInitialRoute('Login');
      } else if (isCheckInMode) {
        setInitialRoute('CheckIn');
      } else {
        setInitialRoute('Main');
      }
    }
  }, [isAuthenticated, isCheckInMode, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2563eb' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="CheckIn"
          component={CheckInScreen}
          options={{
            headerShown: true,
            headerTitle: 'Pointage Arrivée',
            headerStyle: { backgroundColor: '#10b981' },
            headerTintColor: '#fff',
          }}
        />
        <Stack.Screen
          name="CheckOut"
          component={CheckOutScreen}
          options={{
            headerShown: true,
            headerTitle: 'Pointage Départ',
            headerStyle: { backgroundColor: '#f59e0b' },
            headerTintColor: '#fff',
          }}
        />
        <Stack.Screen
          name="IncidentReport"
          component={IncidentReportScreen}
          options={{
            headerShown: true,
            headerTitle: 'Rapport d\'incident',
            headerStyle: { backgroundColor: '#ef4444' },
            headerTintColor: '#fff',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
