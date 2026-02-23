import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { attendanceAPI, assignmentsAPI, eventsAPI, usersAPI, reportsAPI } from '../services/api';
import useAuthStore from '../services/authStore';

const ROLE_CONFIG = {
  admin:      { label: 'Administrateur', color: '#dc2626', icon: 'shield-checkmark' },
  supervisor: { label: 'Responsable',    color: '#d97706', icon: 'people'           },
  agent:      { label: 'Agent',          color: '#2563eb', icon: 'shield'           },
  user:       { label: 'Utilisateur',    color: '#6b7280', icon: 'person'           },
};

const HomeScreen = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  const [todayStatus, setTodayStatus]     = useState(null);
  const [assignments, setAssignments]     = useState([]);
  const [supervisor, setSupervisor]       = useState(null);
  const [adminStats, setAdminStats]       = useState(null);
  const [adminEvents, setAdminEvents]     = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [location, setLocation]           = useState(null);
  const [currentTime, setCurrentTime]     = useState(new Date());

  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = async () => {
    try {
      if (isAdmin || isSupervisor) {
        // Admin/Supervisor: load dashboard stats + all events
        const [statsRes, eventsRes] = await Promise.all([
          reportsAPI.getDashboard().catch(() => null),
          eventsAPI.getAll({ limit: 50 }).catch(() => null),
        ]);
        if (statsRes?.data?.data) setAdminStats(statsRes.data.data);
        const evData = eventsRes?.data?.data;
        const evList = Array.isArray(evData) ? evData : (evData?.events || []);
        setAdminEvents(evList);
      } else {
        // Agent: today attendance status + assignments
        const statusRes = await attendanceAPI.getTodayStatus();
        setTodayStatus(statusRes.data.data);

        const assignRes = await assignmentsAPI.getMyAssignments({ status: 'confirmed' });
        const myAssignments = assignRes.data.data || [];
        setAssignments(myAssignments);

        // Load supervisor info
        if (user?.supervisorId) {
          try {
            const supRes = await usersAPI.getById(user.supervisorId);
            setSupervisor(supRes.data.data);
          } catch (_) {}
        }
      }
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      return loc.coords;
    } catch (error) {
      return null;
    }
  };

  useEffect(() => {
    fetchData();
    getLocation();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  // Navigate to CheckIn — pass full event + assignment objects (same as web)
  const handleCheckIn = (event, assignment) => {
    navigation.navigate('CheckIn', { event, assignment });
  };

  // Navigate to CheckOut — pass attendance id + event (same as web)
  const handleCheckOut = (attendance, event) => {
    navigation.navigate('CheckOut', { attendanceId: attendance.id, event });
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const formatDate = () => new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const formatTime = (d) => {
    if (!d) return '--:--';
    return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // Find zone for an event from assignments
  const getZoneForEvent = (eventId) => {
    const a = assignments.find(a => a.eventId === eventId);
    return a?.zone || a?.Zone || null;
  };

  const roleCfg = ROLE_CONFIG[user?.role] || ROLE_CONFIG.agent;
  const events  = todayStatus?.events || [];
  const checked = events.filter(e => e.attendance?.checkInTime).length;
  const pending = events.filter(e => !e.attendance?.checkInTime).length;

  // Admin stats display values
  const adminTotalEvents = adminStats?.totalEvents ?? adminStats?.events ?? adminEvents.length;
  const adminTotalAgents = adminStats?.totalAgents ?? adminStats?.agents ?? adminStats?.totalUsers ?? '—';
  const adminTodayPresences = adminStats?.todayAttendance ?? adminStats?.todayCheckins ?? '—';
  const adminActiveEvents = adminStats?.activeEvents ?? adminStats?.ongoingEvents ?? adminEvents.filter(e => {
    const now = new Date();
    const start = e.startDate ? new Date(e.startDate.split('T')[0]) : null;
    const end = e.endDate ? new Date(e.endDate.split('T')[0]) : null;
    return start && end && now >= start && now <= end;
  }).length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
    >
      {/* ── Header (même design que web: nom + rôle + heure) ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.userName}>{user?.firstName} {user?.lastName}</Text>
          <Text style={styles.date}>{formatDate()}</Text>
          <Text style={styles.clock}>{currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>

          {/* Role badge — même logique que web */}
          <View style={[styles.roleBadge, { backgroundColor: roleCfg.color }]}>
            <Ionicons name={roleCfg.icon} size={12} color="#fff" />
            <Text style={styles.roleBadgeText}>{roleCfg.label}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate('Profil')}>
            <Text style={styles.avatarText}>{user?.firstName?.[0]}{user?.lastName?.[0]}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Quick Stats ── */}
      <View style={styles.statsContainer}>
        {(isAdmin || isSupervisor) ? (
          <>
            <View style={styles.statCard}>
              <Ionicons name="people-outline" size={22} color="#2563eb" />
              <Text style={styles.statValue}>{adminTotalAgents}</Text>
              <Text style={styles.statLabel}>Agents</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="calendar-outline" size={22} color="#8b5cf6" />
              <Text style={styles.statValue}>{adminTotalEvents}</Text>
              <Text style={styles.statLabel}>Événements</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#10b981" />
              <Text style={styles.statValue}>{adminTodayPresences}</Text>
              <Text style={styles.statLabel}>Présences</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.statCard}>
              <Ionicons name="calendar-outline" size={22} color="#2563eb" />
              <Text style={styles.statValue}>{events.length}</Text>
              <Text style={styles.statLabel}>Événements</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#10b981" />
              <Text style={styles.statValue}>{checked}</Text>
              <Text style={styles.statLabel}>Pointés</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time-outline" size={22} color="#f59e0b" />
              <Text style={styles.statValue}>{pending}</Text>
              <Text style={styles.statLabel}>En attente</Text>
            </View>
          </>
        )}
      </View>

      {/* ── Supervisor info if available (même que web) ── */}
      {supervisor && (
        <View style={styles.supervisorCard}>
          <Ionicons name="person-circle-outline" size={20} color="#d97706" />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.supervisorLabel}>Responsable</Text>
            <Text style={styles.supervisorName}>{supervisor.firstName} {supervisor.lastName}</Text>
            {supervisor.phone && (
              <Text style={styles.supervisorPhone}>{supervisor.phone}</Text>
            )}
          </View>
          <Ionicons name="chevron-forward-outline" size={16} color="#9ca3af" />
        </View>
      )}

      {/* ── Today's Events ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {(isAdmin || isSupervisor) ? 'Tous les événements' : 'Événements du jour'}
        </Text>

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color="#2563eb" />
            <Text style={[styles.emptyText, { marginTop: 8 }]}>Chargement...</Text>
          </View>
        ) : (isAdmin || isSupervisor) ? (
          adminEvents.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>Aucun événement</Text>
            </View>
          ) : (
            adminEvents.slice(0, 5).map((event, index) => (
              <TouchableOpacity key={index} style={styles.eventCard} onPress={() => navigation.navigate('EventDetail', { eventId: event.id })} activeOpacity={0.75}>
                <View style={styles.eventHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventName}>{event.name}</Text>
                    {event.location ? <Text style={styles.eventDetailText} numberOfLines={1}>{event.location}</Text> : null}
                    {event.startDate ? <Text style={[styles.eventDetailText, { marginTop: 2 }]}>{new Date(event.startDate.split('T')[0]).toLocaleDateString('fr-FR')}</Text> : null}
                  </View>
                  <View style={[styles.statusBadge, event.status === 'active' ? styles.statusActive : event.status === 'completed' ? styles.statusCompleted : styles.statusPending]}>
                    <Text style={styles.statusText}>{event.status === 'active' ? 'En cours' : event.status === 'completed' ? 'Terminé' : 'Planifié'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )
        ) : events.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Aucun événement aujourd'hui</Text>
          </View>
        ) : (
          events.map((event, index) => {
            const hasCheckedIn  = !!event.attendance?.checkInTime;
            const hasCheckedOut = !!event.attendance?.checkOutTime;
            const zone = getZoneForEvent(event.eventId || event.id);
            const att  = event.attendance;

            return (
              <View key={`agent-ev-${index}`} style={styles.eventCard}>
                {/* Event header */}
                <View style={styles.eventHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventName}>{event.eventName || event.name}</Text>
                    {event.location && (
                      <View style={styles.eventDetailRow}>
                        <Ionicons name="location-outline" size={13} color="#6b7280" />
                        <Text style={styles.eventDetailText}>{event.location}</Text>
                      </View>
                    )}
                    {(event.checkInTime || event.startDate) && (
                      <View style={styles.eventDetailRow}>
                        <Ionicons name="time-outline" size={13} color="#6b7280" />
                        <Text style={styles.eventDetailText}>
                          {event.checkInTime || new Date(event.startDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {event.checkOutTime ? ` - ${event.checkOutTime}` : ''}
                        </Text>
                      </View>
                    )}
                    {/* Zone badge (même que web) */}
                    {zone && (
                      <View style={styles.zoneBadge}>
                        <Ionicons name="map-outline" size={12} color="#7c3aed" />
                        <Text style={styles.zoneText}>{zone.name}</Text>
                      </View>
                    )}
                  </View>

                  {/* Status badge — mêmes couleurs que web */}
                  <View style={[
                    styles.statusBadge,
                    hasCheckedOut ? styles.statusCompleted :
                    hasCheckedIn  ? styles.statusActive    : styles.statusPending
                  ]}>
                    <Text style={[
                      styles.statusText,
                      hasCheckedOut ? { color: '#374151' } :
                      hasCheckedIn  ? { color: '#065f46' } : { color: '#92400e' }
                    ]}>
                      {hasCheckedOut ? 'Terminé' : hasCheckedIn ? 'En cours' : 'En attente'}
                    </Text>
                  </View>
                </View>

                {/* Attendance times (même que web) */}
                {hasCheckedIn && (
                  <View style={styles.attendanceInfo}>
                    <Text style={styles.attendanceText}>
                      <Ionicons name="log-in-outline" size={13} color="#10b981" /> Arrivée : {formatTime(att.checkInTime)}
                    </Text>
                    {hasCheckedOut && (
                      <Text style={[styles.attendanceText, { marginTop: 2 }]}>
                        <Ionicons name="log-out-outline" size={13} color="#f59e0b" /> Départ : {formatTime(att.checkOutTime)}
                      </Text>
                    )}
                  </View>
                )}

                {/* Action buttons — même logique que web */}
                <View style={styles.eventActions}>
                  {!hasCheckedIn ? (
                    <TouchableOpacity
                      style={styles.checkInButton}
                      onPress={() => handleCheckIn(
                        { id: event.eventId || event.id, name: event.eventName || event.name, location: event.location, latitude: event.latitude, longitude: event.longitude, geoRadius: event.geoRadius, checkInTime: event.checkInTime, checkOutTime: event.checkOutTime },
                        assignments.find(a => a.eventId === (event.eventId || event.id))
                      )}
                    >
                      <Ionicons name="log-in-outline" size={18} color="#fff" />
                      <Text style={styles.buttonText}>Pointer l'arrivée</Text>
                    </TouchableOpacity>
                  ) : !hasCheckedOut ? (
                    <TouchableOpacity
                      style={styles.checkOutButton}
                      onPress={() => handleCheckOut(att, { id: event.eventId || event.id, name: event.eventName || event.name })}
                    >
                      <Ionicons name="log-out-outline" size={18} color="#fff" />
                      <Text style={styles.buttonText}>Pointer le départ</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ── GPS position (même que web) ── */}
      <View style={styles.locationCard}>
        <Ionicons name={location ? 'location' : 'location-outline'} size={18} color={location ? '#10b981' : '#f59e0b'} />
        <Text style={styles.locationText}>
          {location
            ? `GPS: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
            : 'Position GPS non disponible'}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#2563eb', padding: 24, paddingTop: 56,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  greeting:   { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  userName:   { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 2 },
  date:       { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 },
  clock:      { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 4 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, marginTop: 8, opacity: 0.9,
  },
  roleBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText:     { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statsContainer: { flexDirection: 'row', paddingHorizontal: 12, marginTop: -24 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginHorizontal: 4, alignItems: 'center', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginTop: 6 },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 3 },
  supervisorCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    padding: 14, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#d97706',
    elevation: 1,
  },
  supervisorLabel: { fontSize: 11, color: '#9ca3af' },
  supervisorName:  { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  supervisorPhone: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  section:         { padding: 16 },
  sectionTitle:    { fontSize: 17, fontWeight: '600', color: '#1f2937', marginBottom: 12 },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 40, alignItems: 'center', elevation: 1,
  },
  emptyText: { color: '#9ca3af', marginTop: 10, fontSize: 14 },
  eventCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3,
  },
  eventHeader:     { flexDirection: 'row', justifyContent: 'space-between' },
  eventName:       { fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 6 },
  eventDetailRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  eventDetailText: { fontSize: 12, color: '#6b7280', marginLeft: 4 },
  zoneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#ede9fe', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, alignSelf: 'flex-start', marginTop: 6,
  },
  zoneText:     { fontSize: 11, color: '#7c3aed', fontWeight: '500' },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  statusPending:   { backgroundColor: '#fef3c7' },
  statusActive:    { backgroundColor: '#d1fae5' },
  statusCompleted: { backgroundColor: '#e5e7eb' },
  statusText:      { fontSize: 11, fontWeight: '600' },
  attendanceInfo: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  attendanceText: { fontSize: 12, color: '#6b7280' },
  eventActions:   { marginTop: 12 },
  checkInButton: {
    backgroundColor: '#10b981', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 13, borderRadius: 10,
  },
  checkOutButton: {
    backgroundColor: '#f59e0b', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 13, borderRadius: 10,
  },
  buttonText:   { color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 8 },
  locationCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 24,
    padding: 12, borderRadius: 10, elevation: 1,
  },
  locationText: { marginLeft: 8, color: '#6b7280', fontSize: 12 },
});

export default HomeScreen;
