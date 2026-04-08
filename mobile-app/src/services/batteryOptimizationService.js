/**
 * 🔋 SERVICE OPTIMISATION BATTERIE
 * ===================================================
 * Demande à l'utilisateur d'exclure l'app de
 * l'optimisation batterie Android pour garantir
 * le fonctionnement du tracking en background.
 *
 * À appeler une seule fois après l'installation
 * (ex: depuis HomeScreen au premier démarrage).
 */

import { Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'batteryOptAsked';

/**
 * Demande l'exclusion de l'optimisation batterie.
 * Affiche une popup explicative avant d'ouvrir les paramètres.
 * Ne demande qu'une seule fois (mémorisé dans AsyncStorage).
 *
 * @param {boolean} force - Demander même si déjà demandé
 */
export async function requestBatteryOptimizationExclusion(force = false) {
  if (Platform.OS !== 'android') return;

  try {
    // Vérifier si déjà demandé
    if (!force) {
      const asked = await AsyncStorage.getItem(STORAGE_KEY);
      if (asked === 'true') return;
    }

    // Marquer comme demandé
    await AsyncStorage.setItem(STORAGE_KEY, 'true');

    // Afficher l'explication
    Alert.alert(
      '🔋 Optimisation Batterie',
      'Pour que le suivi GPS fonctionne en permanence (même écran éteint), ' +
      'cette application doit être exclue de l\'optimisation batterie.\n\n' +
      'Dans l\'écran suivant :\n' +
      '• Sélectionnez "Applications"\n' +
      '• Trouvez "Security Guard"\n' +
      '• Activez "Autoriser en arrière-plan" ou "Pas de restriction"',
      [
        {
          text: 'Ignorer',
          style: 'cancel',
        },
        {
          text: 'Configurer maintenant',
          onPress: () => {
            // Tenter d'ouvrir les paramètres d'optimisation batterie directement
            Linking.openURL('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS')
              .catch(() => {
                // Fallback: ouvrir les paramètres généraux
                Linking.openSettings();
              });
          },
        },
      ]
    );
  } catch (err) {
    console.warn('Battery optimization request failed:', err?.message);
  }
}

/**
 * Vérifier si l'app a déjà demandé l'optimisation batterie.
 */
export async function hasBatteryOptBeenAsked() {
  const asked = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  return asked === 'true';
}
