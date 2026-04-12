import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, ScrollView,
  Animated, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { eventsAPI } from '../services/api';
import useAuthStore from '../services/authStore';
import socketService from '../services/socketService';

const STATUS_FILTERS = ['Tous', 'active', 'scheduled', 'completed', 'cancelled'];
const STATUS_LABELS  = { planned: 'Planifié', scheduled: 'Planifié', active: 'Actif', completed: 'Terminé', cancelled: 'Annulé', draft: 'Brouillon' };
const STATUS_COLORS  = { planned: '#3b82f6', scheduled: '#3b82f6', active: '#10b981', completed: '#6b7280', cancelled: '#ef4444', draft: '#9ca3af' };
const PRIORITY_CONFIG = {
  low:      { label: 'Basse',    color: '#6b7280', bg: '#f3f4f6' },
  medium:   { label: 'Moyenne',  color: '#3b82f6', bg: '#eff6ff' },
  high:     { label: 'Haute',    color: '#f97316', bg: '#fff7ed' },
  critical: { label: 'Critique', color: '#ef4444', bg: '#fef2f2' },
};

// ─── Phase calcul ────────────────────────────────────────────────────────────
const computePhase = (event) => {
  const now   = new Date();
  const start = new Date(event.startDate);
  const end   = new Date(event.endDate);
  if (end < now)   return { label: 'Terminé',      icon: 'checkmark-circle', color: '#6b7280', bg: '#f3f4f6' };
  if (start > now) {
    const days = Math.ceil((start - now) / 86400000);
    if (days === 0) return { label: "Aujourd'hui",  icon: 'today',            color: '#10b981', bg: '#ecfdf5' };
    if (days === 1) return { label: 'Demain',       icon: 'time',             color: '#3b82f6', bg: '#eff6ff' };
    return           { label: `Dans ${days}j`,      icon: 'calendar',         color: '#6b7280', bg: '#f3f4f6' };
  }
  if (event.status === 'active') {
    const [ciH, ciM] = (event.checkInTime || '08:00').split(':').map(Number);
    const [coH, coM] = (event.checkOutTime || '18:00').split(':').map(Number);
    const ci = new Date(start); ci.setHours(ciH, ciM, 0);
    const co = new Date(start); co.setHours(coH, coM, 0);
    if (now < ci) return { label: 'Mise en place', icon: 'construct',         color: '#f59e0b', bg: '#fffbeb' };
    if (now <= co) return { label: 'Pointage',     icon: 'location',          color: '#10b981', bg: '#ecfdf5' };
    return           { label: 'Clôture',           icon: 'lock-closed',       color: '#8b5cf6', bg: '#f5f3ff' };
  }
  return { label: 'En attente', icon: 'pause-circle', color: '#f59e0b', bg: '#fffbeb' };
};

const agentStatus = (event) => {
  const assigned = event.assignedAgentsCount || event.assignedAgents || 0;
  const required = event.requiredAgents || 1;
  const pct = Math.min(100, Math.round((assigned / required) * 100));
  if (pct >= 100) return { pct, color: '#10b981', icon: 'checkmark-circle', label: 'Complet' };
  if (pct >= 70)  return { pct, color: '#f59e0b', icon: 'alert-circle',    label: 'Partiel' };
  return              { pct, color: '#ef4444', icon: 'close-circle',    label: 'Incomplet' };
};

const PAGE_SIZE = 20;

