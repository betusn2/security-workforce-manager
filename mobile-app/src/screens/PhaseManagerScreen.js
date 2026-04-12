/**
 * PhaseManagerScreen.js
 * Écran de gestion des phases pour les responsables.
 * Accessible depuis EventDetailScreen pour les superviseurs/admins.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import useAuthStore from '../services/authStore';

// ─── Constants ────────────────────────────────────────────────────────────────
const PHASE_META = {
  preparation: {
    label: 'Phase 1 — Préparation',
    icon: 'build-outline',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#93c5fd',
    checklistLabels: [
      { key: 'phaseStarted',  label: 'Phase commencée' },
      { key: 'agentsPresent', label: 'Agents présents' },
      { key: 'zonesVerified', label: 'Zones vérifiées' },
      { key: 'phaseDone',     label: 'Phase terminée' },
    ],
  },
  setup: {
    label: 'Phase 2 — Mise en place',
    icon: 'cube-outline',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fcd34d',
    checklistLabels: [
      { key: 'phaseStarted',  label: 'Phase commencée' },
      { key: 'agentsPresent', label: 'Agents positionnés' },
      { key: 'zonesVerified', label: 'Zones affectées couvertes' },
      { key: 'phaseDone',     label: 'Phase terminée' },
    ],
  },
  execution: {
    label: 'Phase 3 — Pointage / Exécution',
    icon: 'location-outline',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#86efac',
    checklistLabels: [
      { key: 'phaseStarted',  label: 'Phase commencée' },
      { key: 'agentsPresent', label: 'Agents au poste' },
      { key: 'zonesVerified', label: 'Zones sécurisées' },
      { key: 'phaseDone',     label: 'Phase terminée' },
    ],
  },
};

const DEFAULT_CHECKLIST = { phaseStarted: false, agentsPresent: false, zonesVerified: false, phaseDone: false };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDateTime = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
};

const formatTime = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
};

// ─── Phase Confirm Card ───────────────────────────────────────────────────────
const PhaseCard = ({ phase, phaseData, onConfirm, submitting }) => {
  const meta = PHASE_META[phase];
  const [checklist, setChecklist] = useState(phaseData?.checklist || { ...DEFAULT_CHECKLIST });
  const confirmedAlready = phaseData?.confirmed;
  const allChecked = Object.values(checklist).every(Boolean);

  useEffect(() => {
    if (phaseData?.checklist) setChecklist(phaseData.checklist);
  }, [phaseData?.checklist]);

  const toggleItem = (key) => {
    if (confirmedAlready) return;
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirm = () => {
    if (!allChecked) {
      Alert.alert('Checklist incomplète', 'Cochez toutes les cases pour confirmer la phase.');
      return;
    }
    Alert.alert(
      'Confirmer la phase',
      `Êtes-vous sûr de confirmer "${meta.label}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => onConfirm(phase, checklist) },
      ]
    );
  };

  return (
    <View style={[styles.phaseCard, { borderColor: meta.border, backgroundColor: meta.bg }]}>
      {/* Header */}
      <View style={[styles.phaseHeader, { backgroundColor: meta.color }]}>
        <Ionicons name={meta.icon} size={20} color="#fff" />
        <Text style={styles.phaseTitle}>{meta.label}</Text>
        {confirmedAlready && (
          <View style={styles.confirmedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.confirmedBadgeText}>Confirmé</Text>
          </View>
        )}
      </View>

      <View style={styles.phaseBody}>
        {confirmedAlready ? (
          <View style={styles.confirmedBox}>
            <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
            <Text style={styles.confirmedText}>Phase confirmée le {formatDateTime(phaseData.confirmedAt)}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.checklistTitle}>Checklist de confirmation</Text>
            {meta.checklistLabels.map(item => (
              <TouchableOpacity
                key={item.key}
                onPress={() => toggleItem(item.key)}
                style={[styles.checkItem, checklist[item.key] && styles.checkItemChecked]}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, checklist[item.key] && { backgroundColor: '#16a34a', borderColor: '#16a34a' }]}>
                  {checklist[item.key] && <Ionicons name="checkmark" size={14} color="#fff" strokeWidth={3} />}
                </View>
                <Text style={[styles.checkLabel, checklist[item.key] && styles.checkLabelDone]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={handleConfirm}
              disabled={submitting || !allChecked}
              style={[styles.confirmBtn, { backgroundColor: allChecked ? meta.color : '#d1d5db' }]}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.confirmBtnText}>Confirmer {phase === 'preparation' ? 'Préparation' : phase === 'setup' ? 'Mise en place' : 'Exécution'}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

// ─── Zone Card (Phase 2) ──────────────────────────────────────────────────────
const ZonesCard = ({ zones, zonesConfirmed, onConfirmZones, submitting }) => {
  const [selected, setSelected] = useState(zonesConfirmed || []);

  useEffect(() => { setSelected(zonesConfirmed || []); }, [zonesConfirmed]);

  const toggleZone = (zoneId) => {
    setSelected(prev =>
      prev.includes(zoneId) ? prev.filter(id => id !== zoneId) : [...prev, zoneId]
    );
  };

  const handleConfirm = () => {
    if (selected.length === 0) {
      Alert.alert('Sélection vide', 'Sélectionnez au moins une zone.');
      return;
    }
    Alert.alert(
      'Confirmer zones',
      `Confirmer ${selected.length} zone(s) pour la mise en place ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => onConfirmZones(selected) },
      ]
    );
  };

  if (!zones || zones.length === 0) {
    return (
      <View style={[styles.phaseCard, { borderColor: '#fcd34d', backgroundColor: '#fffbeb' }]}>
        <View style={[styles.phaseHeader, { backgroundColor: '#d97706' }]}>
          <Ionicons name="map-outline" size={20} color="#fff" />
          <Text style={styles.phaseTitle}>Zones de mise en place</Text>
        </View>
        <View style={styles.emptyBox}>
          <Ionicons name="map-outline" size={32} color="#d1d5db" />
          <Text style={styles.emptyText}>Aucune zone définie pour cet événement</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.phaseCard, { borderColor: '#fcd34d', backgroundColor: '#fffbeb' }]}>
      <View style={[styles.phaseHeader, { backgroundColor: '#d97706' }]}>
        <Ionicons name="map-outline" size={20} color="#fff" />
        <Text style={styles.phaseTitle}>Zones de mise en place</Text>
        <View style={styles.confirmedBadge}>
          <Text style={styles.confirmedBadgeText}>{selected.length}/{zones.length}</Text>
        </View>
      </View>

      <View style={styles.phaseBody}>
        <Text style={styles.checklistTitle}>Responsable confirme zones</Text>
        {zones.map(zone => {
          const isSelected = selected.includes(zone.id);
          return (
            <TouchableOpacity
              key={zone.id}
              onPress={() => toggleZone(zone.id)}
              style={[styles.zoneItem, isSelected && styles.zoneItemSelected]}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, isSelected && { backgroundColor: '#d97706', borderColor: '#d97706' }]}>
                {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <View style={[styles.zoneDot, { backgroundColor: zone.color || '#3B82F6' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.zoneName}>{zone.name}</Text>
                {zone.description ? (
                  <Text style={styles.zoneDesc} numberOfLines={1}>{zone.description}</Text>
                ) : null}
              </View>
              {zone.setupConfirmed && (
                <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              )}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          onPress={handleConfirm}
          disabled={submitting || selected.length === 0}
          style={[styles.confirmBtn, { backgroundColor: selected.length > 0 ? '#d97706' : '#d1d5db' }]}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="map" size={18} color="#fff" />
              <Text style={styles.confirmBtnText}>Confirmer {selected.length} zone{selected.length !== 1 ? 's' : ''}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Agents Card ──────────────────────────────────────────────────────────────
const AgentsCard = ({ agents, loading, onRefresh }) => {
  const present = agents.filter(a => a.isPresent).length;

  return (
    <View style={styles.agentsCard}>
      <View style={styles.agentsHeader}>
        <Ionicons name="people" size={20} color="#2563eb" />
        <Text style={styles.agentsTitle}>Agents supervisés</Text>
        <View style={styles.agentsBadge}>
          <Text style={styles.agentsBadgeText}>{present}/{agents.length} présents</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} disabled={loading}>
          <Ionicons name="refresh" size={16} color={loading ? '#d1d5db' : '#6b7280'} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#2563eb" />
          <Text style={styles.loadingText}>Chargement agents…</Text>
        </View>
      ) : agents.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={32} color="#d1d5db" />
          <Text style={styles.emptyText}>Aucun agent supervisé assigné à cet événement</Text>
        </View>
      ) : (
        agents.map(item => (
          <View key={item.assignmentId} style={styles.agentRow}>
            <View style={styles.agentAvatar}>
              <Text style={styles.agentAvatarText}>
                {item.agent.firstName?.[0]}{item.agent.lastName?.[0]}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.agentName}>{item.agent.firstName} {item.agent.lastName}</Text>
              <Text style={styles.agentId}>{item.agent.employeeId}</Text>
            </View>
            <View style={styles.agentStatus}>
              <View style={[styles.presenceDot, { backgroundColor: item.isPresent ? '#16a34a' : '#ef4444' }]} />
              <Text style={[styles.presenceText, { color: item.isPresent ? '#16a34a' : '#ef4444' }]}>
                {item.isPresent ? 'Présent' : 'Absent'}
              </Text>
              {item.attendance?.checkInTime && (
                <Text style={styles.checkInTime}>{formatTime(item.attendance.checkInTime)}</Text>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const PhaseManagerScreen = ({ route, navigation }) => {
  const { eventId, eventName } = route.params || {};
  const { user } = useAuthStore();

  const [phases, setPhases] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingZones, setSubmittingZones] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadPhases = useCallback(async () => {
    try {
      const res = await api.get(`/events/${eventId}/phases`);
      setPhases(res.data?.data || null);
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de charger les phases');
    }
  }, [eventId]);

  const loadAgents = useCallback(async () => {
    try {
      setLoadingAgents(true);
      const res = await api.get(`/events/${eventId}/supervised-agents`);
      setAgents(res.data?.data || []);
    } catch { /* silently */ }
    finally { setLoadingAgents(false); }
  }, [eventId]);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPhases(), loadAgents()]);
    setLoading(false);
  }, [loadPhases, loadAgents]);

  useEffect(() => { initialLoad(); }, [initialLoad]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadPhases(), loadAgents()]);
    setRefreshing(false);
  };

  const handleConfirmPhase = async (phase, checklist) => {
    try {
      setSubmitting(true);
      await api.post(`/events/${eventId}/phases/${phase}/confirm`, { checklist });
      Alert.alert('Succès', `Phase confirmée avec succès !`);
      await loadPhases();
    } catch {
      Alert.alert('Erreur', 'Impossible de confirmer la phase');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmZones = async (zoneIds) => {
    try {
      setSubmittingZones(true);
      await api.post(`/events/${eventId}/phases/setup/zones`, { zoneIds });
      Alert.alert('Succès', `${zoneIds.length} zone(s) confirmée(s) !`);
      await loadPhases();
    } catch {
      Alert.alert('Erreur', 'Impossible de confirmer les zones');
    } finally {
      setSubmittingZones(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Chargement gestion phases…</Text>
      </View>
    );
  }

  if (!phases) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Impossible de charger les phases</Text>
        <TouchableOpacity onPress={initialLoad} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>Gestion des phases</Text>
          {eventName ? <Text style={styles.headerSub} numberOfLines={1}>{eventName}</Text> : null}
        </View>
        <TouchableOpacity onPress={handleRefresh} disabled={refreshing}>
          <Ionicons name="refresh" size={20} color={refreshing ? '#d1d5db' : '#6b7280'} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Phase confirmation cards */}
        <PhaseCard
          phase="preparation"
          phaseData={phases.phases?.preparation}
          onConfirm={handleConfirmPhase}
          submitting={submitting}
        />
        <PhaseCard
          phase="setup"
          phaseData={phases.phases?.setup}
          onConfirm={handleConfirmPhase}
          submitting={submitting}
        />
        <PhaseCard
          phase="execution"
          phaseData={phases.phases?.execution}
          onConfirm={handleConfirmPhase}
          submitting={submitting}
        />

        {/* Zone confirmation (phase 2) */}
        <ZonesCard
          zones={phases.phases?.setup?.zones || []}
          zonesConfirmed={phases.phases?.setup?.zonesConfirmed || []}
          onConfirmZones={handleConfirmZones}
          submitting={submittingZones}
        />

        {/* Supervised agents */}
        <AgentsCard
          agents={agents}
          loading={loadingAgents}
          onRefresh={loadAgents}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  loadingText: { color: '#6b7280', fontSize: 14, marginTop: 8 },
  errorText: { color: '#374151', fontSize: 16, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  retryBtn: { marginTop: 12, backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  headerSub: { fontSize: 12, color: '#6b7280', marginTop: 1 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },

  // Phase cards
  phaseCard: { borderRadius: 14, borderWidth: 2, overflow: 'hidden', marginBottom: 4 },
  phaseHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  phaseTitle: { color: '#fff', fontWeight: '700', fontSize: 15, flex: 1 },
  confirmedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  confirmedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  phaseBody: { padding: 16, gap: 8 },
  confirmedBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12 },
  confirmedText: { color: '#15803d', fontSize: 13, fontWeight: '500', flex: 1 },

  checklistTitle: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 },
  checkItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  checkItemChecked: { backgroundColor: '#fff' },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#9ca3af',
    justifyContent: 'center', alignItems: 'center',
  },
  checkLabel: { fontSize: 14, color: '#374151', flex: 1 },
  checkLabelDone: { textDecorationLine: 'line-through', color: '#9ca3af' },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 12, marginTop: 8,
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Zones
  zoneItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.5)', marginBottom: 4,
    borderWidth: 1, borderColor: 'transparent',
  },
  zoneItemSelected: { backgroundColor: '#fff', borderColor: '#fcd34d' },
  zoneDot: { width: 10, height: 10, borderRadius: 5 },
  zoneName: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  zoneDesc: { fontSize: 12, color: '#6b7280', marginTop: 1 },

  emptyBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { color: '#9ca3af', fontSize: 13, textAlign: 'center' },

  loadingBox: { alignItems: 'center', paddingVertical: 20, gap: 8 },

  // Agents
  agentsCard: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb',
    overflow: 'hidden', marginBottom: 4,
  },
  agentsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    backgroundColor: '#f9fafb',
  },
  agentsTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937', flex: 1 },
  agentsBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  agentsBadgeText: { color: '#15803d', fontSize: 11, fontWeight: '700' },
  refreshBtn: { padding: 4 },

  agentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f9fafb',
  },
  agentAvatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#dbeafe',
    justifyContent: 'center', alignItems: 'center',
  },
  agentAvatarText: { color: '#1d4ed8', fontWeight: '700', fontSize: 13 },
  agentName: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  agentId: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  agentStatus: { alignItems: 'flex-end', gap: 2 },
  presenceDot: { width: 8, height: 8, borderRadius: 4, alignSelf: 'flex-end' },
  presenceText: { fontSize: 12, fontWeight: '600' },
  checkInTime: { fontSize: 11, color: '#9ca3af' },
});

export default PhaseManagerScreen;
