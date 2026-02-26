/**
 * Service de fingerprinting et info device pour React Native
 * Équivalent du web deviceFingerprint.js
 */

import * as Device from 'expo-device';
import * as Network from 'expo-network';
import * as Application from 'expo-application';
import { Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Générer un fingerprint unique pour l'appareil
 * Basé sur : deviceId + installationId + modèle + OS
 */
export const getDeviceFingerprint = async () => {
  try {
    // Tenter de récupérer un fingerprint existant
    const stored = await AsyncStorage.getItem('deviceFingerprint');
    if (stored) return stored;

    // Collecter les identifiants disponibles
    const deviceId = await Application.getIosIdForVendorAsync?.() || 
                     await Application.getAndroidId?.() ||
                     Device.modelId ||
                     'unknown';
    
    const installId = Application.applicationId || 'unknown';
    const model = Device.modelName || 'unknown';
    const osVersion = Device.osVersion || 'unknown';
    
    // Générer un fingerprint simple
    const components = [
      deviceId,
      installId,
      model,
      Platform.OS,
      osVersion,
      Date.now().toString(36)
    ];
    
    const fingerprint = btoa(components.join('-')).substring(0, 32);
    
    // Stocker pour réutilisation
    await AsyncStorage.setItem('deviceFingerprint', fingerprint);
    
    return fingerprint;
  } catch (error) {
    console.error('Erreur génération fingerprint:', error);
    return 'mobile-' + Math.random().toString(36).substring(7);
  }
};

/**
 * Collecter les informations détaillées de l'appareil
 * Équivalent web: navigator.userAgent, window.screen, etc.
 */
export const getDeviceInfo = async () => {
  try {
    const { width, height } = Dimensions.get('screen');
    const networkState = await Network.getNetworkStateAsync();
    
    return {
      // Device
      platform: Platform.OS, // 'ios' | 'android'
      osVersion: Device.osVersion,
      deviceName: Device.deviceName,
      brand: Device.brand, // 'Apple' | 'Samsung' | etc.
      model: Device.modelName,
      modelId: Device.modelId,
      deviceYearClass: Device.deviceYearClass, // Performance class
      
      // App
      appVersion: Application.nativeApplicationVersion,
      appBuildVersion: Application.nativeBuildVersion,
      bundleId: Application.applicationId,
      
      // System
      isDevice: Device.isDevice, // false si émulateur
      totalMemory: Device.totalMemory,
      supportedCpuArchitectures: Device.supportedCpuArchitectures,
      
      // Screen
      screenWidth: width,
      screenHeight: height,
      screenResolution: `${width}x${height}`,
      
      // Network
      networkType: networkState?.type, // 'WIFI' | 'CELLULAR' | 'NONE'
      isConnected: networkState?.isConnected,
      isInternetReachable: networkState?.isInternetReachable,
      
      // Meta
      timestamp: new Date().toISOString(),
      userAgent: `${Platform.OS}/${Device.osVersion} ${Device.brand}/${Device.modelName}`
    };
  } catch (error) {
    console.error('Erreur collecte device info:', error);
    return {
      platform: Platform.OS,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Fonction utilitaire: btoa (base64 encode) pour React Native
 */
function btoa(str) {
  return Buffer.from(str, 'binary').toString('base64');
}
