import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import useAuthStore from '../services/authStore';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import CheckInScreen from '../screens/CheckInScreen';
import CheckOutScreen from '../screens/CheckOutScreen';
import HistoryScreen from '../screens/HistoryScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import IncidentReportScreen from '../screens/IncidentReportScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import EventsScreen from '../screens/EventsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import UsersScreen from '../screens/UsersScreen';
import AssignmentsScreen from '../screens/AssignmentsScreen';
import ChatScreen from '../screens/ChatScreen';

// Placeholder screen for features not yet implemented
const ComingSoonScreen = ({ navigation, route }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6', padding: 32 }}>
    <Ionicons name="construct-outline" size={64} color="#d1d5db" />
    <Text style={{ fontSize: 20, fontWeight: '700', color: '#374151', marginTop: 16 }}>
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Badge component for notifications
const NotificationBadge = ({ count }) => {
  if (!count || count <= 0) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
};

// Main Tab Navigator
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'History':
              iconName = focused ? 'time' : 'time-outline';
              break;
            case 'Notifications':
              iconName = focused ? 'notifications' : 'notifications-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-circle-outline';
          }

          return (
            <View style={styles.tabIconContainer}>
              <Ionicons name={iconName} size={size} color={color} />
              {route.name === 'Notifications' && (
                <NotificationBadge count={0} />
              )}
            </View>
          );
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Accueil' }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarLabel: 'Historique' }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarLabel: 'Notifs' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profil' }}
      />
    </Tab.Navigator>
  );
};

// Auth Stack
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
  </Stack.Navigator>
);

// App Stack (authenticated)
const AppStack = () => {
  const { isCheckInMode } = useAuthStore();
  return (
  <Stack.Navigator
    initialRouteName={isCheckInMode ? 'CheckIn' : 'MainTabs'}
    screenOptions={{
      headerStyle: {
        backgroundColor: '#ffffff',
      },
      headerTintColor: '#1f2937',
      headerTitleStyle: {
        fontWeight: '600',
      },
      headerShadowVisible: false,
    }}
  >
    <Stack.Screen
      name="MainTabs"
      component={MainTabNavigator}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="CheckIn"
      component={CheckInScreen}
      options={{
        title: 'Pointage Arrivee',
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="CheckOut"
      component={CheckOutScreen}
      options={{
        title: 'Pointage Depart',
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="IncidentReport"
      component={IncidentReportScreen}
      options={{
        title: 'Signaler un Incident',
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="EventDetail"
      component={EventDetailScreen}
      options={{
        title: 'Details Evenement',
        headerBackTitleVisible: false,
      }}
    />
    {/* Stub screens for features coming soon */}
    <Stack.Screen name="EditProfile"    component={ComingSoonScreen} options={{ title: 'Modifier le profil' }} />
    <Stack.Screen name="ChangePassword" component={ComingSoonScreen} options={{ title: 'Changer le mot de passe' }} />
    <Stack.Screen name="Documents"      component={ComingSoonScreen} options={{ title: 'Documents' }} />
    <Stack.Screen name="Paramètres"     component={SettingsScreen}  options={{ title: 'Paramètres', headerShown: false }} />
    <Stack.Screen name="Help"           component={ComingSoonScreen} options={{ title: 'Aide' }} />
    <Stack.Screen name="IncidentDetail" component={ComingSoonScreen} options={{ title: 'Détail incident' }} />
    <Stack.Screen name="Profil"         component={ProfileScreen}   options={{ headerShown: false }} />
    {/* Écrans admin */}
    <Stack.Screen name="AdminEvents"      component={EventsScreen}      options={{ title: 'Gestion Événements', headerBackTitleVisible: false }} />
    <Stack.Screen name="AdminReports"     component={ReportsScreen}     options={{ title: 'Rapports & Stats',    headerBackTitleVisible: false }} />
    <Stack.Screen name="AdminUsers"       component={UsersScreen}       options={{ title: 'Gestion Agents',     headerBackTitleVisible: false }} />
    <Stack.Screen name="MyAssignments"    component={AssignmentsScreen} options={{ title: 'Mes Affectations',    headerBackTitleVisible: false }} />
    <Stack.Screen name="Chat"             component={ChatScreen}        options={{ headerShown: false }} />
  </Stack.Navigator>
  );
};

// Main App Navigator
const AppNavigator = ({ isAuthenticated }) => {
  return (
    <NavigationContainer>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabIconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default AppNavigator;
