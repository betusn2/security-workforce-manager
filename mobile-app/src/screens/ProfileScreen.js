import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import useAuthStore from '../services/authStore';
import { reportsAPI } from '../services/api';

const ProfileScreen = ({ navigation }) => {
  const { user: authUser, logout: authLogout } = useAuthStore();
  const [user, setUser] = useState(authUser || null); // initialiser avec le store
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState(null);
  const [adminDashStats, setAdminDashStats] = useState(null);
  const [notifications, setNotifications] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(true);

  // Fetch user profile
  const fetchProfile = async () => {
    try {
      setLoading(true);
      // Utiliser d'abord l'utilisateur du store comme fallback rapide
      if (authUser) setUser(authUser);

      const isAdmin = authUser?.role === 'admin' || user?.role === 'admin';

      const [profileRes, statsRes, dashRes] = await Promise.all([
        api.get('/auth/me').catch(() => null),
        !isAdmin ? api.get('/attendance/my-stats').catch(() => null) : null,
        isAdmin ? reportsAPI.getDashboard().catch(() => null) : null,
      ]);

      if (profileRes?.data?.data?.user) setUser(profileRes.data.data.user);
      else if (profileRes?.data?.data) setUser(profileRes.data.data);
      if (statsRes?.data?.data) setStats(statsRes.data.data);
      if (dashRes?.data?.data) {
        const d = dashRes.data.data;
        setAdminDashStats({
          totalAgents: d.overview?.totalAgents ?? d.totalAgents ?? d.agents ?? 0,
          totalEvents: d.overview?.totalEvents ?? d.totalEvents ?? d.events ?? 0,
          activeEvents: d.overview?.activeEvents ?? d.activeEvents ?? d.ongoingEvents ?? 0,
          todayPresences: d.overview?.todayAttendances ??
            (d.todayAttendance && typeof d.todayAttendance === 'object'
              ? (d.todayAttendance.present ?? 0) + (d.todayAttendance.late ?? 0)
              : d.todayAttendance ?? 0),
          pendingAssignments: d.overview?.pendingAssignments ?? d.pendingAssignments ?? 0,
        });
      }

      // Load preferences
      const prefs = await AsyncStorage.getItem('userPreferences');
      if (prefs) {
        const parsed = JSON.parse(prefs);
        setNotifications(parsed.notifications ?? true);
        setBiometricEnabled(parsed.biometric ?? false);
        setLocationEnabled(parsed.location ?? true);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Update avatar
  const updateAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission requise', 'Acces a la galerie necessaire');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled) {
        setUploading(true);
        const imageData = `data:image/jpeg;base64,${result.assets[0].base64}`;

        await api.patch('/auth/update-avatar', { avatar: imageData });
        setUser(prev => ({ ...prev, avatar: result.assets[0].uri }));
        Alert.alert('Succes', 'Photo de profil mise a jour');
      }
    } catch (error) {
      console.error('Error updating avatar:', error);
      Alert.alert('Erreur', 'Impossible de mettre a jour la photo');
    } finally {
      setUploading(false);
    }
  };

  // Save preferences
  const savePreferences = async (key, value) => {
    try {
      const prefs = await AsyncStorage.getItem('userPreferences');
      const parsed = prefs ? JSON.parse(prefs) : {};
      parsed[key] = value;
      await AsyncStorage.setItem('userPreferences', JSON.stringify(parsed));
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  // Toggle notification
  const toggleNotifications = async (value) => {
    setNotifications(value);
    await savePreferences('notifications', value);
  };

  // Toggle biometric
  const toggleBiometric = async (value) => {
    setBiometricEnabled(value);
    await savePreferences('biometric', value);
  };

  // Toggle location
  const toggleLocation = async (value) => {
    setLocationEnabled(value);
    await savePreferences('location', value);
  };

  // Logout — utilise useAuthStore qui vide SecureStore + remet isAuthenticated:false
  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: () => authLogout(),
        }
      ]
    );
  };

  // Get role label
  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin':
        return 'Administrateur';
      case 'supervisor':
        return 'Superviseur';
      case 'agent':
        return 'Agent de securite';
      default:
        return role;
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#10b981';
      case 'inactive':
        return '#6b7280';
      case 'suspended':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  // N'afficher le loading que si on n'a aucune donnée du tout
  const displayUser = user || authUser;
  if (loading && !displayUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }
  if (!displayUser) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: '#6b7280' }}>Impossible de charger le profil</Text>
      </View>
    );
  }

  const roleColors = { admin: '#dc2626', supervisor: '#d97706', agent: '#2563eb', guard: '#059669' };
  const headerColor = roleColors[displayUser?.role] || '#2563eb';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header with profile photo */}
      <View style={styles.header}>
        <View style={[styles.headerBg, { backgroundColor: headerColor }]} />
        <View style={styles.profileSection}>
          <TouchableOpacity style={styles.avatarContainer} onPress={updateAvatar}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Text>
              </View>
            )}
            {uploading ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <View style={styles.editAvatarButton}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.userName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.userRole}>{getRoleLabel(user?.role)}</Text>

          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(user?.status) }]} />
            <Text style={styles.statusText}>
              {user?.status === 'active' ? 'Actif' : 'Inactif'}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats Cards — différentes selon le rôle */}
      {(displayUser?.role === 'admin' || displayUser?.role === 'supervisor') && adminDashStats ? (
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="people" size={24} color="#2563eb" />
              <Text style={styles.statValue}>{adminDashStats.totalAgents}</Text>
              <Text style={styles.statLabel}>Agents</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#f3e8ff' }]}>
              <Ionicons name="calendar" size={24} color="#8b5cf6" />
              <Text style={styles.statValue}>{adminDashStats.totalEvents}</Text>
              <Text style={styles.statLabel}>Événements</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              <Text style={styles.statValue}>{adminDashStats.todayPresences}</Text>
              <Text style={styles.statLabel}>Présences</Text>
            </View>
          </View>
          <View style={[styles.statsRow, { marginTop: 8 }]}>
            <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="flash" size={24} color="#f59e0b" />
              <Text style={styles.statValue}>{adminDashStats.activeEvents}</Text>
              <Text style={styles.statLabel}>En cours</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="briefcase" size={24} color="#ef4444" />
              <Text style={styles.statValue}>{adminDashStats.pendingAssignments}</Text>
              <Text style={styles.statLabel}>En attente</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#f1f5f9' }]}>
              <Ionicons name="shield-checkmark" size={24} color="#64748b" />
              <Text style={styles.statValue}>{getRoleLabel(displayUser?.role)}</Text>
              <Text style={styles.statLabel}>Rôle</Text>
            </View>
          </View>
        </View>
      ) : stats ? (
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              <Text style={styles.statValue}>{stats.presentCount || 0}</Text>
              <Text style={styles.statLabel}>Présences</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="time" size={24} color="#2563eb" />
              <Text style={styles.statValue}>{stats.totalHours?.toFixed(0) || 0}h</Text>
              <Text style={styles.statLabel}>Heures</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="star" size={24} color="#f59e0b" />
              <Text style={styles.statValue}>{displayUser?.overallScore || stats.punctualityRate || 0}</Text>
              <Text style={styles.statLabel}>Score</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#6b7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color="#6b7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Telephone</Text>
              <Text style={styles.infoValue}>{user?.phone || 'Non renseigne'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="card-outline" size={20} color="#6b7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>ID Employe</Text>
              <Text style={styles.infoValue}>{user?.employeeId || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color="#6b7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Date d'embauche</Text>
              <Text style={styles.infoValue}>
                {user?.hireDate
                  ? new Date(user.hireDate).toLocaleDateString('fr-FR')
                  : 'Non renseigne'
                }
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parametres</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={22} color="#6b7280" />
              <Text style={styles.settingLabel}>Notifications</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={toggleNotifications}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={notifications ? '#2563eb' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="finger-print-outline" size={22} color="#6b7280" />
              <Text style={styles.settingLabel}>Biometrique</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={biometricEnabled ? '#2563eb' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="location-outline" size={22} color="#6b7280" />
              <Text style={styles.settingLabel}>Localisation</Text>
            </View>
            <Switch
              value={locationEnabled}
              onValueChange={toggleLocation}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={locationEnabled ? '#2563eb' : '#f4f3f4'}
            />
          </View>
        </View>
      </View>

      {/* Menu Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Menu</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="person-outline" size={20} color="#2563eb" />
              </View>
              <Text style={styles.menuLabel}>Modifier le profil</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('ChangePassword')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="lock-closed-outline" size={20} color="#f59e0b" />
              </View>
              <Text style={styles.menuLabel}>Changer le mot de passe</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
            // Agents ont l'onglet 'Historique', sinon aller au stack
            try { navigation.navigate('Historique'); }
            catch (_) { navigation.navigate('HistoriqueStack'); }
          }}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="time-outline" size={20} color="#10b981" />
              </View>
              <Text style={styles.menuLabel}>Historique des presences</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('Documents')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#f3e8ff' }]}>
                <Ionicons name="document-text-outline" size={20} color="#8b5cf6" />
              </View>
              <Text style={styles.menuLabel}>Mes documents</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('Paramètres')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#f1f5f9' }]}>
                <Ionicons name="settings-outline" size={20} color="#374151" />
              </View>
              <Text style={styles.menuLabel}>Paramètres</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('Help')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#e0f2fe' }]}>
                <Ionicons name="help-circle-outline" size={20} color="#0ea5e9" />
              </View>
              <Text style={styles.menuLabel}>Aide et support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout Button */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutText}>Se deconnecter</Text>
        </TouchableOpacity>
      </View>

      {/* App Version */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Security Guard Management v1.0.0</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  header: {
    position: 'relative',
    paddingBottom: 20,
  },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    backgroundColor: '#2563eb',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 60,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  userRole: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  statsContainer: {
    paddingHorizontal: 16,
    marginTop: -10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 10,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  infoValue: {
    fontSize: 15,
    color: '#1f2937',
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 15,
    color: '#1f2937',
    marginLeft: 12,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    fontSize: 15,
    color: '#1f2937',
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  logoutText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
    marginLeft: 8,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingBottom: 100,
  },
  versionText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});

export default ProfileScreen;
