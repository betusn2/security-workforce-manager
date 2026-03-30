/**
 * Composant indicateur de statut du tracking GPS en arrière-plan.
 * Affiche une bannière si le tracking est actif avec un bouton pour l'arrêter.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { BACKGROUND_LOCATION_TASK, stopBackgroundTracking } from '../services/backgroundLocationTask';

export default function TrackingStatusBanner() {
  const [isTracking, setIsTracking] = useState(false);
  const pulse = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const check = async () => {
      try {
        const active = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        setIsTracking(active);
      } catch {}
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isTracking) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isTracking]);

  const handleStop = async () => {
    await stopBackgroundTracking();
    setIsTracking(false);
  };

  if (!isTracking) return null;

  return (
    <View style={styles.banner}>
      <Animated.View style={[styles.dot, { opacity: pulse }]} />
      <Ionicons name="location" size={14} color="#fff" />
      <Text style={styles.text}>Suivi GPS actif</Text>
      <TouchableOpacity onPress={handleStop} style={styles.stopBtn}>
        <Ionicons name="stop-circle" size={16} color="#fff" />
        <Text style={styles.stopText}>Arrêter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6ee7b7',
  },
  text: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stopText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
