/**
 * AUTO FACIAL CHECK-IN — v4 Fast (< 400ms)
 * ==========================================
 * Reconnaissance CONTINUE — 0 clic requis.
 *  - Capture toutes les 1.0s (pas de compte a rebours)
 *  - Image 480px / qualite 0.55 → ~15KB base64
 *  - Endpoint /verify-fast : cache evenement en RAM → ~200-400ms
 *  - Guide intelligent : lunettes, eclairage, distance, position
 *  - Score anime en temps reel
 *  - Validation AUTOMATIQUE des que score >= 50%
 *  - Succes immediat -> callback onSuccess -> auto-soumission du pointage
 *
 * Props :
 *   userId        : ID de l'utilisateur
 *   eventId       : ID de l'evenement (pour cache fast-verify)
 *   onSuccess     : (score, photo) => void
 *   onMaxAttempts : () => void
 *   onCancel      : () => void
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Vibration,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { facialAPI } from '../services/api';

const { width: W, height: H } = Dimensions.get('window');

// ── Config ────────────────────────────────────────────────────────────────
const MIN_SCORE   = 50;    // seuil de validation (%)
const MAX_NO_FACE = 8;     // frames sans visage avant abandon
const CAPTURE_MS  = 1000;  // intervalle entre captures (ms) — réduit de 1600→1000ms

// ── Ovale centre horizontal & vertical ────────────────────────────────────
const OVAL_W    = Math.round(W * 0.64);
const OVAL_H    = Math.round(OVAL_W * 1.28);
const OVAL_TOP  = Math.round((H - OVAL_H) / 2 - 45);
const OVAL_LEFT = Math.round((W - OVAL_W) / 2);

// ── Messages de guidage ────────────────────────────────────────────────────
const GUIDE = {
  init:     { icon: 'scan-outline',          msg: 'Positionnez votre visage dans le cadre',        color: '#64748b' },
  noFace:   { icon: 'scan-outline',          msg: 'Placez votre visage dans le cadre',             color: '#ef4444' },
  tooFar:   { icon: 'arrow-forward-outline', msg: 'Rapprochez-vous de la camera',                  color: '#ef4444' },
  glasses:  { icon: 'glasses-outline',       msg: 'Retirez vos lunettes / ameliorez l\'eclairage', color: '#f59e0b' },
  lighting: { icon: 'sunny-outline',         msg: 'Ameliorez l\'eclairage (evitez les ombres)',    color: '#f59e0b' },
  almost:   { icon: 'ellipse-outline',       msg: 'Presque ! Restez parfaitement immobile...',     color: '#eab308' },
  good:     { icon: 'checkmark-circle',      msg: 'Identite confirmee !',                          color: '#10b981' },
  server:   { icon: 'cloud-offline-outline', msg: 'Connexion en cours... Patientez',               color: '#64748b' },
};

export default function AutoFacialCheckIn({ userId, eventId, onSuccess, onMaxAttempts, onCancel }) {
  const [permission, setPermission] = useState(null);
  const [phase,      setPhase]      = useState('init');   // init|scanning|success|blocked
  const [liveScore,  setLiveScore]  = useState(null);
  const [guide,      setGuide]      = useState(GUIDE.init);
  const [scanning,   setScanning]   = useState(false);

  const cameraRef   = useRef(null);
  const cameraReady = useRef(false);
  const intervalRef = useRef(null);
  const inFlight    = useRef(false);
  const noFaceCount = useRef(0);
  const lowCount    = useRef(0);
  const userIdRef   = useRef(userId);
  const eventIdRef  = useRef(eventId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { eventIdRef.current = eventId; }, [eventId]);

  // ── Animations ────────────────────────────────────────────────────────
  const scoreAnim   = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  // Pulsation de l'ovale
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.035, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,     duration: 900, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, []);

  // ── Permission camera ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setPermission(status === 'granted');
      if (status === 'granted') {
        setTimeout(() => setPhase('scanning'), 900);
      }
    })();
    return () => clearInterval(intervalRef.current);
  }, []);

  // ── Boucle de capture (demarre quand phase='scanning') ────────────────
  useEffect(() => {
    if (phase === 'scanning') {
      clearInterval(intervalRef.current);
      const t = setTimeout(() => {
        doCapture();
        intervalRef.current = setInterval(doCapture, CAPTURE_MS);
      }, 700);
      return () => { clearTimeout(t); clearInterval(intervalRef.current); };
    } else {
      clearInterval(intervalRef.current);
    }
  }, [phase]);

  // ── Guide intelligent ─────────────────────────────────────────────────
  const computeGuide = useCallback((faceDetected, score) => {
    if (!faceDetected) return GUIDE.noFace;
    if (score < 20)         return lowCount.current >= 3 ? GUIDE.glasses : GUIDE.tooFar;
    if (score < 35)         return GUIDE.lighting;
    if (score < MIN_SCORE)  return GUIDE.almost;
    return GUIDE.good;
  }, []);

  // ── Capture + analyse ─────────────────────────────────────────────────
  const doCapture = useCallback(async () => {
    if (inFlight.current)                          return;
    if (!cameraRef.current || !cameraReady.current) return;

    inFlight.current = true;
    setScanning(true);

    try {
      const raw = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: false,
      });

      // 480px width + compress 0.55 → ~15KB base64 (vs 80KB avant)
      const compressed = await ImageManipulator.manipulateAsync(
        raw.uri,
        [{ resize: { width: 480 } }],
        { compress: 0.55, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      // Utilise /verify-fast si eventId disponible (cache RAM → ~200ms)
      // Sinon fallback sur /verify classique
      const apiCall = eventIdRef.current
        ? facialAPI.verifyFast({
            userId:  userIdRef.current,
            image:   `data:image/jpeg;base64,${compressed.base64}`,
            eventId: eventIdRef.current,
          })
        : facialAPI.verifyCheckin({
            userId: userIdRef.current,
            image:  `data:image/jpeg;base64,${compressed.base64}`,
          });

      const res  = await apiCall;

      const data  = res.data?.data || res.data;
      const raw_s = data?.score ?? data?.similarity ?? data?.confidence ?? 0;
      const score = typeof raw_s === 'number'
        ? (raw_s <= 1 ? Math.round(raw_s * 100) : Math.round(raw_s))
        : 0;

      const faceOk = data?.faceDetected !== false && data?.errorCode !== 'NO_FACE';
      console.log('[FacialRT] score=', score, 'face=', faceOk, 'errorCode=', data?.errorCode);

      // Score anime
      setLiveScore(score);
      Animated.timing(scoreAnim, {
        toValue:  score / 100,
        duration: 350,
        useNativeDriver: false,
      }).start();

      // Compteur scores bas (< 25) pour detecter lunettes/eclairage
      if (score < 25) lowCount.current += 1;
      else            lowCount.current  = 0;

      setGuide(computeGuide(faceOk, score));

      // ─── SUCCES → validation immediate ──────────────────────────────
      if (score >= MIN_SCORE) {
        clearInterval(intervalRef.current);
        Vibration.vibrate([0, 80, 60, 80]);
        setPhase('success');
        Animated.spring(successAnim, {
          toValue: 1, tension: 65, friction: 8, useNativeDriver: true,
        }).start();
        // Appel immediat → le parent soumet le pointage automatiquement
        setTimeout(() => onSuccess(score, compressed), 1000);
        return;
      }

      // Compteur absence visage
      if (!faceOk) {
        noFaceCount.current += 1;
        if (noFaceCount.current >= MAX_NO_FACE) {
          clearInterval(intervalRef.current);
          setPhase('blocked');
          setTimeout(() => onMaxAttempts?.(), 1200);
        }
      } else {
        noFaceCount.current = 0;
      }

    } catch (err) {
      const ec = err.response?.data?.errorCode;
      if (err.response?.status === 503 || ec === 'SERVICE_UNAVAILABLE') {
        setGuide(GUIDE.server);
      } else {
        console.error('[FacialRT]', err.response?.data?.debug || err.message);
      }
    } finally {
      inFlight.current = false;
      setScanning(false);
    }
  }, [onSuccess, onMaxAttempts, computeGuide]);

  // ── RENDU ─────────────────────────────────────────────────────────────

  if (permission === false) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-off-outline" size={48} color="#ef4444" />
        <Text style={styles.permTitle}>Camera non autorisee</Text>
        <Text style={styles.permText}>Autorisez l'acces dans les parametres.</Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'blocked') {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed" size={56} color="#ef4444" />
        <Text style={styles.blockedTitle}>Acces refuse</Text>
        <Text style={styles.blockedTxt}>Impossible de detecter votre visage.</Text>
        <Text style={styles.blockedSub}>Verifiez l'eclairage et la position.</Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelTxt}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ovalColor = liveScore === null ? '#475569'
    : liveScore >= MIN_SCORE ? '#10b981'
    : liveScore >= 35        ? '#eab308'
    : liveScore >= 20        ? '#f59e0b'
    :                          '#ef4444';

  return (
    <View style={styles.wrapper}>

      {/* ── Camera fullscreen ── */}
      {phase !== 'success' && (
        <>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            type={CameraType.front}
            onCameraReady={() => { cameraReady.current = true; }}
          />

          {/* Vignettes sombres autour de l'ovale */}
          <View style={[styles.vig, { top: 0, left: 0, right: 0, height: OVAL_TOP }]} />
          <View style={[styles.vig, { top: OVAL_TOP + OVAL_H, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.vig, { top: OVAL_TOP, left: 0, width: OVAL_LEFT, height: OVAL_H }]} />
          <View style={[styles.vig, { top: OVAL_TOP, right: 0, left: OVAL_LEFT + OVAL_W, height: OVAL_H }]} />

          {/* Ovale pulse */}
          <Animated.View style={[styles.ovalFrame, {
            top: OVAL_TOP, left: OVAL_LEFT,
            width: OVAL_W, height: OVAL_H,
            borderColor: ovalColor,
            transform: [{ scale: pulseAnim }],
          }]}>
            <View style={[styles.ovalHalo, { borderColor: ovalColor }]} />
            {scanning && (
              <View style={styles.analysisSpinner}>
                <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" />
              </View>
            )}
          </Animated.View>

          {/* Barre superieure */}
          <View style={styles.topBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="person-circle-outline" size={16} color="#93c5fd" />
              <Text style={styles.topBarTitle}>Reconnaissance Faciale</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {scanning && <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />}
              <View style={[styles.liveDot, {
                backgroundColor: scanning ? '#f59e0b' : phase === 'scanning' ? '#10b981' : '#475569',
              }]} />
            </View>
          </View>

          {/* Zone score + guide sous l'ovale */}
          <View style={[styles.bottomZone, { top: OVAL_TOP + OVAL_H + 14 }]}>

            {/* Barre de score */}
            {liveScore !== null && (
              <View style={styles.scoreLine}>
                <View style={styles.scoreBarBg}>
                  <Animated.View style={[styles.scoreBarFill, {
                    width: scoreAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    backgroundColor: ovalColor,
                  }]} />
                  {/* Marqueur seuil 50% */}
                  <View style={styles.marker50} />
                </View>
                <Text style={[styles.scoreNum, { color: ovalColor }]}>{liveScore}%</Text>
              </View>
            )}

            {/* Message de guidage */}
            <View style={[styles.guideRow, { borderColor: guide.color + '40' }]}>
              <Ionicons name={guide.icon} size={14} color={guide.color} />
              <Text style={[styles.guideTxt, { color: guide.color }]}>{guide.msg}</Text>
            </View>

            <Text style={styles.threshold}>Seuil {MIN_SCORE}% • Analyse automatique</Text>
          </View>

          {/* Bouton annuler */}
          <TouchableOpacity
            style={styles.cancelFloat}
            onPress={() => { clearInterval(intervalRef.current); onCancel?.(); }}
          >
            <Ionicons name="close-circle" size={30} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
        </>
      )}

      {/* ── Overlay succes ── */}
      {phase === 'success' && (
        <Animated.View style={[styles.successOverlay, { opacity: successAnim }]}>
          <Animated.View style={[styles.successCircle, {
            transform: [{ scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          }]}>
            <Ionicons name="checkmark" size={72} color="#fff" />
          </Animated.View>
          <Text style={styles.successTitle}>Identite verifiee !</Text>
          <Text style={styles.successScore}>{liveScore}% — Pointage en cours...</Text>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" style={{ marginTop: 16 }} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#000' },

  vig: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.60)',
  },

  ovalFrame: {
    position: 'absolute',
    borderRadius: 1000,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  ovalHalo: {
    position: 'absolute',
    width:  OVAL_W + 18,
    height: OVAL_H + 18,
    borderRadius: 1000,
    borderWidth: 2,
    opacity: 0.35,
  },
  analysisSpinner: {
    position: 'absolute',
    bottom: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 5,
  },

  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  topBarTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  liveDot: { width: 8, height: 8, borderRadius: 4 },

  bottomZone: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  scoreLine: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
  },
  scoreBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
  },
  scoreBarFill: {
    height: 8,
    borderRadius: 4,
  },
  marker50: {
    position: 'absolute',
    left: '50%',
    top: -3,
    width: 2,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 1,
  },
  scoreNum: {
    fontSize: 22,
    fontWeight: '900',
    minWidth: 52,
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  guideTxt: {
    fontSize: 13,
    fontWeight: '700',
  },
  threshold: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    textAlign: 'center',
  },

  cancelFloat: {
    position: 'absolute',
    top: 14, right: 14,
  },

  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,185,129,0.93)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  successCircle: {
    width: 120, height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  successTitle: { color: '#fff', fontSize: 28, fontWeight: '900' },
  successScore: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '600' },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    padding: 32,
    backgroundColor: '#0f172a',
  },
  permTitle:    { color: '#fff',     fontSize: 20, fontWeight: '700' },
  permText:     { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' },
  blockedTitle: { color: '#ef4444', fontSize: 24, fontWeight: '900' },
  blockedTxt:   { color: '#fff',    fontSize: 15, textAlign: 'center' },
  blockedSub:   { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' },
  cancelBtn: {
    backgroundColor: '#334155', borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 4,
  },
  cancelTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
