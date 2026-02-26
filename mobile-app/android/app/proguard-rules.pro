# ═══════════════════════════════════════════════════════════════════════════════
# ProGuard rules — SecurityGuard Mobile
# React Native 0.73 + Hermes + Expo SDK 50 + Android 14/15 compatibility
# ═══════════════════════════════════════════════════════════════════════════════

# ── React Native core ──────────────────────────────────────────────────────────
# Keep all React Native classes (Hermes uses reflection heavily)
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**

# ── React Native Reanimated ────────────────────────────────────────────────────
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }

# ── React Native TurboModules (New Architecture) ──────────────────────────────
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.module.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# ── Expo modules ───────────────────────────────────────────────────────────────
-keep class expo.modules.** { *; }
-keep class host.exp.exponent.** { *; }
-keep class versioned.host.exp.exponent.** { *; }
-dontwarn expo.modules.**

# ── AsyncStorage / SecureStore ─────────────────────────────────────────────────
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class expo.modules.securestore.** { *; }

# ── Expo Location / Task Manager (GPS foreground service) ─────────────────────
-keep class expo.modules.location.** { *; }
-keep class expo.modules.taskmanager.** { *; }

# ── Expo Notifications ─────────────────────────────────────────────────────────
-keep class expo.modules.notifications.** { *; }
-keep class com.google.firebase.messaging.** { *; }

# ── Zustand / JS engine ───────────────────────────────────────────────────────
# JS bundles are not obfuscated by ProGuard (Hermes does it); only native code matters
-keep class com.facebook.soloader.** { *; }
-keep class com.facebook.yoga.** { *; }

# ── OkHttp / Networking ────────────────────────────────────────────────────────
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# ── AndroidX / Jetpack ────────────────────────────────────────────────────────
-keep class androidx.** { *; }
-dontwarn androidx.**

# ── Suppress common warnings ──────────────────────────────────────────────────
-dontwarn com.google.android.gms.**
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**

# ── Native libraries (JNI) ────────────────────────────────────────────────────
-keepclasseswithmembernames class * {
    native <methods>;
}

# ── Application entry points ──────────────────────────────────────────────────
-keep class com.securityguard.mobile.** { *; }
-keep class com.securityguard.mobile.MainApplication { *; }
-keep class com.securityguard.mobile.MainActivity { *; }

# ── Preserve stack traces in crash reports ────────────────────────────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
