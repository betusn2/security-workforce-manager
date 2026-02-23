import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../services/authStore';

const SettingRow = ({ icon, label, value, onPress, rightComponent, color = '#2563eb', danger }) => (
  <TouchableOpacity style={styles.settingRow} onPress={onPress} disabled={!onPress && !rightComponent} activeOpacity={0.7}>
    <View style={[styles.settingIcon, { backgroundColor: (danger ? '#ef4444' : color) + '15' }]}>
      <Ionicons name={icon} size={20} color={danger ? '#ef4444' : color} />
    </View>
    <Text style={[styles.settingLabel, danger && { color: '#ef4444' }]}>{label}</Text>
    {rightComponent || (
      value !== undefined
        ? <Text style={styles.settingValue}>{value}</Text>
        : <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
    )}
  </TouchableOpacity>
);

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuthStore();
  const [notifSound, setNotifSound] = useState(true);
  const [notifVibrate, setNotifVibrate] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            await logout();
          }
        }
      ]
    );
  };

  const ROLE_LABELS = { admin: 'Administrateur', supervisor: 'Responsable', agent: 'Agent' };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Paramètres</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Profile section */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
            </Text>
          </View>
          <View>
            <Text style={styles.profileName}>{user?.firstName} {user?.lastName}</Text>
            <Text style={styles.profileRole}>{ROLE_LABELS[user?.role] || user?.role}</Text>
            <Text style={styles.profileEmail}>{user?.email || user?.cin || ''}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Compte</Text>
        <View style={styles.section}>
          <SettingRow
            icon="person-outline"
            label="Mon profil"
            color="#3b82f6"
            onPress={() => navigation.navigate('Profil')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="key-outline"
            label="Changer le mot de passe"
            color="#7c3aed"
            onPress={() => Alert.alert('Info', 'Contactez votre administrateur pour changer le mot de passe')}
          />
        </View>

        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.section}>
          <SettingRow
            icon="volume-high-outline"
            label="Son des notifications"
            color="#f59e0b"
            rightComponent={<Switch value={notifSound} onValueChange={setNotifSound} trackColor={{ true: '#2563eb' }} />}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="phone-portrait-outline"
            label="Vibration"
            color="#10b981"
            rightComponent={<Switch value={notifVibrate} onValueChange={setNotifVibrate} trackColor={{ true: '#2563eb' }} />}
          />
        </View>

        <Text style={styles.sectionTitle}>Application</Text>
        <View style={styles.section}>
          <SettingRow
            icon="information-circle-outline"
            label="Version"
            value="1.0.0"
            color="#6b7280"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="server-outline"
            label="Serveur"
            value="Render"
            color="#6b7280"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="help-circle-outline"
            label="Aide & Support"
            color="#2563eb"
            onPress={() => Alert.alert('Support', 'Contactez votre administrateur système')}
          />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#374151', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  profileAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#2563eb20', justifyContent: 'center', alignItems: 'center' },
  profileAvatarText: { fontSize: 22, fontWeight: '800', color: '#2563eb' },
  profileName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  profileRole: { fontSize: 13, color: '#7c3aed', fontWeight: '600', marginTop: 2 },
  profileEmail: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  section: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  settingIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  settingLabel: { flex: 1, fontSize: 15, color: '#374151', fontWeight: '600' },
  settingValue: { fontSize: 14, color: '#9ca3af' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginLeft: 64 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#fee2e2', marginTop: 8 },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#ef4444' },
});
