import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert, Dimensions
} from 'react-native';
import MapView, { Marker, Callout, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { trackingAPI, eventsAPI } from '../services/api';
import socketService from '../services/socketService';
import useAuthStore from '../services/authStore';

const ROLE_COLORS = { agent: '#2563eb', supervisor: '#d97706', admin: '#dc2626', guard: '#059669' };
const STATUS_COLORS = { active: '#10b981', idle: '#f59e0b', offline: '#9ca3af' };

export default function LiveTrackingScreen({ navigation }) {
  const { user } = useAuthStore();
  const mapRef = useRef(null);
  const [positions, setPositions] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'agent' | 'supervisor'
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await trackingAPI.getAllLivePositions();
      const raw = res?.data?.data;
      const list = Array.isArray(raw) ? raw : (raw?.positions || raw?.tracking || []);
      setPositions(list);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('Erreur récupération positions:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await eventsAPI.getAll({ status: 'active', limit: 20 });
      const raw = res?.data?.data;
      const list = Array.isArray(raw) ? raw : (raw?.events || []);
      setEvents(list);
    } catch {}
  }, []);

  useEffect(() => {
    fetchPositions();
    fetchEvents();

    // Rafraîchissement auto toutes les 10s
    const interval = setInterval(fetchPositions, 10000);

    // Écouter les mises à jour temps réel via Socket.IO
    const handlePositionUpdate = (data) => {
      setPositions(prev => {
        const idx = prev.findIndex(p => p.userId === data.userId);
        const updated = { ...data, updatedAt: new Date().toISOString() };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...updated };
          return next;
        }
        return [...prev, updated];
      });
      setLastUpdated(new Date());
    };

    socketService.on('position_update', handlePositionUpdate);
    socketService.on('current_positions', (data) => {
      if (Array.isArray(data)) setPositions(data);
    });

    return () => {
      clearInterval(interval);
      socketService.off('position_update', handlePositionUpdate);
    };
  }, [fetchPositions]);

  const filteredPositions = positions.filter(p => {
    if (filter === 'all') return true;
    return p.role === filter;
  });

  const centerOnAgent = (pos) => {
    if (!pos.latitude || !pos.longitude) return;
    setSelectedAgent(pos);
    mapRef.current?.animateToRegion({
      latitude: pos.latitude,
      longitude: pos.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }, 500);
  };

  const fitAllMarkers = () => {
    if (filteredPositions.length === 0) return;
    const coords = filteredPositions
      .filter(p => p.latitude && p.longitude)
      .map(p => ({ latitude: p.latitude, longitude: p.longitude }));
    if (coords.length > 0) {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 40, bottom: 160, left: 40 },
        animated: true,
      });
    }
  };

  const getAgentColor = (pos) => ROLE_COLORS[pos.role] || '#6b7280';
  const getStatusColor = (pos) => {
    const age = pos.updatedAt ? (Date.now() - new Date(pos.updatedAt).getTime()) : Infinity;
    if (age < 60000) return STATUS_COLORS.active;
    if (age < 300000) return STATUS_COLORS.idle;
    return STATUS_COLORS.offline;
  };

  const formatTime = (dt) => {
    if (!dt) return '—';
    const d = new Date(dt);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Suivi en direct</Text>
          {lastUpdated && (
            <Text style={styles.headerSub}>Mis à jour : {formatTime(lastUpdated)}</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowFilters(!showFilters)}>
            <Ionicons name="filter" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => { setRefreshing(true); fetchPositions(); }}>
            <Ionicons name={refreshing ? 'reload' : 'refresh'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filtres */}
      {showFilters && (
        <View style={styles.filtersRow}>
          {['all', 'agent', 'supervisor'].map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f === 'all' ? 'Tous' : f === 'agent' ? 'Agents' : 'Responsables'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Carte */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Chargement de la carte…</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: 33.5731,
              longitude: -7.5898,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            }}
            showsUserLocation={true}
            showsMyLocationButton={false}
          >
            {filteredPositions.map((pos, idx) => {
              if (!pos.latitude || !pos.longitude) return null;
              const color = getAgentColor(pos);
              const statusColor = getStatusColor(pos);
              return (
                <Marker
                  key={pos.userId || idx}
                  coordinate={{ latitude: pos.latitude, longitude: pos.longitude }}
                  onPress={() => centerOnAgent(pos)}
                >
                  <View style={[styles.markerContainer]}>
                    <View style={[styles.marker, { backgroundColor: color }]}>
                      <Ionicons name="person" size={14} color="#fff" />
                    </View>
                    <View style={[styles.markerStatus, { backgroundColor: statusColor }]} />
                  </View>
                  <Callout tooltip onPress={() => setSelectedAgent(pos)}>
                    <View style={styles.callout}>
                      <Text style={styles.calloutName}>
                        {pos.userName || pos.user?.firstName || 'Agent'}
                      </Text>
                      <Text style={styles.calloutRole}>
                        {pos.role === 'supervisor' ? 'Responsable' : 'Agent'}
                      </Text>
                      {pos.batteryLevel != null && (
                        <Text style={styles.calloutMeta}>🔋 {pos.batteryLevel}%</Text>
                      )}
                      <Text style={styles.calloutMeta}>⏱ {formatTime(pos.updatedAt)}</Text>
                    </View>
                  </Callout>
                </Marker>
              );
            })}
          </MapView>

          {/* Bouton centrer */}
          <TouchableOpacity style={styles.fitBtn} onPress={fitAllMarkers}>
            <Ionicons name="expand" size={20} color="#2563eb" />
          </TouchableOpacity>

          {/* Compteur */}
          <View style={styles.countBadge}>
            <Ionicons name="people" size={14} color="#2563eb" />
            <Text style={styles.countText}>{filteredPositions.length} agent{filteredPositions.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      )}

      {/* Liste agents en bas */}
      {!loading && filteredPositions.length > 0 && (
        <View style={styles.agentList}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 12 }}>
            {filteredPositions.map((pos, idx) => {
              const statusColor = getStatusColor(pos);
              const color = getAgentColor(pos);
              return (
                <TouchableOpacity
                  key={pos.userId || idx}
                  style={[styles.agentChip, selectedAgent?.userId === pos.userId && styles.agentChipSelected]}
                  onPress={() => centerOnAgent(pos)}
                >
                  <View style={[styles.agentDot, { backgroundColor: statusColor }]} />
                  <View style={[styles.agentAvatar, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.agentAvatarText, { color }]}>
                      {(pos.userName || pos.user?.firstName || 'A')[0]}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.agentChipName} numberOfLines={1}>
                      {pos.userName || pos.user?.firstName || 'Agent'}
                    </Text>
                    {pos.batteryLevel != null && (
                      <Text style={styles.agentChipBattery}>🔋 {pos.batteryLevel}%</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {!loading && filteredPositions.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Ionicons name="location-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>Aucun agent en ligne actuellement</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e40af', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 20 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 11, color: '#bfdbfe', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 8 },
  filtersRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: '#e5e7eb' },
  filterChipActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  filterChipTextActive: { color: '#2563eb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6b7280' },
  map: { flex: 1 },
  markerContainer: { alignItems: 'center' },
  marker: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  markerStatus: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff', marginTop: -4 },
  callout: { backgroundColor: '#fff', borderRadius: 10, padding: 12, minWidth: 140, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  calloutName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  calloutRole: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  calloutMeta: { fontSize: 12, color: '#374151', marginTop: 4 },
  fitBtn: { position: 'absolute', top: 12, right: 12, backgroundColor: '#fff', borderRadius: 10, padding: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  countBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  countText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  agentList: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', maxHeight: 90 },
  agentChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', borderRadius: 12, padding: 8, borderWidth: 1.5, borderColor: '#e5e7eb', minWidth: 130 },
  agentChipSelected: { borderColor: '#2563eb', backgroundColor: '#dbeafe' },
  agentDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', top: 6, left: 6 },
  agentAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  agentAvatarText: { fontSize: 16, fontWeight: '800' },
  agentChipName: { fontSize: 13, fontWeight: '600', color: '#111827', maxWidth: 80 },
  agentChipBattery: { fontSize: 11, color: '#6b7280' },
  emptyOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(248,250,252,0.85)' },
  emptyText: { marginTop: 12, fontSize: 14, color: '#9ca3af', textAlign: 'center' },
});
