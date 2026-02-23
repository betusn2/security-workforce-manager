import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reportsAPI, eventsAPI, attendanceAPI } from '../services/api';
import useAuthStore from '../services/authStore';

const StatBox = ({ icon, label, value, color, sub }) => (
  <View style={[styles.statBox, { borderTopColor: color, borderTopWidth: 3 }]}>
    <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.statValue}>{value ?? '—'}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
  </View>
);

export default function ReportsScreen({ navigation }) {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [statsRes, trendsRes] = await Promise.all([
        reportsAPI.getDashboard().catch(e => null),
        reportsAPI.getAttendanceTrends({ days: 7 }).catch(e => null),
      ]);
      if (statsRes?.data?.data) setStats(statsRes.data.data);
      if (trendsRes?.data?.data) setTrends(trendsRes.data.data);
    } catch (err) {
      setError('Impossible de charger les statistiques');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rapports & Stats</Text>
        <Text style={styles.headerSub}>Vue d'ensemble de l'activité</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchData}><Text style={styles.retryBtnText}>Réessayer</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        >
          {/* Main stats grid */}
          {stats && (
            <>
              <Text style={styles.sectionTitle}>Statistiques générales</Text>
              <View style={styles.statsGrid}>
                <StatBox icon="people" label="Total Agents" value={stats.totalAgents ?? stats.agents ?? stats.totalUsers} color="#3b82f6" />
                <StatBox icon="calendar" label="Événements" value={stats.totalEvents ?? stats.events} color="#8b5cf6" />
                <StatBox icon="checkmark-circle" label="Présences aujourd'hui" value={stats.todayAttendance ?? stats.todayCheckins} color="#10b981" />
                <StatBox icon="warning" label="Incidents" value={stats.totalIncidents ?? stats.incidents} color="#ef4444" />
              </View>

              {/* More stats row */}
              <View style={styles.statsGrid}>
                <StatBox
                  icon="flash"
                  label="Événements actifs"
                  value={stats.activeEvents ?? stats.ongoingEvents}
                  color="#f59e0b"
                />
                <StatBox
                  icon="trending-up"
                  label="Taux de présence"
                  value={stats.attendanceRate !== undefined ? `${stats.attendanceRate}%` : null}
                  color="#06b6d4"
                />
              </View>

              {/* Summary cards */}
              {stats.recentIncidents !== undefined && (
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
                    <Text style={styles.summaryLabel}>Incidents récents (30j)</Text>
                    <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{stats.recentIncidents}</Text>
                  </View>
                </View>
              )}
              {stats.pendingAssignments !== undefined && (
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Ionicons name="briefcase-outline" size={20} color="#f59e0b" />
                    <Text style={styles.summaryLabel}>Affectations en attente</Text>
                    <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>{stats.pendingAssignments}</Text>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Trends section */}
          {trends && Array.isArray(trends) && trends.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Tendances (7 derniers jours)</Text>
              <View style={styles.trendsCard}>
                {trends.slice(-7).map((t, i) => {
                  const maxVal = Math.max(...trends.map(x => x.count || x.total || 0), 1);
                  const val = t.count || t.total || 0;
                  const barPct = (val / maxVal) * 100;
                  const dateStr = t.date ? new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : `J-${trends.length - i}`;
                  return (
                    <View key={i} style={styles.trendRow}>
                      <Text style={styles.trendDate}>{dateStr}</Text>
                      <View style={styles.trendBarBg}>
                        <View style={[styles.trendBar, { width: `${barPct}%` }]} />
                      </View>
                      <Text style={styles.trendVal}>{val}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {!stats && !trends && (
            <View style={styles.center}>
              <Ionicons name="bar-chart-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyText}>Aucune donnée disponible</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#059669', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 16, marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  statBox: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  statIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 26, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 2, fontWeight: '600' },
  statSub: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryLabel: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '600' },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  trendsCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  trendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  trendDate: { width: 55, fontSize: 12, color: '#6b7280', fontWeight: '600' },
  trendBarBg: { flex: 1, height: 14, backgroundColor: '#f1f5f9', borderRadius: 7, overflow: 'hidden' },
  trendBar: { height: '100%', backgroundColor: '#2563eb', borderRadius: 7 },
  trendVal: { width: 28, fontSize: 13, color: '#374151', fontWeight: '700', textAlign: 'right' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingTop: 80 },
  errorText: { fontSize: 15, color: '#ef4444', textAlign: 'center' },
  emptyText: { fontSize: 15, color: '#9ca3af', textAlign: 'center' },
  retryBtn: { backgroundColor: '#059669', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
});
