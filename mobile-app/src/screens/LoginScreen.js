import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../services/authStore';
import { wakeUpServer } from '../services/api';
import { getDeviceFingerprint, getDeviceInfo } from '../utils/deviceFingerprint';
import { API_URL } from '../config';
import { requestBatteryOptimizationExclusion } from '../services/batteryOptimizationService';
import soundEffects from '../utils/soundEffects';

const LoginScreen = ({ navigation }) => {
  const [loginMode, setLoginMode] = useState('agent'); // 'agent' ou 'supervisor'
  const [cin, setCin] = useState('');
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'ready' | 'waking'
  const { loginByCin, isLoading, error, clearError } = useAuthStore();

  // ── Animations ───────────────────────────────────────────────────────────
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(40)).current;
  const logoScale  = useRef(new Animated.Value(0.6)).current;
  const logoPulse  = useRef(new Animated.Value(1)).current;
  const formAnim   = useRef(new Animated.Value(0)).current;
  const btnScale   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance: logo pop-in → content fade+slide
    Animated.sequence([
      Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }),
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(formAnim,  { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  // Pulse animation on logo when server is waking
  useEffect(() => {
    if (serverStatus === 'waking') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoPulse, { toValue: 1.1, duration: 700, useNativeDriver: true }),
          Animated.timing(logoPulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      logoPulse.stopAnimation();
      Animated.spring(logoPulse, { toValue: 1, useNativeDriver: true }).start();
    }
  }, [serverStatus]);

  // Réveiller le serveur au montage
  useEffect(() => {
    const wake = async () => {
      try {
        const r = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) });
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
    // Retour haptique bouton
    soundEffects.playLoginStart();
    // Animation bouton press
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();

    const deviceFingerprint = await getDeviceFingerprint();
    const deviceInfo = await getDeviceInfo();
    const userType = loginMode === 'agent' ? 'agent' : 'supervisor';
    const result = await loginByCin(cin.toUpperCase().trim(), deviceFingerprint, deviceInfo, userType);

    if (!result.success) {
      soundEffects.playLoginError();
      Alert.alert('Erreur de connexion', result.error || 'CIN introuvable. Vérifiez votre numéro CIN.', [{ text: 'OK' }]);
    } else {
      soundEffects.playLoginSuccess();
      // Demander exclusion optimisation batterie après connexion réussie
      requestBatteryOptimizationExclusion();
    }
  };

  const isAgent = loginMode === 'agent';
  const accentColor = isAgent ? '#2563eb' : '#d97706';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Header / Logo */}
          <View style={styles.logoContainer}>
            <Animated.View style={{ transform: [{ scale: Animated.multiply(logoScale, logoPulse) }] }}>
              <View style={styles.logoGlow}>
                <View style={styles.logo}>
                  <Ionicons name="shield-checkmark" size={50} color="#fff" />
                </View>
              </View>
            </Animated.View>
            <Text style={styles.title}>Security Guard</Text>
            <Text style={styles.subtitle}>Système de pointage</Text>
          </View>

          {/* Indicateur statut serveur */}
          {serverStatus !== 'ready' && (
            <View style={styles.serverStatus}>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.serverStatusText}>
                {serverStatus === 'waking' ? '⏳ Démarrage du serveur (~30s)...' : '🔄 Vérification de la connexion...'}
              </Text>
            </View>
          )}

          {/* Sélecteur de rôle */}
          <Animated.View style={[styles.roleSelector, { opacity: formAnim }]}>
            <TouchableOpacity
              style={[styles.roleCard, isAgent && styles.roleCardActiveAgent]}
              onPress={() => { setLoginMode('agent'); clearError(); setCin(''); soundEffects.playSelection(); }}
              activeOpacity={0.8}
            >
              <View style={[styles.roleIconWrapper, isAgent && styles.roleIconWrapperAgent]}>
                <Ionicons name="shield-outline" size={28} color={isAgent ? '#fff' : '#2563eb'} />
              </View>
              <Text style={[styles.roleCardTitle, isAgent && styles.roleCardTitleActive]}>Agent</Text>
              <Text style={[styles.roleCardSub, isAgent && styles.roleCardSubActive]}>Pointage entrée / sortie</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleCard, !isAgent && styles.roleCardActiveSupervisor]}
              onPress={() => { setLoginMode('supervisor'); clearError(); setCin(''); soundEffects.playSelection(); }}
              activeOpacity={0.8}
            >
              <View style={[styles.roleIconWrapper, !isAgent && styles.roleIconWrapperSupervisor]}>
                <Ionicons name="people-outline" size={28} color={!isAgent ? '#fff' : '#d97706'} />
              </View>
              <Text style={[styles.roleCardTitle, !isAgent && styles.roleCardTitleActive]}>Responsable</Text>
              <Text style={[styles.roleCardSub, !isAgent && styles.roleCardSubActive]}>Supervision des agents</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Formulaire */}
          <Animated.View style={[styles.form, { opacity: formAnim, transform: [{ translateY: Animated.multiply(formAnim, new Animated.Value(-1)).interpolate({ inputRange: [-1, 0], outputRange: [0, 20] }) }] }]}>
            {/* Info rôle */}
            <View style={[styles.roleInfo, { backgroundColor: isAgent ? '#eff6ff' : '#fffbeb' }]}>
              <Ionicons name={isAgent ? 'shield-outline' : 'people-outline'} size={18} color={accentColor} />
              <Text style={[styles.roleInfoText, { color: isAgent ? '#1e40af' : '#92400e' }]}>
                {isAgent ? 'Connexion par CIN — Agent de sécurité' : "Connexion par CIN — Responsable d'équipe"}
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
            <View style={[styles.inputContainer, { borderColor: isAgent ? '#bfdbfe' : '#fde68a' }]}>
              <Ionicons name="card-outline" size={22} color={accentColor} style={styles.inputIcon} />
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
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: accentColor, shadowColor: accentColor }, isLoading && styles.buttonDisabled]}
                onPress={handleCinLogin}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.buttonInner}>
                    <Ionicons name="finger-print-outline" size={22} color="#fff" />
                    <Text style={styles.buttonText}>Se pointer</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>

            <Text style={styles.cinNote}>En cas de problème, contactez votre administrateur.</Text>
          </Animated.View>

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3a8a',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoGlow: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  logo: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  serverStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  serverStatusText: {
    color: '#fff',
    fontSize: 13,
    fontStyle: 'italic',
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleCardActiveAgent: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: '#93c5fd',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  roleCardActiveSupervisor: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: '#fde68a',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  roleIconWrapper: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  roleIconWrapperAgent: {
    backgroundColor: '#2563eb',
  },
  roleIconWrapperSupervisor: {
    backgroundColor: '#d97706',
  },
  roleCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  roleCardTitleActive: {
    color: '#111827',
  },
  roleCardSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  roleCardSubActive: {
    color: '#6b7280',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  roleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    gap: 8,
  },
  roleInfoText: {
    flex: 1,
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
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 20,
    height: 56,
    backgroundColor: '#f9fafb',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: '#111827',
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  button: {
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
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
