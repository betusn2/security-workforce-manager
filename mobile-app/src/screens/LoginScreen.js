import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../services/authStore';
import { wakeUpServer } from '../services/api';

const LoginScreen = ({ navigation }) => {
  const [loginMode, setLoginMode] = useState('agent'); // 'agent' ou 'supervisor'
  const [cin, setCin] = useState('');
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'ready' | 'waking'
  const { loginByCin, isLoading, error, clearError } = useAuthStore();

  // Réveiller le serveur au montage
  useEffect(() => {
    const wake = async () => {
      try {
        const r = await fetch(`https://security-workforce-manager.onrender.com/api/health`, { signal: AbortSignal.timeout(5000) });
        if (r.ok) { setServerStatus('ready'); return; }
      } catch (_) {}
      setServerStatus('waking');
      await wakeUpServer();
      setServerStatus('ready');
    };
    wake();
  }, []);

  const handleCinLogin = async () => {
    if (!cin) {
      Alert.alert('Erreur', 'Veuillez entrer votre numéro CIN');
      return;
    }

    clearError();
    const userType = loginMode === 'agent' ? 'agent' : 'supervisor';
    const result = await loginByCin(cin.toUpperCase().trim(), null, userType);

    if (!result.success) {
      Alert.alert(
        'Erreur de connexion',
        result.error || 'CIN introuvable. Vérifiez votre numéro CIN.',
        [{ text: 'OK' }]
      );
    }
    // Si succès, AppNavigator détecte isCheckInMode=true et affiche CheckIn automatiquement
  };

  const isAgent = loginMode === 'agent';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>

          {/* Header / Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Ionicons name="shield-checkmark" size={42} color="#2563eb" />
            </View>
            <Text style={styles.title}>Security Guard</Text>
            <Text style={styles.subtitle}>Système de pointage</Text>
          </View>

          {/* Indicateur statut serveur */}
          {serverStatus !== 'ready' && (
            <View style={styles.serverStatus}>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.serverStatusText}>
                {serverStatus === 'waking'
                  ? '⏳ Démarrage du serveur (~30s)...'
                  : '🔄 Vérification de la connexion...'}
              </Text>
            </View>
          )}

          {/* Sélecteur de rôle */}
          <View style={styles.roleSelector}>
            <TouchableOpacity
              style={[styles.roleCard, isAgent && styles.roleCardActive]}
              onPress={() => { setLoginMode('agent'); clearError(); setCin(''); }}
              activeOpacity={0.8}
            >
              <View style={[styles.roleIconWrapper, isAgent && styles.roleIconWrapperActive]}>
                <Ionicons name="shield-outline" size={28} color={isAgent ? '#fff' : '#2563eb'} />
              </View>
              <Text style={[styles.roleCardTitle, isAgent && styles.roleCardTitleActive]}>Agent</Text>
              <Text style={[styles.roleCardSub, isAgent && styles.roleCardSubActive]}>Pointage d'entrée / sortie</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleCard, !isAgent && styles.roleCardActive]}
              onPress={() => { setLoginMode('supervisor'); clearError(); setCin(''); }}
              activeOpacity={0.8}
            >
              <View style={[styles.roleIconWrapper, !isAgent && styles.roleIconWrapperActive]}>
                <Ionicons name="people-outline" size={28} color={!isAgent ? '#fff' : '#2563eb'} />
              </View>
              <Text style={[styles.roleCardTitle, !isAgent && styles.roleCardTitleActive]}>Responsable</Text>
              <Text style={[styles.roleCardSub, !isAgent && styles.roleCardSubActive]}>Supervision des agents</Text>
            </TouchableOpacity>
          </View>

          {/* Formulaire */}
          <View style={styles.form}>
            {/* Info rôle */}
            <View style={styles.roleInfo}>
              <Ionicons
                name={isAgent ? 'shield-outline' : 'people-outline'}
                size={18}
                color="#2563eb"
              />
              <Text style={styles.roleInfoText}>
                {isAgent
                  ? 'Connexion par CIN — Agent de sécurité'
                  : 'Connexion par CIN — Responsable d\'équipe'}
              </Text>
            </View>

            {/* Message d'erreur */}
            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Champ CIN */}
            <Text style={styles.inputLabel}>Numéro CIN</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="card-outline" size={22} color="#2563eb" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ex: A303730"
                placeholderTextColor="#aaa"
                value={cin}
                onChangeText={setCin}
                autoCapitalize="characters"
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={handleCinLogin}
              />
              {cin.length > 0 && (
                <TouchableOpacity onPress={() => setCin('')}>
                  <Ionicons name="close-circle" size={20} color="#ccc" />
                </TouchableOpacity>
              )}
            </View>

            {/* Bouton Pointer */}
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleCinLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.buttonInner}>
                  <Ionicons name="finger-print-outline" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Pointer</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.cinNote}>
              En cas de problème, contactez votre administrateur.
            </Text>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1d4ed8',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    paddingTop: 64,
    paddingBottom: 40,
  },

  // Header
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.3,
  },

  // Statut serveur
  serverStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  serverStatusText: {
    color: '#fff',
    fontSize: 13,
    fontStyle: 'italic',
  },

  // Sélecteur de rôle (cartes)
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleCardActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  roleIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleIconWrapperActive: {
    backgroundColor: '#2563eb',
  },
  roleCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  roleCardTitleActive: {
    color: '#1d4ed8',
  },
  roleCardSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  roleCardSubActive: {
    color: '#6b7280',
  },

  // Formulaire
  form: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  roleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 18,
    gap: 8,
  },
  roleInfoText: {
    flex: 1,
    color: '#1e40af',
    fontSize: 13,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 13,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
    height: 54,
    backgroundColor: '#f9fafb',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: '#111827',
    fontWeight: '500',
    letterSpacing: 1,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cinNote: {
    color: '#9ca3af',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 16,
  },
});

export default LoginScreen;