export default function EventsScreen({ navigation }) {
  const { user } = useAuthStore();
  const [events,       setEvents]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [page,         setPage]         = useState(1);
  const [hasMore,      setHasMore]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('Tous');
  const [error,        setError]        = useState(null);
  const searchTimer = useRef(null);

  // ── Stats ──
  const stats = useMemo(() => ({
    total:     events.length,
    active:    events.filter(e => e.status === 'active').length,
    today:     events.filter(e => {
      const d = new Date(e.startDate);
      const n = new Date();
      return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    }).length,
    missing:   events.filter(e => (e.assignedAgentsCount || e.assignedAgents || 0) < (e.requiredAgents || 1)).length,
  }), [events]);

  const fetchEvents = useCallback(async (pageNum = 1, append = false, q = search) => {
    try {
      if (!append) setError(null);
      const params = { limit: PAGE_SIZE, page: pageNum };
      if (q) params.search = q;
      let res;
      if (user?.role === 'agent') {
        res = await eventsAPI.getMyEvents(params);
      } else if (user?.role === 'supervisor' || user?.role === 'responsable') {
        res = await eventsAPI.getAll({ ...params, supervisorId: user.id });
      } else {
        res = await eventsAPI.getAll(params);
      }
      const data = res?.data?.data;
      const list = Array.isArray(data) ? data : (data?.events || []);
      setEvents(prev => append ? [...prev, ...list] : list);
      setHasMore(list.length === PAGE_SIZE);
    } catch {
      setError('Impossible de charger les événements');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [user?.role, user?.id, search]);

  useEffect(() => {
    fetchEvents(1);
    const handleUpdate = () => { setPage(1); fetchEvents(1); };
    socketService.on('event_updated', handleUpdate);
    socketService.on('event_deleted', handleUpdate);
    return () => {
      socketService.off('event_updated', handleUpdate);
      socketService.off('event_deleted', handleUpdate);
    };
  }, [fetchEvents]);

  const onSearchChange = (text) => {
    setSearch(text);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      setLoading(true);
      fetchEvents(1, false, text);
    }, 350);
  };

  const onRefresh = () => { setRefreshing(true); setPage(1); fetchEvents(1); };

  const onEndReached = () => {
    if (!hasMore || loadingMore || loading) return;
    const next = page + 1;
    setPage(next);
    setLoadingMore(true);
    fetchEvents(next, true);
  };

  const filtered = useMemo(() => events.filter(e => {
    const matchStatus = statusFilter === 'Tous' || e.status === statusFilter;
    return matchStatus;
  }), [events, statusFilter]);

  // ── Card renderer ──
  const renderEvent = ({ item }) => {
    const phase   = computePhase(item);
    const agents  = agentStatus(item);
    const priority = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;
    const color   = item.color || '#3b82f6';
    const statusColor = STATUS_COLORS[item.status] || '#9ca3af';

    return (
      <TouchableOpacity
        style={[styles.card, item.status === 'active' && agents.label === 'Incomplet' && styles.cardUrgent]}
        onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
        activeOpacity={0.75}
      >
        {/* Color top bar */}
        <View style={[styles.cardBar, { backgroundColor: color }]} />

        <View style={styles.cardBody}>
          {/* Row 1: time badge + phase + status */}
          <View style={styles.badgeRow}>
            <View style={[styles.phaseBadge, { backgroundColor: phase.bg }]}>
              <Ionicons name={`${phase.icon}-outline`} size={11} color={phase.color} />
              <Text style={[styles.phaseBadgeText, { color: phase.color }]}>{phase.label}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={[styles.statusDot, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
              <View style={[styles.statusDotInner, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusDotText, { color: statusColor }]}>
                {STATUS_LABELS[item.status] || item.status}
              </Text>
            </View>
          </View>

          {/* Name */}
          <Text style={styles.eventName} numberOfLines={2}>{item.name || 'Événement'}</Text>

          {/* Priority + type */}
          <View style={styles.badgeRow}>
            <View style={[styles.pillBadge, { backgroundColor: priority.bg }]}>
              <Ionicons name="flag-outline" size={10} color={priority.color} />
              <Text style={[styles.pillText, { color: priority.color }]}>{priority.label}</Text>
            </View>
            {item.type && (
              <View style={styles.pillBadge}>
                <Text style={styles.pillText}>
                  {item.type === 'regular' ? '🏢' : item.type === 'special' ? '⭐' : '🚨'} {item.type}
                </Text>
              </View>
            )}
          </View>

          {/* Location */}
          {item.location ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={13} color={item.latitude ? '#10b981' : '#9ca3af'} />
              <Text style={styles.infoText} numberOfLines={1}>{item.location}</Text>
              {item.latitude && item.longitude
                ? <View style={styles.gpsBadge}><Text style={styles.gpsText}>GPS ✓</Text></View>
                : <View style={[styles.gpsBadge, styles.gpsBadgeNo]}><Text style={[styles.gpsText, { color: '#ef4444' }]}>GPS ✕</Text></View>
              }
            </View>
          ) : null}

          {/* Date */}
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={13} color="#9ca3af" />
            <Text style={styles.infoText}>
              {formatDate(item.startDate)}
              {item.endDate && item.endDate !== item.startDate ? ` → ${formatDate(item.endDate)}` : ''}
            </Text>
          </View>

          {/* Time */}
          {item.checkInTime ? (
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={13} color="#9ca3af" />
              <Text style={styles.infoText}>
                {item.checkInTime?.slice(0, 5)} — {item.checkOutTime?.slice(0, 5)}
              </Text>
            </View>
          ) : null}

          {/* Agents progress */}
          <View style={styles.agentRow}>
            <Ionicons name="people-outline" size={13} color="#9ca3af" />
            <Text style={[styles.agentCount, { color: agents.color }]}>
              {item.assignedAgentsCount || item.assignedAgents || 0}/{item.requiredAgents || '?'}
            </Text>
            <Text style={styles.agentLabel}> agents</Text>
            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <View style={styles.agentBar}>
                <View style={[styles.agentBarFill, { width: `${agents.pct}%`, backgroundColor: agents.color }]} />
              </View>
            </View>
            <Ionicons name={`${agents.icon}-outline`} size={14} color={agents.color} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Stats header ──
  const renderHeader = () => (
    <View style={styles.statsRow}>
      {[
        { label: 'Total',     value: stats.total,   icon: 'calendar',       color: '#3b82f6' },
        { label: 'Actifs',    value: stats.active,  icon: 'radio-button-on',color: '#10b981' },
        { label: "Auj.",      value: stats.today,   icon: 'today',          color: '#8b5cf6' },
        { label: 'Manquants', value: stats.missing, icon: 'alert-circle',   color: '#ef4444', urgent: stats.missing > 0 },
      ].map(({ label, value, icon, color, urgent }) => (
        <View key={label} style={[styles.statCard, urgent && styles.statCardUrgent]}>
          <Ionicons name={`${icon}-outline`} size={16} color={color} />
          <Text style={[styles.statValue, { color }]}>{value}</Text>
          <Text style={styles.statLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Événements</Text>
          <Text style={styles.headerSub}>{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</Text>
        </View>
        <Ionicons name="shield-checkmark" size={28} color="rgba(255,255,255,0.3)" />
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher nom, lieu..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={onSearchChange}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => onSearchChange('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Status chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {STATUS_FILTERS.map(s => {
          const active = statusFilter === s;
          const color  = STATUS_COLORS[s] || '#3b82f6';
          return (
            <TouchableOpacity key={s}
              style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
              onPress={() => setStatusFilter(s)}>
              {s !== 'Tous' && <View style={[styles.chipDot, { backgroundColor: active ? '#fff' : color }]} />}
              <Text style={[styles.chipText, active && { color: '#fff' }]}>
                {s === 'Tous' ? 'Tous' : STATUS_LABELS[s]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchEvents(1); }}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={72} color="#e5e7eb" />
          <Text style={styles.emptyTitle}>Aucun événement</Text>
          <Text style={styles.emptyText}>
            {search || statusFilter !== 'Tous' ? 'Modifiez votre recherche ou filtre' : 'Aucun événement disponible'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderEvent}
          ListHeaderComponent={renderHeader}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} tintColor="#2563eb" />}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListFooterComponent={loadingMore
            ? <ActivityIndicator style={{ marginVertical: 16 }} color="#2563eb" />
            : null}
        />
      )}
    </View>
  );
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr.split('T')[0] + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f1f5f9' },
  header:           { backgroundColor: '#2563eb', paddingTop: Platform.OS === 'ios' ? 56 : 44, paddingBottom: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerTitle:      { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub:        { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  searchRow:        { paddingHorizontal: 16, paddingVertical: 10 },
  searchBox:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  searchInput:      { flex: 1, fontSize: 15, color: '#111827' },
  filterRow:        { maxHeight: 46, marginBottom: 4 },
  chip:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', gap: 5 },
  chipDot:          { width: 7, height: 7, borderRadius: 4 },
  chipText:         { fontSize: 13, color: '#475569', fontWeight: '600' },
  // Stats
  statsRow:         { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statCard:         { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 10, alignItems: 'center', gap: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statCardUrgent:   { backgroundColor: '#fef2f2', borderWidth: 1.5, borderColor: '#fca5a5' },
  statValue:        { fontSize: 20, fontWeight: '900' },
  statLabel:        { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  // Card
  card:             { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardUrgent:       { borderWidth: 2, borderColor: '#fca5a5', shadowColor: '#ef4444', shadowOpacity: 0.12 },
  cardBar:          { height: 4 },
  cardBody:         { padding: 14, gap: 8 },
  badgeRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  phaseBadge:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, gap: 4 },
  phaseBadgeText:   { fontSize: 11, fontWeight: '700' },
  statusDot:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, gap: 4 },
  statusDotInner:   { width: 6, height: 6, borderRadius: 3 },
  statusDotText:    { fontSize: 11, fontWeight: '700' },
  pillBadge:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: '#f8fafc', gap: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  pillText:         { fontSize: 11, color: '#64748b', fontWeight: '600' },
  eventName:        { fontSize: 16, fontWeight: '800', color: '#0f172a', lineHeight: 22 },
  infoRow:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText:         { flex: 1, fontSize: 13, color: '#64748b' },
  gpsBadge:         { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: '#ecfdf5' },
  gpsBadgeNo:       { backgroundColor: '#fef2f2' },
  gpsText:          { fontSize: 10, fontWeight: '700', color: '#10b981' },
  agentRow:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  agentCount:       { fontSize: 13, fontWeight: '800' },
  agentLabel:       { fontSize: 12, color: '#94a3b8' },
  agentBar:         { height: 4, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  agentBarFill:     { height: 4, borderRadius: 4 },
  // States
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingText:      { color: '#94a3b8', fontSize: 14 },
  errorText:        { fontSize: 15, color: '#1f2937', fontWeight: '600', textAlign: 'center' },
  retryBtn:         { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  retryText:        { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyTitle:       { fontSize: 18, fontWeight: '800', color: '#374151' },
  emptyText:        { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
});
