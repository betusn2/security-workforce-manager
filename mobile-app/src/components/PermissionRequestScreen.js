/**
 * 🔐 ÉCRAN D'AUTORISATION PREMIER LANCEMENT
 * ==========================================
 * Affiché UNE SEULE FOIS lors du premier démarrage de l'application.
 * Demande toutes les permissions nécessaires avec des explications claires.
 *
 * Flux :
 *  1. GPS (premier plan)   — suivi en temps réel quand l'app est ouverte
 *  2. GPS (arrière-plan)   — suivi même écran verrouillé / app fermée
 *  3. Caméra               — reconnaissance faciale pour pointer
 *  4. Notifications        — alertes de sécurité et messages superviseur
 *  5. Optimisation batterie — empêcher Android d'endormir l'application
 *
 * Une fois terminé, appelle onDone() → L'app démarre normalement.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import AppLogo from './AppLogo';
import { requestAllPermissions, hasPermissionsBeenRequested } from '../services/permissionManager';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const PERMISSION_STEPS = [
  {
    key:     'location',
    emoji:   '📍',
    title:   'GPS (Premier plan)',
    desc:    'Permet de suivre votre position lorsque l\'application est ouverte ou visible.',
    why:     'Obligatoire pour valider votre présence sur site.',
    color:   '#3b82f6',
    bg:      '#eff6ff',
  },
  {
    key:     'locationBackground',
    emoji:   '🌍',
    title:   'GPS (Arrière-plan)',
    desc:    'Continue le suivi même quand l\'écran est verrouillé ou l\'app fermée.',
    why:     'Obligatoire pour la sécurité permanente hors site.',
    color:   '#8b5cf6',
    bg:      '#f5f3ff',
  },
  {
    key:     'camera',
    emoji:   '📸',
    title:   'Caméra',
    desc:    'Utilisée pour la reconnaissance faciale lors du pointage automatique.',
    why:     'Votre visage est analysé localement, non stocké dans le cloud.',
    color:   '#10b981',
    bg:      '#ecfdf5',
  },
  {
    key:     'notifications',
    emoji:   '🔔',
    title:   'Notifications',
    desc:    'Reçoit les alertes de sécurité, messages du superviseur et rappels.',
    why:     'Pour vous avertir immédiatement en cas d\'urgence.',
    color:   '#f59e0b',
    bg:      '#fffbeb',
  },
  {
    key:     'batteryOptimization',
    emoji:   '⚡',
    title:   'Optimisation batterie',
    desc:    'Empêche Android de mettre l\'application en veille automatiquement.',
    why:     'Garantit un suivi GPS continu sans interruption.',
    color:   '#ef4444',
    bg:      '#fef2f2',
  },
];

// ─── Indicateur de progression ────────────────────────────────────────────────
function StepDot({ active, done, color }) {
  return (
    <View style={[
      styles.dot,
      done  && { backgroundColor: color, borderColor: color },
      active && { borderColor: color, borderWidth: 2.5 },
    ]}>
      {done && <Text style={styles.dotCheck}>✓</Text>}
    </View>
  );
}

// ─── Carte de permission ──────────────────────────────────────────────────────
function PermissionCard({ step, granted, active }) {
  const scale = useRef(new Animated.Value(active ? 1 : 0.95)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1 : 0.95,
      useNativeDriver: true,
    }).start();
  }, [active]);

  return (
    <Animated.View style={[
      styles.card,
      { backgroundColor: step.bg, transform: [{ scale }] },
      active && { ...styles.cardActive, borderColor: step.color },
      granted && { opacity: 0.75 },
    ]}>
      <View style={[styles.cardIconWrap, { backgroundColor: step.color + '20' }]}>
        <Text style={styles.cardEmoji}>{step.emoji}</Text>
        {granted && (
          <View style={[styles.checkBadge, { backgroundColor: step.color }]}>
            <Text style={styles.checkBadgeText}>✓</Text>
          </View>
        )}
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, active && { color: step.color }]}>
          {step.title}
        </Text>
        <Text style={styles.cardDesc}>{step.desc}</Text>
        <Text style={[styles.cardWhy, { color: step.color }]}>
          ℹ️ {step.why}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function PermissionRequestScreen({ onDone }) {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = écran d'accueil
  const [permissions, setPermissions]  = useState({});
  const [loading, setLoading]          = useState(false);
  const [allDone, setAllDone]          = useState(false);
  const [error, setError]              = useState(null);

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(30)).current;
  const progressW  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (currentStep >= 0) {
      const pct = ((currentStep + 1) / PERMISSION_STEPS.length) * 100;
      Animated.timing(progressW, {
        toValue: pct,
        duration: 400,
        useNativeDriver: false,
      }).start();
    }
  }, [currentStep]);

  const startPermissions = async () => {
    setLoading(true);
    setCurrentStep(0);
    try {
      await requestAllPermissions((stepIndex, key, status) => {
        setCurrentStep(stepIndex);
        setPermissions(prev => ({ ...prev, [key]: status }));
      });
      setAllDone(true);
    } catch (err) {
      setError('Une erreur est survenue. Vous pourrez configurer les autorisations depuis les paramètres.');
      setAllDone(true);
    }
    setLoading(false);
  };

  const grantedCount = Object.values(permissions).filter(v => v === 'granted').length;

  // ─── Écran final (résumé)
  if (allDone) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#1e3a5f" />
        <View style={styles.gradient}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <AppLogo size="medium" color="#60a5fa" textColor="#ffffff" />
            <View style={styles.summaryBox}>
              <Text style={styles.summaryEmoji}>
                {grantedCount === PERMISSION_STEPS.length ? '🎉' : '⚠️'}
              </Text>
              <Text style={styles.summaryTitle}>
                {grantedCount === PERMISSION_STEPS.length
                  ? 'Parfait ! Tout est configuré'
                  : `${grantedCount}/${PERMISSION_STEPS.length} autorisations accordées`}
              </Text>
              <Text style={styles.summarySubtitle}>
                {grantedCount === PERMISSION_STEPS.length
                  ? 'L\'application est prête à fonctionner en mode sécurité maximale.'
                  : 'Certaines fonctionnalités peuvent être limitées. Vous pouvez les activer dans les Paramètres.'}
              </Text>
            </View>

            {PERMISSION_STEPS.map(step => (
              <View key={step.key} style={styles.summaryRow}>
                <Text style={styles.summaryEmojism}>{step.emoji}</Text>
                <Text style={styles.summaryLabel}>{step.title}</Text>
                <Text style={[
                  styles.summaryStatus,
                  { color: permissions[step.key] === 'granted' ? '#4ade80' : '#fbbf24' },
                ]}>
                  {permissions[step.key] === 'granted' ? '✓ Accordée' : '✗ Refusée'}
                </Text>
              </View>
            ))}

            <TouchableOpacity style={styles.btnStart} onPress={onDone} activeOpacity={0.85}>
              <Text style={styles.btnStartText}>🚀 Commencer</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Écran d'accueil (avant de commencer)
  if (currentStep === -1) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#1e3a5f" />
        <View style={styles.gradient}>
          <Animated.View style={[
            styles.welcomeContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}>
            <AppLogo size="large" color="#60a5fa" textColor="#ffffff" />

            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeTitle}>Autorisations nécessaires</Text>
              <Text style={styles.welcomeText}>
                Pour assurer votre sécurité et celle de vos collègues, cette application
                a besoin de {PERMISSION_STEPS.length} autorisations.
              </Text>
              <Text style={styles.welcomeText}>
                Chaque autorisation sera expliquée clairement. Vous pouvez les modifier
                à tout moment dans les <Text style={styles.bold}>Paramètres</Text> de votre téléphone.
              </Text>

              {/* Liste rapide */}
              {PERMISSION_STEPS.map(step => (
                <View key={step.key} style={styles.quickRow}>
                  <Text style={styles.quickEmoji}>{step.emoji}</Text>
                  <Text style={styles.quickLabel}>{step.title}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.btnStart, { marginTop: 24 }]}
              onPress={startPermissions}
              activeOpacity={0.85}
            >
              <Text style={styles.btnStartText}>🔑 Configurer les autorisations</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onDone} style={styles.skipBtn}>
              <Text style={styles.skipText}>Ignorer pour l'instant</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Fluide de permissions étape par étape
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a5f" />
      <View style={styles.gradient}>
        <View style={styles.progressBarWrap}>
          <Animated.View style={[
            styles.progressBar,
            {
              width: progressW.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepCounter}>
            {currentStep + 1} / {PERMISSION_STEPS.length}
          </Text>
          <Text style={styles.stepHeading}>Configuration en cours…</Text>

          {/* Indicateurs de pas */}
          <View style={styles.dotRow}>
            {PERMISSION_STEPS.map((step, i) => (
              <StepDot
                key={step.key}
                active={i === currentStep}
                done={i < currentStep || (allDone && permissions[step.key] === 'granted')}
                color={step.color}
              />
            ))}
          </View>

          {/* Cartes des permissions */}
          {PERMISSION_STEPS.map((step, i) => (
            <PermissionCard
              key={step.key}
              step={step}
              granted={permissions[step.key] === 'granted'}
              active={i === currentStep}
            />
          ))}

          {loading && (
            <Text style={styles.loadingText}>
              ⏳ En attente de votre réponse…
            </Text>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  gradient: { flex: 1, backgroundColor: '#1e3a5f' },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Barre de progression
  progressBarWrap: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: '100%',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#60a5fa',
    borderRadius: 2,
  },

  // Bienvenue
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    paddingTop: 40,
  },
  welcomeCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 20,
    marginTop: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  welcomeTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  welcomeText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
    textAlign: 'center',
  },
  bold: { fontWeight: '700', color: '#93c5fd' },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  quickEmoji: { fontSize: 18, marginRight: 10 },
  quickLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },

  // Étape par étape
  stepCounter: {
    color: '#93c5fd',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  stepHeading: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 20,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCheck: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Carte permission
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    width: '100%',
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'flex-start',
  },
  cardActive: {
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  cardEmoji: { fontSize: 26 },
  checkBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  cardText: { flex: 1 },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 5,
  },
  cardWhy: {
    fontSize: 11.5,
    fontStyle: 'italic',
  },

  // Bouton
  btnStart: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  btnStartText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  skipBtn: { marginTop: 14, padding: 8 },
  skipText:  { color: 'rgba(255,255,255,0.45)', fontSize: 13 },

  // Loading
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },

  // Résumé
  summaryBox: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 10,
  },
  summaryEmoji: { fontSize: 52, marginBottom: 10 },
  summaryTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  summarySubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  summaryEmojism: { fontSize: 20, marginRight: 10, width: 28 },
  summaryLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, flex: 1 },
  summaryStatus: { fontSize: 13, fontWeight: '700' },
});
