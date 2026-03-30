import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, ScrollView, Alert, Modal, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { assignmentsAPI, eventsAPI, usersAPI } from '../services/api';
import useAuthStore from '../services/authStore';
import socketService from '../services/socketService';

const STATUS_LABELS = { pending: 'En attente', confirmed: 'Confirmé', refused: 'Refusé', notified: 'Notifié' };
const STATUS_COLORS = { pending: '#f59e0b', confirmed: '#10b981', refused: '#ef4444', notified: '#3b82f6' };
const ROLE_LABELS = { agent: 'Agent', supervisor: 'Responsable', guard: 'Garde' };

export default function AssignmentsScreen({ navigation }) {
  const { user } = useAuthStore();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('Tous');
  const [error, setError] = useState(null);
  const [responding, setResponding] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [agents, setAgents] = useState([]);
  const [events, setEvents] = useState([]);
  const [createForm, setCreateForm] = useState({ agentId: '', eventId: '', role: 'agent', notes: '' });

  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const canCreate = isAdmin || isSupervisor;

  const fetchAssignments = useCallback(async () => {
    try {
      setError(null);
      let res;
      if (isAdmin || isSupervisor) {
        res = await assignmentsAPI.getAll({ limit: 100 });
      } else {
        res = await assignmentsAPI.getMyAssignments({ limit: 100 });
      }
      const raw = res?.data?.data;
      const list = Array.isArray(raw) ? raw : (raw?.assignments || raw?.data || []);
      setAssignments(list);
    } catch (err) {
      setError('Impossible de charger les affectations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, isSupervisor]);

  useEffect(() => {
    fetchAssignments();

    // Charger agents et événements pour le formulaire de création
    if (canCreate) {
      usersAPI.getAgents({ limit: 100 }).then(res => {
        const raw = res?.data?.data;
        setAgents(Array.isArray(raw) ? raw : (raw?.users || raw?.agents || []));
      }).catch(() => {});
      eventsAPI.getAll({ status: 'active', limit: 50 }).then(res => {
        const raw = res?.data?.data;
        setEvents(Array.isArray(raw) ? raw : (raw?.events || []));
      }).catch(() => {});
    }

    // Mises à jour temps réel
    const handleNew = () => fetchAssignments();
    const handleUpdated = () => fetchAssignments();
    socketService.on('assignment_new', handleNew);
    socketService.on('assignment_updated', handleUpdated);
    return () => {
      socketService.off('assignment_new', handleNew);
      socketService.off('assignment_updated', handleUpdated);
    };
  }, [fetchAssignments, canCreate]);

  const onRefresh = () => { setRefreshing(true); fetchAssignments(); };

  const handleRespond = async (id, response) => {
    const label = response === 'confirmed' ? 'confirmer' : 'refuser';
    Alert.alert(
      'Confirmation',
      `Voulez-vous ${label} cette affectation ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: response === 'confirmed' ? 'Confirmer' : 'Refuser',
          style: response === 'confirmed' ? 'default' : 'destructive',
          onPress: async () => {
            setResponding(id);
            try {
              await assignmentsAPI.respond(id, response);
              await fetchAssignments();
            } catch (e) {
              Alert.alert('Erreur', 'Impossible de répondre à cette affectation');
            } finally {
              setResponding(null);
            }
          }
        }
      ]
    );
  };

  const handleCreate = async () => {
    if (!createForm.agentId || !createForm.eventId) {
      Alert.alert('Erreur', 'Veuillez sélectionner un agent et un événement');
      return;
    }
    setCreating(true);
    try {
      await assignmentsAPI.create(createForm);
      setShowCreateModal(false);
      setCreateForm({ agentId: '', eventId: '', role: 'agent', notes: '' });
      Alert.alert('Succès', 'Affectation créée avec succès');
      fetchAssignments();
    } catch (e) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Impossible de créer l\'affectation');
    } finally {
      setCreating(false);
    }
  };

  const FILTERS = ['Tous', 'pending', 'confirmed', 'refused'];

  const filtered = assignments.filter(a => filter === 'Tous' || a.status === filter);

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d.split('T')[0]).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderItem = ({ item }) => {
    const statusColor = STATUS_COLORS[item.status] || '#9ca3af';
    const isPending = item.status === 'pending';
    const canRespond = !isAdmin && !isSupervisor && isPending;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABELS[item.status] || item.status}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: '#eff6ff' }]}>
            <Text style={styles.roleText}>{ROLE_LABELS[item.role] || item.role}</Text>
          </View>
        </View>

        {/* Event name */}
        {item.event?.name || item.eventName ? (
          <Text style={styles.eventName}>{item.event?.name || item.eventName}</Text>
        ) : <Text style={styles.eventName}>Affectation #{item.id}</Text>}

        {/* Agent info (admin/supervisor view) */}
        {(isAdmin || isSupervisor) && (item.user?.name || item.user?.firstName) && (
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={14} color="#6b7280" />
            <Text style={styles.infoText}>{item.user?.firstName} {item.user?.lastName || ''}</Text>
          </View>
        )}

        {item.event?.startDate && (
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={14} color="#6b7280" />
            <Text style={styles.infoText}>{formatDate(item.event?.startDate)}</Text>
          </View>
        )}
        {item.event?.location && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color="#6b7280" />
            <Text style={styles.infoText} numberOfLines={1}>{item.event?.location}</Text>
          </View>
        )}
        {item.zone?.name && (
          <View style={styles.infoRow}>
            <Ionicons name="map-outline" size={14} color="#6b7280" />
            <Text style={styles.infoText}>{item.zone.name}</Text>
          </View>
        )}
        {item.notes ? (
          <View style={styles.infoRow}>
            <Ionicons name="chatbubble-outline" size={14} color="#6b7280" />
            <Text style={styles.infoText} numberOfLines={2}>{item.notes}</Text>
          </View>
        ) : null}

        {canRespond && (
          <View style={styles.actionRow}>
            {responding === item.id ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.confirmBtn]}
                  onPress={() => handleRespond(item.id, 'confirmed')}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Confirmer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.refuseBtn]}
                  onPress={() => handleRespond(item.id, 'refused')}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Refuser</Text>
                </TouchableOpacity>
              </>
            )}
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
            <Text style={styles.headerTitle}>Affectations</Text>
            <Text style={styles.headerSub}>{filtered.length} affectation{filtered.length !== 1 ? 's' : ''}</Text>
          </View>
          {canCreate && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} style={[styles.filterChip, filter === f && styles.filterChipActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'Tous' ? 'Tous' : (STATUS_LABELS[f] || f)}
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
          <TouchableOpacity style={styles.retryBtn} onPress={fetchAssignments}><Text style={styles.retryBtnText}>Réessayer</Text></TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="briefcase-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyText}>Aucune affectation</Text>
          {canCreate && (
            <TouchableOpacity style={styles.retryBtn} onPress={() => setShowCreateModal(true)}>
              <Text style={styles.retryBtnText}>Créer une affectation</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        />
      )}

      {/* Modal création affectation */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvelle affectation</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {/* Sélection agent */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Agent *</Text>
                <ScrollView style={{ maxHeight: 150, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10 }}>
                  {agents.length === 0 ? (
                    <Text style={{ padding: 12, color: '#9ca3af' }}>Aucun agent disponible</Text>
                  ) : agents.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.selectRow, createForm.agentId === String(a.id) && styles.selectRowActive]}
                      onPress={() => setCreateForm(p => ({ ...p, agentId: String(a.id) }))}
                    >
                      <Text style={[styles.selectText, createForm.agentId === String(a.id) && styles.selectTextActive]}>
                        {a.firstName} {a.lastName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Sélection événement */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Événement *</Text>
                <ScrollView style={{ maxHeight: 150, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10 }}>
                  {events.length === 0 ? (
                    <Text style={{ padding: 12, color: '#9ca3af' }}>Aucun événement actif</Text>
                  ) : events.map(e => (
                    <TouchableOpacity
                      key={e.id}
                      style={[styles.selectRow, createForm.eventId === String(e.id) && styles.selectRowActive]}
                      onPress={() => setCreateForm(p => ({ ...p, eventId: String(e.id) }))}
                    >
                      <Text style={[styles.selectText, createForm.eventId === String(e.id) && styles.selectTextActive]}>
                        {e.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notes (optionnel)</Text>
                <TextInput
                  style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                  value={createForm.notes}
                  onChangeText={v => setCreateForm(p => ({ ...p, notes: v }))}
                  placeholder="Instructions, remarques..."
                  placeholderTextColor="#9ca3af"
                  multiline
                />
              </View>

              <TouchableOpacity
                style={[styles.createBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.createBtnText}>Créer l'affectation</Text>
                )}
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
  header: { backgroundColor: '#7c3aed', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, padding: 10 },
  filterRow: { maxHeight: 52, marginTop: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0', height: 34, justifyContent: 'center' },
  filterChipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  filterChipText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  cardTop: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '700' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  roleText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  eventName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoText: { fontSize: 13, color: '#6b7280', flex: 1 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  confirmBtn: { backgroundColor: '#10b981' },
  refuseBtn: { backgroundColor: '#ef4444' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  errorText: { fontSize: 15, color: '#ef4444', textAlign: 'center' },
  emptyText: { fontSize: 15, color: '#9ca3af', textAlign: 'center' },
  retryBtn: { backgroundColor: '#7c3aed', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  formInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827' },
  selectRow: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  selectRowActive: { backgroundColor: '#ede9fe' },
  selectText: { fontSize: 14, color: '#374151' },
  selectTextActive: { color: '#7c3aed', fontWeight: '700' },
  createBtn: { backgroundColor: '#7c3aed', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});