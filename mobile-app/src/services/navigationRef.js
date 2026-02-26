/**
 * navigationRef.js — Référence globale NavigationContainer
 * Permet de naviguer depuis n'importe quel service (authStore, socketService…)
 * sans prop de navigation.
 */
import { createRef } from 'react';

export const navigationRef = createRef();

export function navigateToLogin() {
  try {
    if (navigationRef.current?.isReady()) {
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  } catch (e) {
    console.warn('navigationRef: navigate failed', e);
  }
}
