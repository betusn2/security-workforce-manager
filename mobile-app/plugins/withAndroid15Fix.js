/**
 * Plugin: withAndroid15Fix
 * ========================
 * Fixes crashes on Android 14+ (API 34) and Android 15 (API 35) / ColorOS 15.
 *
 * Android 14 breaking changes that cause immediate launch crashes:
 * 1. ALL foreground services MUST declare android:foregroundServiceType
 * 2. ALL components with intent-filters MUST have android:exported
 * 3. POST_NOTIFICATIONS required since Android 13
 * 4. SCHEDULE_EXACT_ALARM behavior changed (SecurityException if missing)
 * 5. Firebase/FCM services need android:exported="true"
 */

const { withAndroidManifest } = require('@expo/config-plugins');

const withAndroid15Fix = (config) => {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;

    // ── 1. Permissions required for Android 13/14/15 ─────────────────────
    if (!manifest['uses-permission']) manifest['uses-permission'] = [];

    const addPermission = (name, attrs = {}) => {
      const exists = manifest['uses-permission'].some(
        (p) => p.$?.['android:name'] === name
      );
      if (!exists) {
        manifest['uses-permission'].push({ $: { 'android:name': name, ...attrs } });
      }
    };

    addPermission('android.permission.POST_NOTIFICATIONS');
    addPermission('android.permission.FOREGROUND_SERVICE');
    addPermission('android.permission.FOREGROUND_SERVICE_LOCATION');
    addPermission('android.permission.FOREGROUND_SERVICE_CAMERA');
    // USE_EXACT_ALARM does not need user approval (unlike SCHEDULE_EXACT_ALARM)
    addPermission('android.permission.USE_EXACT_ALARM');
    addPermission('android.permission.RECEIVE_BOOT_COMPLETED');
    // Android 14+ — required to bind to foreground services
    addPermission('android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE');

    const app = manifest.application?.[0];
    if (!app) return mod;

    // ── 2. Fix ALL services: add exported + foregroundServiceType ─────────
    if (app.service) {
      app.service.forEach((service) => {
        const name = service.$?.['android:name'] || '';

        // All services need android:exported
        if (service.$?.['android:exported'] == null) {
          // FCM and Firebase services need exported=true to receive messages
          const needsExportedTrue =
            name.includes('firebase') ||
            name.includes('Firebase') ||
            name.includes('FirebaseMessaging') ||
            name.includes('FirebaseInstanceId') ||
            name.includes('ExpoNotificationsService') ||
            name.includes('notifications.service');

          service.$['android:exported'] = needsExportedTrue ? 'true' : 'false';
        }

        // Location-related services need foregroundServiceType="location"
        const isLocationService =
          name.toLowerCase().includes('location') ||
          name.toLowerCase().includes('taskconsumer') ||
          name.includes('expo.modules.location') ||
          name.includes('LocationModule') ||
          name.includes('BackgroundFetch');

        if (isLocationService) {
          if (!service.$?.['android:foregroundServiceType']) {
            service.$['android:foregroundServiceType'] = 'location';
          }
          // ✅ Ne PAS tuer le service quand l'utilisateur ferme l'app (swipe to close)
          // Essentiel pour Samsung/Oppo/Xiaomi qui utilisent stopWithTask par défaut
          service.$['android:stopWithTask'] = 'false';
        }

        // Camera-related foreground services
        const isCameraService = name.toLowerCase().includes('camera');
        if (isCameraService && !service.$?.['android:foregroundServiceType']) {
          service.$['android:foregroundServiceType'] = 'camera';
        }
      });

      // Ensure expo-location task consumer service exists with correct type
      const locationTaskService = 'expo.modules.location.taskConsumers.LocationTaskConsumer';
      const hasLocationTask = app.service.some(
        (s) => s.$?.['android:name'] === locationTaskService
      );
      if (!hasLocationTask) {
        app.service.push({
          $: {
            'android:name': locationTaskService,
            'android:foregroundServiceType': 'location',
            'android:exported': 'false',
            'android:stopWithTask': 'false',  // survit au swipe-to-close
          },
        });
      }
    }

    // ── 3. Fix ALL receivers: add android:exported ────────────────────────
    if (app.receiver) {
      app.receiver.forEach((receiver) => {
        if (receiver.$?.['android:exported'] == null) {
          const name = receiver.$?.['android:name'] || '';
          // Boot receivers need exported=true to receive BOOT_COMPLETED
          const needsExportedTrue =
            name.includes('BootReceiver') ||
            name.includes('boot') ||
            name.includes('Boot') ||
            name.includes('firebase') ||
            name.includes('Firebase') ||
            name.includes('AlarmReceiver');
          receiver.$['android:exported'] = needsExportedTrue ? 'true' : 'false';
        }
      });
    }

    // ── 4. Fix activities: ensure android:exported on main activity ────────
    if (app.activity) {
      app.activity.forEach((activity) => {
        if (activity.$?.['android:exported'] == null) {
          // Activities with intent-filters (like main launcher) need exported=true
          const hasIntentFilter = !!activity['intent-filter'];
          activity.$['android:exported'] = hasIntentFilter ? 'true' : 'false';
        }
      });
    }

    return mod;
  });
};

module.exports = withAndroid15Fix;

