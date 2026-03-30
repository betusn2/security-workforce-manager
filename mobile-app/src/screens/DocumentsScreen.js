import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api from '../services/api';

const DOC_ICONS = {
  'application/pdf': { name: 'document-text', color: '#ef4444' },
  'image/jpeg': { name: 'image', color: '#3b82f6' },
  'image/png': { name: 'image', color: '#3b82f6' },
  default: { name: 'document', color: '#6b7280' },
};

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

export default function DocumentsScreen({ navigation }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get('/documents/my-documents');
      const raw = res?.data?.data;
      setDocuments(Array.isArray(raw) ? raw : (raw?.documents || []));
    } catch (err) {
      // Si l'endpoint n'existe pas encore, montrer liste vide sans erreur bloquante
      if (err?.response?.status === 404) {
        setDocuments([]);
      } else {
        setError('Impossible de charger les documents');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const onRefresh = () => { setRefreshing(true); fetchDocuments(); };

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];

      // Limite 5 Mo
      if (asset.size > 5 * 1024 * 1024) {
        Alert.alert('Fichier trop grand', 'La taille maximale est de 5 Mo');
        return;
      }

      setUploading(true);
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });

      await api.post('/documents/upload', {
        name: asset.name,
        type: asset.mimeType,
        size: asset.size,
        data: `data:${asset.mimeType};base64,${base64}`,
      });

      Alert.alert('Succès', 'Document téléversé avec succès');
      fetchDocuments();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Impossible de téléverser le document';
      Alert.alert('Erreur', msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      if (doc.url) {
        const canOpen = await Linking.canOpenURL(doc.url);
        if (canOpen) {
          await Linking.openURL(doc.url);
        } else {
          Alert.alert('Erreur', 'Impossible d\'ouvrir ce fichier');
        }
      } else {
        Alert.alert('Info', 'Lien de téléchargement non disponible');
      }
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de télécharger ce document');
    }
  };

  const handleDelete = (doc) => {
    Alert.alert(
      'Supprimer le document',
      `Voulez-vous supprimer "${doc.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/documents/${doc.id}`);
              setDocuments(prev => prev.filter(d => d.id !== doc.id));
            } catch (err) {
              Alert.alert('Erreur', 'Impossible de supprimer le document');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const iconInfo = DOC_ICONS[item.type] || DOC_ICONS.default;
    return (
      <View style={styles.docCard}>
        <View style={[styles.docIcon, { backgroundColor: iconInfo.color + '15' }]}>
          <Ionicons name={iconInfo.name} size={28} color={iconInfo.color} />
        </View>
        <View style={styles.docInfo}>
          <Text style={styles.docName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.docMeta}>
            {item.type?.split('/')[1]?.toUpperCase() || 'FICHIER'}
            {item.size ? ` • ${formatSize(item.size)}` : ''}
          </Text>
          {item.createdAt && (
            <Text style={styles.docDate}>
              {new Date(item.createdAt).toLocaleDateString('fr-FR')}
            </Text>
          )}
        </View>
        <View style={styles.docActions}>
          <TouchableOpacity onPress={() => handleDownload(item)} style={styles.actionBtn}>
            <Ionicons name="download-outline" size={20} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Upload FAB */}
      <TouchableOpacity
        style={[styles.fab, uploading && styles.fabDisabled]}
        onPress={handleUpload}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="cloud-upload" size={24} color="#fff" />
        )}
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Chargement des documents…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchDocuments}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>{documents.length} document{documents.length !== 1 ? 's' : ''}</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Aucun document</Text>
              <Text style={styles.emptySubtitle}>Appuyez sur le bouton + pour téléverser un document (PDF, image)</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  fab: { position: 'absolute', bottom: 28, right: 20, zIndex: 10, width: 56, height: 56, borderRadius: 28, backgroundColor: '#8b5cf6', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  fabDisabled: { backgroundColor: '#c4b5fd' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 14 },
  errorText: { marginTop: 12, color: '#ef4444', fontSize: 14, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  list: { padding: 16, paddingBottom: 100 },
  listHeader: { marginBottom: 12 },
  listHeaderText: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },
  docCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  docIcon: { width: 52, height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  docInfo: { flex: 1 },
  docName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  docMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  docDate: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  docActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 8 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
