/**
 * Plugin Expo: withBootReceiver
 * ===================================================
 * Ajoute le Boot Receiver dans AndroidManifest.xml
 * pour relancer automatiquement le tracking GPS
 * après redémarrage du téléphone.
 *
 * Installe également :
 * - REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
 * - WAKE_LOCK
 * - L'action BOOT_COMPLETED sur le receiver
 */

const { withAndroidManifest } = require('@expo/config-plugins');

const withBootReceiver = (config) => {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const app      = manifest.application?.[0];
    if (!app) return mod;

    // ── 1. Permissions WAKE_LOCK + battery optimization ──────────────────
    if (!manifest['uses-permission']) manifest['uses-permission'] = [];
    const addPermission = (name) => {
      const exists = manifest['uses-permission'].some(
        (p) => p.$?.['android:name'] === name
      );
      if (!exists) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    };

    addPermission('android.permission.WAKE_LOCK');
    addPermission('android.permission.RECEIVE_BOOT_COMPLETED');
    addPermission('android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS');
    addPermission('android.permission.FOREGROUND_SERVICE');
    addPermission('android.permission.FOREGROUND_SERVICE_LOCATION');

    // ── 2. Ajouter le receiver BOOT_COMPLETED ────────────────────────────
    if (!app.receiver) app.receiver = [];

    const bootReceiverName = 'com.securityguard.mobile.BootReceiver';
    const hasBootReceiver  = app.receiver.some(
      (r) => r.$?.['android:name'] === bootReceiverName
    );

    if (!hasBootReceiver) {
      app.receiver.push({
        $: {
          'android:name': bootReceiverName,
          'android:enabled': 'true',
          'android:exported': 'true',
          'android:permission': '',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
              { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
              { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
            ],
          },
        ],
      });
    }

    // ── 3. Service foreground type combiné (location + camera) ───────────
    if (app.service) {
      app.service.forEach((service) => {
        const name = service.$?.['android:name'] || '';
        if (
          name.toLowerCase().includes('taskconsumer') ||
          name.toLowerCase().includes('location') ||
          name.includes('BackgroundFetch')
        ) {
          // Ajouter WAKE_LOCK flag via foregroundServiceType
          if (!service.$['android:foregroundServiceType']) {
            service.$['android:foregroundServiceType'] = 'location';
          }
          service.$['android:exported'] = 'false';
        }
      });
    }

    // ── 4. Application: allowBackup et clearTextTraffic ──────────────────
    if (app.$) {
      app.$['android:allowBackup']        = 'false';
      app.$['android:largeHeap']          = 'true';
    }

    return mod;
  });
};

module.exports = withBootReceiver;
