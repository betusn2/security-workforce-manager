import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, ScrollView, Alert, Modal, Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usersAPI } from '../services/api';
import useAuthStore from '../services/authStore';

const ROLE_LABELS = { admin: 'Admin', supervisor: 'Responsable', agent: 'Agent', guard: 'Garde' };
const ROLE_COLORS = { admin: '#dc2626', supervisor: '#7c3aed', agent: '#2563eb', guard: '#059669' };
const STATUS_LABELS = { active: 'Actif', inactive: 'Inactif', suspended: 'Suspendu' };

export default function UsersScreen({ navigation }) {
  const { user } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('Tous');
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', cin: '', role: 'agent', phone: '', password: '' });
  const [creating, setCreating] = useState(false);

  const isAdmin = user?.role === 'admin';

  const fetchUsers = useCallback(async () => {
    try {
      setError(null);
      const res = await usersAPI.getAll({ limit: 200 });
      const raw = res?.data?.data;
      const list = Array.isArray(raw) ? raw : (raw?.users || []);
      setUsers(list);
    } catch (err) {
      setError('Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  const onRefresh = () => { setRefreshing(true); fetchUsers(); };

  const handleCreate = async () => {
    if (!form.firstName || !form.lastName || !form.role) {
      Alert.alert('Erreur', 'Prénom, nom et rôle sont requis');
      return;
    }
    if (!form.email && !form.cin) {
      Alert.alert('Erreur', 'Email ou CIN requis');
      return;
    }
    setCreating(true);
    try {
      const payload = { ...form };
      if (!payload.password) payload.password = 'Temp1234!';
      await usersAPI.create(payload);
      setShowCreateModal(false);
      setForm({ firstName: '', lastName: '', email: '', cin: '', role: 'agent', phone: '', password: '' });
      Alert.alert('Succès', 'Utilisateur créé avec succès');
      fetchUsers();
    } catch (e) {
      const msg = e?.response?.data?.message || 'Impossible de créer l\'utilisateur';
      Alert.alert('Erreur', msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (u) => {
    Alert.alert(
      'Supprimer',
      `Supprimer ${u.firstName} ${u.lastName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive', onPress: async () => {
            try {
              await usersAPI.delete(u.id);
              fetchUsers();
            } catch (e) {
              Alert.alert('Erreur', 'Impossible de supprimer');
            }
          }
        }
      ]
    );
  };

  const ROLES = ['Tous', 'admin', 'supervisor', 'agent'];
  const filtered = users.filter(u => {
    const matchSearch = !search ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.cin?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'Tous' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const renderUser = ({ item }) => {
    const roleColor = ROLE_COLORS[item.role] || '#6b7280';
    const isActive = item.status !== 'inactive' && item.status !== 'suspended';
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={[styles.avatar, { backgroundColor: roleColor + '20' }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>
              {(item.firstName?.[0] || '') + (item.lastName?.[0] || '')}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.userName}>{item.firstName} {item.lastName}</Text>
            <Text style={styles.userSub}>{item.email || item.cin || '—'}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.roleBadge, { backgroundColor: roleColor + '20', borderColor: roleColor }]}>
                <Text style={[styles.roleBadgeText, { color: roleColor }]}>{ROLE_LABELS[item.role] || item.role}</Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: isActive ? '#10b981' : '#9ca3af' }]} />
              <Text style={{ fontSize: 11, color: isActive ? '#10b981' : '#9ca3af' }}>
                {STATUS_LABELS[item.status] || (isActive ? 'Actif' : 'Inactif')}
              </Text>
            </View>
          </View>
          {isAdmin && item.id !== user?.id && (
            <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
        {item.cin && <Text style={styles.cinText}>CIN: {item.cin}</Text>}
        {item.phone && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={13} color="#9ca3af" />
            <Text style={styles.infoText}>{item.phone}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Utilisateurs</Text>
            <Text style={styles.headerSub}>{filtered.length} utilisateur{filtered.length !== 1 ? 's' : ''}</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
              <Ionicons name="person-add" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color="#9ca3af" /></TouchableOpacity> : null}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {ROLES.map(r => (
          <TouchableOpacity key={r} style={[styles.filterChip, roleFilter === r && styles.filterChipActive]} onPress={() => setRoleFilter(r)}>
            <Text style={[styles.filterChipText, roleFilter === r && styles.filterChipTextActive]}>
              {r === 'Tous' ? 'Tous' : ROLE_LABELS[r]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchUsers}><Text style={styles.retryBtnText}>Réessayer</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderUser}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={<View style={styles.center}><Ionicons name="people-outline" size={64} color="#d1d5db" /><Text style={styles.emptyText}>Aucun utilisateur</Text></View>}
        />
      )}

      {/* Create User Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvel utilisateur</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: 'Prénom *', key: 'firstName', placeholder: 'Prénom' },
                { label: 'Nom *', key: 'lastName', placeholder: 'Nom' },
                { label: 'Email', key: 'email', placeholder: 'email@example.com', kbType: 'email-address' },
                { label: 'CIN', key: 'cin', placeholder: 'Ex: AB123456' },
                { label: 'Téléphone', key: 'phone', placeholder: '0600000000', kbType: 'phone-pad' },
                { label: 'Mot de passe', key: 'password', placeholder: 'Laissez vide → Temp1234!', secure: true },
              ].map(f => (
                <View key={f.key} style={styles.formGroup}>
                  <Text style={styles.formLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={f.placeholder}
                    placeholderTextColor="#9ca3af"
                    value={form[f.key]}
                    onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                    keyboardType={f.kbType || 'default'}
                    secureTextEntry={f.secure}
                    autoCapitalize="none"
                  />
                </View>
              ))}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Rôle *</Text>
                <View style={styles.roleRow}>
                  {['agent', 'supervisor', 'admin'].map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleOpt, form.role === r && { backgroundColor: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] }]}
                      onPress={() => setForm(prev => ({ ...prev, role: r }))}
                    >
                      <Text style={[styles.roleOptText, form.role === r && { color: '#fff' }]}>{ROLE_LABELS[r]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Créer l'utilisateur</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#dc2626', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, padding: 10 },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0', height: 34, justifyContent: 'center' },
  filterChipActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  filterChipText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  cardInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  userSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  deleteBtn: { padding: 6 },
  cinText: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  infoText: { fontSize: 12, color: '#9ca3af' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingTop: 60 },
  errorText: { fontSize: 15, color: '#ef4444', textAlign: 'center' },
  emptyText: { fontSize: 15, color: '#9ca3af', textAlign: 'center' },
  retryBtn: { backgroundColor: '#dc2626', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  formGroup: { marginBottom: 14 },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  formInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827' },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleOpt: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', backgroundColor: '#f8fafc' },
  roleOptText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  createBtn: { backgroundColor: '#dc2626', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
