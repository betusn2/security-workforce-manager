/**
 * Plugin: withAndroid15Fix
 * ========================
 * Fixes crashes on Android 14+ (API 34+) and Android 15 (API 35):
 *
 * 1. Declares foregroundServiceType="location" on the Location service
 *    (required since Android 14 — without this, starting a foreground
 *    service with location crashes the app immediately)
 *
 * 2. Adds POST_NOTIFICATIONS permission (required since Android 13 / API 33)
 *
 * 3. Adds android:exported="false" on services that need it
 */

const { withAndroidManifest } = require('@expo/config-plugins');

const withAndroid15Fix = (config) => {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;

    // ── 1. Ensure uses-permission entries exist ───────────────────────────
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const addPermission = (name) => {
      const exists = manifest['uses-permission'].some(
        (p) => p.$?.['android:name'] === name
      );
      if (!exists) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    };

    addPermission('android.permission.POST_NOTIFICATIONS');
    addPermission('android.permission.FOREGROUND_SERVICE');
    addPermission('android.permission.FOREGROUND_SERVICE_LOCATION');

    // ── 2. Add foregroundServiceType="location" to expo-location service ──
    const app = manifest.application?.[0];
    if (!app) return mod;

    if (!app.service) {
      app.service = [];
    }

    // expo-location background task service
    const locationServiceName =
      'expo.modules.location.taskConsumers.LocationTaskConsumer';

    const existingService = app.service.find(
      (s) => s.$?.['android:name'] === locationServiceName
    );

    if (existingService) {
      // Update existing service to add foregroundServiceType
      existingService.$['android:foregroundServiceType'] = 'location';
      existingService.$['android:exported'] = 'false';
    } else {
      // Add service declaration
      app.service.push({
        $: {
          'android:name': locationServiceName,
          'android:foregroundServiceType': 'location',
          'android:exported': 'false',
        },
      });
    }

    // ── 3. Fix any service missing android:exported ────────────────────────
    // Android 12+ requires android:exported on services with intent-filters
    app.service.forEach((service) => {
      if (service['intent-filter'] && service.$?.['android:exported'] == null) {
        service.$['android:exported'] = 'false';
      }
    });

    return mod;
  });
};

module.exports = withAndroid15Fix;
