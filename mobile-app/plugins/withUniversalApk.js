/**
 * Plugin Expo — Force APK universelle compatible avec toutes architectures Android
 * Couvre: arm64-v8a (64-bit), armeabi-v7a (32-bit anciens), x86_64 (émulateurs)
 */
const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

// Inject ABI splits in build.gradle to build a universal APK
const withUniversalApk = (config) => {
  // 1. Modifier build.gradle pour désactiver les ABI splits (APK universelle)
  config = withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;

    // Remplacer enableSeparateBuildPerCPUArchitecture true → false
    gradle = gradle.replace(
      /enableSeparateBuildPerCPUArchitecture\s*=?\s*true/g,
      'enableSeparateBuildPerCPUArchitecture = false'
    );

    // Ajouter la configuration ABI si pas déjà présente
    if (!gradle.includes('abiFilters')) {
      gradle = gradle.replace(
        /defaultConfig\s*\{/,
        `defaultConfig {
        ndk {
            abiFilters "armeabi-v7a", "arm64-v8a", "x86_64"
        }`
      );
    }

    mod.modResults.contents = gradle;
    return mod;
  });

  // 2. Propriétés Gradle pour optimiser le build
  config = withGradleProperties(config, (mod) => {
    const props = mod.modResults;

    const setOrUpdate = (key, value) => {
      const idx = props.findIndex((p) => p.type === 'property' && p.key === key);
      if (idx >= 0) {
        props[idx].value = value;
      } else {
        props.push({ type: 'property', key, value });
      }
    };

    // Activer Hermes (meilleure perf sur anciens appareils Android)
    setOrUpdate('expo.jsEngine', 'hermes');
    // Mémoire Gradle
    setOrUpdate('org.gradle.jvmargs', '-Xmx4096m -XX:MaxMetaspaceSize=512m');
    // Build parallèle
    setOrUpdate('org.gradle.parallel', 'true');
    setOrUpdate('org.gradle.daemon', 'true');
    setOrUpdate('org.gradle.configureondemand', 'true');
    // React Native new architecture désactivée (compatibilité élargie anciens Android)
    setOrUpdate('newArchEnabled', 'false');
    setOrUpdate('reactNativeArchitectures', 'armeabi-v7a,arm64-v8a,x86_64');

    mod.modResults = props;
    return mod;
  });

  return config;
};

module.exports = withUniversalApk;
