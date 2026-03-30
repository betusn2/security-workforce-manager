import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { badgesAPI } from '../services/api';
import useAuthStore from '../services/authStore';

const BADGE_ICONS = {
  punctuality: '⏰',
  attendance: '✅',
  performance: '⭐',
  experience: '🏅',
  safety: '🛡️',
  leadership: '👑',
  teamwork: '🤝',
  default: '🎖️',
};

const RANK_COLORS = ['#f59e0b', '#9ca3af', '#b45309', '#6366f1', '#10b981'];
const RANK_LABELS = ['1er', '2ème', '3ème', '4ème', '5ème'];

export default function BadgesScreen({ navigation }) {
  const { user } = useAuthStore();
  const [myBadges, setMyBadges] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('badges'); // 'badges' | 'leaderboard'
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [myRes, allRes, rankRes] = await Promise.allSettled([
        badgesAPI.getMyBadges(),
        badgesAPI.getAll(),
        badgesAPI.getRankings(),
      ]);
      if (myRes.status === 'fulfilled') {
        const raw = myRes.value?.data?.data;
        setMyBadges(Array.isArray(raw) ? raw : (raw?.badges || []));
      }
      if (allRes.status === 'fulfilled') {
        const raw = allRes.value?.data?.data;
        setAllBadges(Array.isArray(raw) ? raw : (raw?.badges || []));
      }
      if (rankRes.status === 'fulfilled') {
        const raw = rankRes.value?.data?.data;
        setRankings(Array.isArray(raw) ? raw : (raw?.rankings || raw?.users || []));
      }
    } catch (err) {
      setError('Impossible de charger les badges');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const myBadgeIds = new Set(myBadges.map(b => b.badgeId || b.id));

  const renderBadge = ({ item }) => {
    const owned = myBadgeIds.has(item.id);
    const icon = BADGE_ICONS[item.type] || BADGE_ICONS.default;
    return (
      <View style={[styles.badgeCard, !owned && styles.badgeCardLocked]}>
        <Text style={styles.badgeEmoji}>{icon}</Text>
        <Text style={[styles.badgeName, !owned && styles.badgeNameLocked]} numberOfLines={2}>
          {item.name}
        </Text>
        {item.description ? (
          <Text style={styles.badgeDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        {owned && (
          <View style={styles.badgeOwned}>
            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
            <Text style={styles.badgeOwnedText}>Obtenu</Text>
          </View>
        )}
        {!owned && (
          <View style={styles.badgeLocked}>
            <Ionicons name="lock-closed" size={12} color="#9ca3af" />
          </View>
        )}
      </View>
    );
  };

  const renderRank = ({ item, index }) => {
    const isMe = item.id === user?.id;
    const color = RANK_COLORS[index] || '#6b7280';
    return (
      <View style={[styles.rankRow, isMe && styles.rankRowMe]}>
        <View style={[styles.rankBadge, { backgroundColor: color + '20' }]}>
          <Text style={[styles.rankNumber, { color }]}>#{index + 1}</Text>
        </View>
        <View style={styles.rankAvatar}>
          {item.photo ? (
            <Image source={{ uri: item.photo }} style={styles.rankAvatarImg} />
          ) : (
            <Text style={styles.rankAvatarText}>
              {(item.firstName?.[0] || '') + (item.lastName?.[0] || '')}
            </Text>
          )}
        </View>
        <View style={styles.rankInfo}>
          <Text style={[styles.rankName, isMe && styles.rankNameMe]}>
            {item.firstName} {item.lastName}
            {isMe ? ' (Moi)' : ''}
          </Text>
          <Text style={styles.rankRole}>
            {item.role === 'supervisor' ? 'Responsable' : 'Agent'}
          </Text>
        </View>
        <View style={styles.rankScore}>
          <Text style={[styles.rankPoints, { color }]}>{item.points || item.score || 0}</Text>
          <Text style={styles.rankPointsLabel}>pts</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 Badges & Classement</Text>
        <Text style={styles.headerSub}>{myBadges.length} badge{myBadges.length !== 1 ? 's' : ''} obtenu{myBadges.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'badges' && styles.tabActive]}
          onPress={() => setActiveTab('badges')}
        >
          <Text style={[styles.tabText, activeTab === 'badges' && styles.tabTextActive]}>Mes badges</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'leaderboard' && styles.tabActive]}
          onPress={() => setActiveTab('leaderboard')}
        >
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>Classement</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : activeTab === 'badges' ? (
        <FlatList
          data={allBadges}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          renderItem={renderBadge}
          contentContainerStyle={styles.badgeGrid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎖️</Text>
              <Text style={styles.emptyTitle}>Aucun badge disponible</Text>
              <Text style={styles.emptySubtitle}>Les badges seront disponibles prochainement</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={rankings}
          keyExtractor={(item, idx) => String(item.id || idx)}
          renderItem={renderRank}
          contentContainerStyle={styles.rankList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🏆</Text>
              <Text style={styles.emptyTitle}>Classement non disponible</Text>
              <Text style={styles.emptySubtitle}>Le classement sera disponible prochainement</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#78350f', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#fde68a', marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#f59e0b' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: '#f59e0b' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, color: '#6b7280' },
  errorText: { marginTop: 12, color: '#ef4444', textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: '#f59e0b', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  badgeGrid: { padding: 12, paddingBottom: 60 },
  badgeCard: { flex: 1, margin: 6, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3, borderWidth: 2, borderColor: '#f59e0b30' },
  badgeCardLocked: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb', opacity: 0.7 },
  badgeEmoji: { fontSize: 40, marginBottom: 8 },
  badgeName: { fontSize: 13, fontWeight: '700', color: '#111827', textAlign: 'center' },
  badgeNameLocked: { color: '#9ca3af' },
  badgeDesc: { fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 4 },
  badgeOwned: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  badgeOwnedText: { fontSize: 11, color: '#10b981', fontWeight: '600' },
  badgeLocked: { marginTop: 8 },
  rankList: { padding: 16, paddingBottom: 60 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  rankRowMe: { backgroundColor: '#fef3c7', borderWidth: 2, borderColor: '#f59e0b' },
  rankBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  rankNumber: { fontSize: 14, fontWeight: '800' },
  rankAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  rankAvatarImg: { width: 44, height: 44 },
  rankAvatarText: { fontSize: 18, fontWeight: '800', color: '#374151' },
  rankInfo: { flex: 1 },
  rankName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rankNameMe: { color: '#d97706' },
  rankRole: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  rankScore: { alignItems: 'flex-end' },
  rankPoints: { fontSize: 20, fontWeight: '800' },
  rankPointsLabel: { fontSize: 11, color: '#9ca3af' },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
});
