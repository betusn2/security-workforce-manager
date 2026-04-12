import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import useAuthStore from '../services/authStore';

const EventDetailScreen = ({ route, navigation }) => {
  const { eventId, assignmentId } = route.params || {};
  const { user } = useAuthStore();

  const [event, setEvent] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEventDetails();
  }, [eventId]);

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      const [eventRes, statusRes] = await Promise.all([
        eventId ? api.get(`/events/${eventId}`) : Promise.resolve(null),
        api.get('/attendance/today-status'),
      ]);

      if (eventRes) setEvent(eventRes.data.data);

      const status = statusRes.data.data;
      if (status?.attendance) setTodayAttendance(status.attendance);
      if (status?.assignment) setAssignment(status.assignment);
    } catch (error) {
      console.error('Error fetching event details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'scheduled': return '#2563eb';
      case 'completed': return '#6b7280';
      case 'cancelled': return '#ef4444';
      default: return '#9ca3af';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'En cours';
      case 'scheduled': return 'Planifié';
      case 'completed': return 'Terminé';
      case 'cancelled': return 'Annulé';
      default: return status;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const currentEvent = event || assignment?.event;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Status Badge */}
      {currentEvent?.status && (
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(currentEvent.status) }]}>
          <Ionicons name="radio-button-on" size={14} color="#fff" />
          <Text style={styles.statusBannerText}>{getStatusLabel(currentEvent.status).toUpperCase()}</Text>
        </View>
      )}

      {/* Event Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.eventIcon}>
            <Ionicons name="shield-checkmark" size={32} color="#2563eb" />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.eventTitle}>{currentEvent?.name || 'Événement'}</Text>
            {currentEvent?.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="#6b7280" />
                <Text style={styles.locationText}>{currentEvent.location}</Text>
              </View>
            )}
          </View>
        </View>

        {currentEvent?.description && (
          <Text style={styles.description}>{currentEvent.description}</Text>
        )}
      </View>

      {/* Date & Time */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Horaires</Text>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={18} color="#2563eb" />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Début</Text>
            <Text style={styles.infoValue}>
              {formatDate(currentEvent?.startDate)} à {formatTime(currentEvent?.startDate)}
            </Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={18} color="#ef4444" />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Fin</Text>
            <Text style={styles.infoValue}>
              {formatDate(currentEvent?.endDate)} à {formatTime(currentEvent?.endDate)}
            </Text>
          </View>
        </View>
      </View>

      {/* My Assignment */}
      {assignment && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Mon affectation</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color="#2563eb" />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Rôle</Text>
              <Text style={styles.infoValue}>{assignment.role || 'Agent de sécurité'}</Text>
            </View>
          </View>
          {assignment.post && (
            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={18} color="#2563eb" />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Poste</Text>
                <Text style={styles.infoValue}>{assignment.post}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Today's Attendance */}
      {todayAttendance && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pointage aujourd'hui</Text>
          <View style={styles.infoRow}>
            <Ionicons name="log-in-outline" size={18} color="#10b981" />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Arrivée</Text>
              <Text style={styles.infoValue}>
                {todayAttendance.checkInTime
                  ? formatTime(todayAttendance.checkInTime)
                  : 'Non pointé'}
              </Text>
            </View>
          </View>
          {todayAttendance.checkOutTime && (
            <View style={styles.infoRow}>
              <Ionicons name="log-out-outline" size={18} color="#f59e0b" />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Départ</Text>
                <Text style={styles.infoValue}>{formatTime(todayAttendance.checkOutTime)}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {!todayAttendance?.checkInTime && (
          <TouchableOpacity
            style={[styles.actionButton, styles.checkInBtn]}
            onPress={() => navigation.navigate('CheckIn', { event: currentEvent, assignment })}
          >
            <Ionicons name="log-in-outline" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>Pointer l'arrivée</Text>
          </TouchableOpacity>
        )}

        {todayAttendance?.checkInTime && !todayAttendance?.checkOutTime && (
          <TouchableOpacity
            style={[styles.actionButton, styles.checkOutBtn]}
            onPress={() =>
              navigation.navigate('CheckOut', {
                event: currentEvent,
                assignment,
                attendance: todayAttendance,
              })
            }
          >
            <Ionicons name="log-out-outline" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>Pointer le départ</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.incidentBtn]}
          onPress={() => navigation.navigate('IncidentReport', { event: currentEvent })}
        >
          <Ionicons name="warning-outline" size={22} color="#fff" />
          <Text style={styles.actionButtonText}>Signaler un incident</Text>
        </TouchableOpacity>

        {/* Phase manager button for supervisors/admins */}
        {(user?.role === 'admin' || user?.role === 'supervisor') && (
          <TouchableOpacity
            style={[styles.actionButton, styles.phaseBtn]}
            onPress={() =>
              navigation.navigate('PhaseManager', {
                eventId: currentEvent?.id || eventId,
                eventName: currentEvent?.name,
              })
            }
          >
            <Ionicons name="shield-checkmark-outline" size={22} color="#fff" />
            <Text style={styles.actionButtonText}>Gestion des phases</Text>
          </TouchableOpacity>
        )}
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
    gap: 12,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  statusBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  eventIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#6b7280',
  },
  description: {
    marginTop: 12,
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
    marginTop: 1,
  },
  actionsContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  checkInBtn: {
    backgroundColor: '#10b981',
  },
  checkOutBtn: {
    backgroundColor: '#f59e0b',
  },
  incidentBtn: {
    backgroundColor: '#ef4444',
  },
  phaseBtn: {
    backgroundColor: '#7c3aed',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default EventDetailScreen;
