import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const HistoryScreen = ({ navigation }) => {
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');

  // Fetch attendance history
  const fetchHistory = async (pageNum = 1, refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      }

      const params = {
        page: pageNum,
        limit: 20,
      };

      if (selectedFilter !== 'all') {
        params.status = selectedFilter;
      }

      const response = await api.get('/attendance/my-history', { params });
      const data = response.data.data;

      if (pageNum === 1) {
        setAttendances(data.attendances || []);
      } else {
        setAttendances(prev => [...prev, ...(data.attendances || [])]);
      }

      setHasMore(data.pagination?.hasMore || false);
      setPage(pageNum);

      // Fetch stats on first load
      if (pageNum === 1) {
        fetchStats();
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch attendance stats
  const fetchStats = async () => {
    try {
      const response = await api.get('/attendance/my-stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchHistory(1);
  }, [selectedFilter]);

  // Pull to refresh
  const onRefresh = useCallback(() => {
    fetchHistory(1, true);
  }, [selectedFilter]);

  // Load more
  const loadMore = () => {
    if (hasMore && !loading) {
      fetchHistory(page + 1);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  // Format time
  const formatTime = (dateString) => {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return '#10b981';
      case 'late':
        return '#f59e0b';
      case 'absent':
        return '#ef4444';
      case 'left_early':
        return '#f97316';
      default:
        return '#6b7280';
    }
  };

  // Get status label
  const getStatusLabel = (status) => {
    switch (status) {
      case 'present':
        return 'Present';
      case 'late':
        return 'Retard';
      case 'absent':
        return 'Absent';
      case 'left_early':
        return 'Parti tot';
      case 'checked_in':
        return 'En cours';
      default:
        return status;
    }
  };

  // Filters
  const filters = [
    { id: 'all', label: 'Tout', icon: 'list' },
    { id: 'present', label: 'Present', icon: 'checkmark-circle' },
    { id: 'late', label: 'Retard', icon: 'time' },
    { id: 'absent', label: 'Absent', icon: 'close-circle' },
  ];

  // Render stats card
  const renderStats = () => {
    if (!stats) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsCard}>
          <View style={[styles.statItem, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            <Text style={styles.statValue}>{stats.presentCount || 0}</Text>
            <Text style={styles.statLabel}>Presents</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: '#fef3c7' }]}>
            <Ionicons name="time" size={24} color="#f59e0b" />
            <Text style={styles.statValue}>{stats.lateCount || 0}</Text>
            <Text style={styles.statLabel}>Retards</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="close-circle" size={24} color="#ef4444" />
            <Text style={styles.statValue}>{stats.absentCount || 0}</Text>
            <Text style={styles.statLabel}>Absents</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="hourglass" size={24} color="#2563eb" />
            <Text style={styles.statValue}>{stats.totalHours?.toFixed(1) || 0}h</Text>
            <Text style={styles.statLabel}>Heures</Text>
          </View>
        </View>

        {/* Punctuality rate */}
        <View style={styles.punctualityCard}>
          <View style={styles.punctualityHeader}>
            <Ionicons name="trending-up" size={20} color="#10b981" />
            <Text style={styles.punctualityTitle}>Taux de ponctualite</Text>
          </View>
          <View style={styles.punctualityBar}>
            <View
              style={[
                styles.punctualityFill,
                { width: `${stats.punctualityRate || 0}%` }
              ]}
            />
          </View>
          <Text style={styles.punctualityValue}>{stats.punctualityRate || 0}%</Text>
        </View>
      </View>
    );
  };

  // Render attendance item
  const renderItem = ({ item }) => {
    const statusColor = getStatusColor(item.status);
    const isOngoing = item.status === 'checked_in' && !item.checkOutTime;

    return (
      <TouchableOpacity
        style={styles.attendanceCard}
        onPress={() => item.event?.id ? navigation.navigate('EventDetail', { eventId: item.event.id }) : null}
      >
        <View style={styles.cardHeader}>
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
            {isOngoing && (
              <View style={styles.ongoingBadge}>
                <View style={styles.ongoingDot} />
                <Text style={styles.ongoingText}>En cours</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        {/* Event info */}
        <View style={styles.eventInfo}>
          <Ionicons name="calendar-outline" size={16} color="#6b7280" />
          <Text style={styles.eventName} numberOfLines={1}>
            {item.event?.name || 'Evenement inconnu'}
          </Text>
        </View>

        {/* Times */}
        <View style={styles.timesContainer}>
          <View style={styles.timeBlock}>
            <Ionicons name="log-in" size={18} color="#10b981" />
            <View style={styles.timeInfo}>
              <Text style={styles.timeLabel}>Arrivee</Text>
              <Text style={styles.timeValue}>{formatTime(item.checkInTime)}</Text>
            </View>
          </View>

          <View style={styles.timeDivider} />

          <View style={styles.timeBlock}>
            <Ionicons name="log-out" size={18} color="#ef4444" />
            <View style={styles.timeInfo}>
              <Text style={styles.timeLabel}>Depart</Text>
              <Text style={styles.timeValue}>
                {item.checkOutTime ? formatTime(item.checkOutTime) : '--:--'}
              </Text>
            </View>
          </View>

          <View style={styles.timeDivider} />

          <View style={styles.timeBlock}>
            <Ionicons name="time" size={18} color="#2563eb" />
            <View style={styles.timeInfo}>
              <Text style={styles.timeLabel}>Duree</Text>
              <Text style={styles.timeValue}>
                {item.totalHours ? `${item.totalHours}h` : '--'}
              </Text>
            </View>
          </View>
        </View>

        {/* Location indicator */}
        <View style={styles.cardFooter}>
          <View style={styles.locationInfo}>
            <Ionicons
              name={item.isWithinGeofence ? 'location' : 'location-outline'}
              size={14}
              color={item.isWithinGeofence ? '#10b981' : '#f59e0b'}
            />
            <Text style={[
              styles.locationText,
              { color: item.isWithinGeofence ? '#10b981' : '#f59e0b' }
            ]}>
              {item.isWithinGeofence ? 'Dans la zone' : 'Hors zone'}
            </Text>
          </View>

          {item.checkInPhoto && (
            <View style={styles.photoIndicator}>
              <Ionicons name="camera" size={14} color="#6b7280" />
              <Text style={styles.photoText}>Photo</Text>
            </View>
          )}

          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </View>
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmpty = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={64} color="#d1d5db" />
        <Text style={styles.emptyTitle}>Aucun historique</Text>
        <Text style={styles.emptyText}>
          Vos pointages apparaitront ici
        </Text>
      </View>
    );
  };

  // Render footer (loading more)
  const renderFooter = () => {
    if (!hasMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#2563eb" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historique</Text>
        <TouchableOpacity
          style={styles.calendarButton}
          onPress={() => {/* Open calendar picker */}}
        >
          <Ionicons name="calendar" size={24} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filters}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedFilter === item.id && styles.filterButtonActive
              ]}
              onPress={() => setSelectedFilter(item.id)}
            >
              <Ionicons
                name={item.icon}
                size={16}
                color={selectedFilter === item.id ? '#fff' : '#6b7280'}
              />
              <Text style={[
                styles.filterText,
                selectedFilter === item.id && styles.filterTextActive
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      {/* Content */}
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : (
        <FlatList
          data={attendances}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={renderItem}
          ListHeaderComponent={renderStats}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2563eb']}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  calendarButton: {
    padding: 8,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filtersList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
  },
  filterText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  // Stats
  statsContainer: {
    marginBottom: 16,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  punctualityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  punctualityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  punctualityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  punctualityBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  punctualityFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  punctualityValue: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'right',
  },
  // Attendance card
  attendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  ongoingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  ongoingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
    marginRight: 4,
  },
  ongoingText: {
    fontSize: 10,
    color: '#1e40af',
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventName: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 6,
  },
  timesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  timeBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInfo: {
    marginLeft: 6,
  },
  timeLabel: {
    fontSize: 10,
    color: '#9ca3af',
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  timeDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  photoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  // Footer
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default HistoryScreen;
