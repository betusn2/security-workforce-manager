/**
 * 🛡️ AppLogo — Logo Professionnel "Security Workforce Manager"
 * =============================================================
 * Composant React Native réutilisable avec :
 *  - Bouclier animé avec effet de pulsation
 *  - Icône GPS/localisation intégrée
 *  - Texte "Security Workforce Manager"
 *  - Variantes : full | compact | icon-only
 *
 * Props :
 *  - size        : 'small' | 'medium' | 'large' (défaut: 'large')
 *  - variant     : 'full' | 'compact' | 'icon' (défaut: 'full')
 *  - animated    : boolean (défaut: true)
 *  - color       : string (défaut: '#2563eb')
 *  - textColor   : string (défaut: '#ffffff')
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
} from 'react-native';

const SIZES = {
  small:  { shield: 48, icon: 18, title: 13, subtitle: 10, badge: 14 },
  medium: { shield: 72, icon: 26, title: 17, subtitle: 12, badge: 18 },
  large:  { shield: 100, icon: 36, title: 22, subtitle: 14, badge: 24 },
};

export default function AppLogo({
  size = 'large',
  variant = 'full',
  animated = true,
  color = '#2563eb',
  textColor = '#ffffff',
}) {
  const pulse    = useRef(new Animated.Value(1)).current;
  const opacity  = useRef(new Animated.Value(0)).current;
  const slideY   = useRef(new Animated.Value(20)).current;
  const dims     = SIZES[size] || SIZES.large;

  useEffect(() => {
    // Apparition douce au montage
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideY,  { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    if (!animated) return;
    // Pulsation infinie
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    return () => pulse.stopAnimation();
  }, []);

  // ─── Badge sécurité dessiné avec des Views (aucun emoji) ────────────────────
  const ShieldIcon = () => {
    const bs  = dims.shield;       // badge size
    const inn = bs * 0.68;         // inner ring size
    const gps = dims.badge;        // GPS dot size
    return (
      <Animated.View style={[styles.shieldWrap, { transform: [{ scale: pulse }] }]}>
        {/* Halo externe */}
        <View style={[styles.shieldHalo, {
          width: bs * 1.6, height: bs * 1.6,
          borderRadius: bs * 0.8,
          backgroundColor: color + '18',
        }]} />
        {/* Halo interne */}
        <View style={[styles.shieldHaloInner, {
          width: bs * 1.25, height: bs * 1.25,
          borderRadius: bs * 0.625,
          backgroundColor: color + '30',
        }]} />

        {/* Cercle principal */}
        <View style={{
          width: bs, height: bs, borderRadius: bs / 2,
          backgroundColor: color,
          elevation: 10,
          shadowColor: color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Anneau blanc intérieur */}
          <View style={{
            width: inn, height: inn, borderRadius: inn / 2,
            borderWidth: 2.5,
            borderColor: 'rgba(255,255,255,0.75)',
            backgroundColor: 'rgba(255,255,255,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Lettres SG */}
            <Text style={{
              color: '#ffffff',
              fontSize: dims.icon * 0.9,
              fontWeight: '900',
              letterSpacing: 2,
              includeFontPadding: false,
            }}>SG</Text>
            {/* Ligne séparatrice */}
            <View style={{
              width: inn * 0.55, height: 1.5,
              backgroundColor: 'rgba(255,255,255,0.55)',
              marginTop: 2,
            }} />
            {/* Sous-texte */}
            <Text style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: dims.icon * 0.32,
              fontWeight: '700',
              letterSpacing: 1.5,
              marginTop: 2,
              includeFontPadding: false,
            }}>GUARD</Text>
          </View>
        </View>

        {/* GPS badge (cercle rouge + point blanc) — aucun emoji */}
        <View style={{
          position: 'absolute',
          width: gps, height: gps, borderRadius: gps / 2,
          backgroundColor: '#ef4444',
          right: bs * 0.04, bottom: bs * 0.04,
          borderWidth: 2.5, borderColor: '#ffffff',
          alignItems: 'center', justifyContent: 'center',
          elevation: 8,
        }}>
          <View style={{
            width: gps * 0.38, height: gps * 0.38,
            borderRadius: gps * 0.19,
            backgroundColor: '#ffffff',
          }} />
        </View>
      </Animated.View>
    );
  };

  if (variant === 'icon') {
    return (
      <Animated.View style={{ opacity, transform: [{ translateY: slideY }] }}>
        <ShieldIcon />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[styles.container, { opacity, transform: [{ translateY: slideY }] }]}
    >
      <ShieldIcon />

      {variant !== 'compact' && (
        <View style={styles.textBlock}>
          {/* Titre principal */}
          <Text style={[styles.title, { fontSize: dims.title, color: textColor }]}>
            SECURITY
          </Text>
          <Text style={[styles.titleAccent, { fontSize: dims.title * 1.15, color: color }]}>
            WORKFORCE
          </Text>
          <Text style={[styles.title, { fontSize: dims.title * 0.85, color: textColor }]}>
            MANAGER
          </Text>

          {/* Séparateur */}
          <View style={[styles.divider, { backgroundColor: color + '60' }]} />

          {/* Sous-titre */}
          <Text style={[styles.subtitle, { fontSize: dims.subtitle, color: textColor + 'aa' }]}>
            Surveillance • GPS • Sécurité
          </Text>
        </View>
      )}

      {variant === 'compact' && (
        <Text style={[styles.compactTitle, { fontSize: dims.title * 0.9, color: textColor }]}>
          <Text style={{ color }}> Security </Text>
          Workforce Manager
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  shieldWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldHalo: {
    position: 'absolute',
    alignSelf: 'center',
  },
  shieldHaloInner: {
    position: 'absolute',
    alignSelf: 'center',
  },

  textBlock: {
    marginTop: 16,
    alignItems: 'center',
  },
  title: {
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
  },
  titleAccent: {
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    marginVertical: 2,
  },
  divider: {
    width: 60,
    height: 1.5,
    marginVertical: 8,
    borderRadius: 1,
  },
  subtitle: {
    letterSpacing: 1.5,
    textAlign: 'center',
    fontWeight: '400',
  },
  compactTitle: {
    fontWeight: '700',
    marginTop: 10,
    letterSpacing: 1,
  },
});
