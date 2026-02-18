import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/native-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, Text, StyleSheet, TouchableOpacity } from 'react-native';

import useAuthStore from './src/services/authStore';import socketService from './src/services/socketService';
import useTracking from './src/services/useTracking';import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

// Profile Screen Placeholder
const ProfileScreen = ({ navigation }) => {
  const { user, logout, isCheckInMode, logoutCheckIn } = useAuthStore();

  const handleLogout = async () => {
    if (isCheckInMode) {
      await logoutCheckIn();
    } else {
      await logout();
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="person-circle-outline" size={100} color="#2563eb" />
        <Text style={styles.profileName}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={styles.profileRole}>
          {user?.role === 'agent' ? 'Agent de sécurité' : user?.role === 'supervisor' ? 'Responsable' : 'Administrateur'}
        </Text>
        {isCheckInMode && (
          <View style={styles.checkInBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.checkInBadgeText}>Mode Pointage</Text>
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#fff" />
        <Text style={styles.logoutButtonText}>
          {isCheckInMode ? 'Quitter le pointage' : 'Déconnexion'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// History Screen Placeholder
const HistoryScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' }}>
    <Ionicons name="time-outline" size={80} color="#2563eb" />
    <Text style={{ color: '#6b7280', marginTop: 16 }}>Historique des pointages</Text>
  </View>
);

// Notifications Screen Placeholder
const NotificationsScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' }}>
    <Ionicons name="notifications-outline" size={80} color="#2563eb" />
    <Text style={{ color: '#6b7280', marginTop: 16 }}>Notifications</Text>
  </View>
);

// Check In Screen Placeholder
const CheckInScreen = ({ navigation }) => {
  const { user, logoutCheckIn } = useAuthStore();

  const handleSkip = async () => {
    await logoutCheckIn();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <View style={styles.checkInContainer}>
      <View style={styles.checkInCard}>
        <View style={styles.checkInIcon}>
          <Ionicons name="camera-outline" size={60} color="#10b981" />
        </View>
        <Text style={styles.checkInTitle}>Pointage d'arrivée</Text>
        <Text style={styles.checkInUser}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={styles.checkInCIN}>CIN: {user?.cin}</Text>

        <TouchableOpacity style={styles.checkInButton}>
          <Ionicons name="scan" size={24} color="#fff" />
          <Text style={styles.checkInButtonText}>Scanner le visage</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Check Out Screen Placeholder
const CheckOutScreen = ({ route }) => {
  const { user, logoutCheckIn } = useAuthStore();

  const handleSkip = async () => {
    await logoutCheckIn();
    // Navigation will be handled automatically
  };

  return (
    <View style={styles.checkInContainer}>
      <View style={styles.checkInCard}>
        <View style={[styles.checkInIcon, { backgroundColor: '#fef3c7' }]}>
          <Ionicons name="log-out-outline" size={60} color="#f59e0b" />
        </View>
        <Text style={[styles.checkInTitle, { color: '#f59e0b' }]}>Pointage de départ</Text>
        <Text style={styles.checkInUser}>
          {user?.firstName} {user?.lastName}
        </Text>

        <TouchableOpacity style={[styles.checkInButton, { backgroundColor: '#f59e0b' }]}>
          <Ionicons name="scan" size={24} color="#fff" />
          <Text style={styles.checkInButtonText}>Scanner le visage</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

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

  // 🔌 Connexion Socket.IO + GPS tracking (actifs dès login)
  useTracking(currentEventId);

  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
      setIsLoading(false);
    };
    initAuth();
  }, []);

  // Connecter/déconnecter Socket.IO selon l'auth
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      socketService.connect(user.id, user.role, currentEventId);
    } else {
      socketService.disconnect();
    }
  }, [isAuthenticated, user?.id, currentEventId]);

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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const styles = StyleSheet.create({
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
  },
  profileRole: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  checkInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    gap: 6,
  },
  checkInBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    marginHorizontal: 24,
    marginBottom: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  checkInContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  checkInCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  checkInIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkInTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 16,
  },
  checkInUser: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  checkInCIN: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 32,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  checkInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
});
