import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { eventsAPI } from '../services/api';
import useAuthStore from '../services/authStore';

const STATUS_FILTERS = ['Tous', 'planned', 'active', 'completed', 'cancelled'];
const STATUS_LABELS = { planned: 'Planifié', active: 'En cours', completed: 'Terminé', cancelled: 'Annulé' };
const STATUS_COLORS = { planned: '#3b82f6', active: '#10b981', completed: '#6b7280', cancelled: '#ef4444' };

export default function EventsScreen({ navigation }) {
  const { user } = useAuthStore();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tous');
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    try {
      setError(null);
      let res;
      if (user?.role === 'agent') {
        res = await eventsAPI.getMyEvents();
      } else {
        res = await eventsAPI.getAll({ limit: 100 });
      }
      const data = res?.data?.data;
      if (Array.isArray(data)) {
        setEvents(data);
      } else if (data?.events && Array.isArray(data.events)) {
        setEvents(data.events);
      } else {
        setEvents([]);
      }
    } catch (err) {
      setError('Impossible de charger les événements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  const filteredEvents = events.filter(e => {
    const matchSearch = !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.location?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'Tous' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr.split('T')[0]);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusLabel = (status) => STATUS_LABELS[status] || status;
  const getStatusColor = (status) => STATUS_COLORS[status] || '#9ca3af';

  const renderEvent = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
      activeOpacity={0.75}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20', borderColor: getStatusColor(item.status) }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{getStatusLabel(item.status)}</Text>
        </View>
        {item.assignedAgents !== undefined && (
          <View style={styles.agentCount}>
            <Ionicons name="people-outline" size={14} color="#6b7280" />
            <Text style={styles.agentCountText}>{item.assignedAgents || 0} agents</Text>
          </View>
        )}
      </View>
      <Text style={styles.eventName} numberOfLines={2}>{item.name || 'Événement sans nom'}</Text>
      {item.location ? (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color="#6b7280" />
          <Text style={styles.infoText} numberOfLines={1}>{item.location}</Text>
        </View>
      ) : null}
      <View style={styles.infoRow}>
        <Ionicons name="calendar-outline" size={14} color="#6b7280" />
        <Text style={styles.infoText}>
          {formatDate(item.startDate)}
          {item.endDate && item.endDate !== item.startDate ? ` → ${formatDate(item.endDate)}` : ''}
        </Text>
      </View>
      {item.checkInTime && (
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={14} color="#6b7280" />
          <Text style={styles.infoText}>{item.checkInTime?.slice(0, 5)} – {item.checkOutTime?.slice(0, 5)}</Text>
        </View>
      )}
      {item.description ? (
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Événements</Text>
        <Text style={styles.headerSub}>{filteredEvents.length} résultat{filteredEvents.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Search */}
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
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {STATUS_FILTERS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
              {s === 'Tous' ? 'Tous' : STATUS_LABELS[s]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchEvents}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : filteredEvents.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyText}>Aucun événement trouvé</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={item => String(item.id)}
          renderItem={renderEvent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#2563eb', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  filterRow: { maxHeight: 48 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0', height: 34, justifyContent: 'center' },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterChipText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '700' },
  agentCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  agentCountText: { fontSize: 12, color: '#6b7280' },
  eventName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoText: { fontSize: 13, color: '#6b7280', flex: 1 },
  description: { fontSize: 13, color: '#9ca3af', marginTop: 6, lineHeight: 18 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  errorText: { fontSize: 15, color: '#ef4444', textAlign: 'center' },
  emptyText: { fontSize: 15, color: '#9ca3af', textAlign: 'center' },
  retryBtn: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
});
