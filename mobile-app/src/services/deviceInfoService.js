/**
 * 📱 SERVICE INFORMATIONS APPAREIL EN TEMPS RÉEL - REACT NATIVE
 * 
 * Adapté de la version web avec APIs Expo :
 * - 🔋 Battery complète (expo-battery)
 * - 📶 Network (expo-network)
 * - 📱 Device (expo-device, expo-constants)
 * - 📍 GPS (expo-location)
 */

import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

class DeviceInfoService {
  constructor() {
    this.batteryInfo = null;
    this.networkInfo = null;
    this.deviceInfo = null;
  }

  /**
   * 🔋 BATTERY API COMPLÈTE (Expo)
   */
  async getBatteryInfo() {
    try {
      const [level, state, lowPowerMode] = await Promise.all([
        Battery.getBatteryLevelAsync(),
        Battery.getBatteryStateAsync(),
        Battery.isLowPowerModeEnabledAsync()
      ]);

      const charging = state === Battery.BatteryState.CHARGING || 
                       state === Battery.BatteryState.FULL;

      const info = {
        level: Math.round(level * 100), // 0-100%
        charging,
        lowPowerMode,
        state: this._getBatteryStateText(state),
        status: this._getBatteryStatus(level, charging),
        timestamp: new Date()
      };

      this.batteryInfo = info;
      return info;
    } catch (error) {
      console.error('❌ Battery API error:', error);
      return {
        level: 100,
        charging: false,
        lowPowerMode: false,
        state: 'unknown',
        status: 'unknown',
        timestamp: new Date()
      };
    }
  }

  _getBatteryStateText(state) {
    const states = {
      [Battery.BatteryState.UNKNOWN]: 'unknown',
      [Battery.BatteryState.UNPLUGGED]: 'discharging',
      [Battery.BatteryState.CHARGING]: 'charging',
      [Battery.BatteryState.FULL]: 'full'
    };
    return states[state] || 'unknown';
  }

  _getBatteryStatus(level, charging) {
    if (charging) return 'charging';
    if (level >= 0.9) return 'full';
    if (level <= 0.15) return 'low';
    if (level <= 0.05) return 'critical';
    return 'normal';
  }

  /**
   * 📶 NETWORK INFORMATION API (Expo)
   */
  async getNetworkInfo() {
    try {
      const [networkState, ipAddress] = await Promise.all([
        Network.getNetworkStateAsync(),
        Network.getIpAddressAsync().catch(() => null)
      ]);

      const info = {
        type: networkState.type, // WIFI, CELLULAR, NONE, etc.
        isConnected: networkState.isConnected,
        isInternetReachable: networkState.isInternetReachable,
        ipAddress,
        status: this._getNetworkStatus(networkState),
        timestamp: new Date()
      };

      this.networkInfo = info;
      return info;
    } catch (error) {
      console.error('❌ Network API error:', error);
      return {
        type: 'unknown',
        isConnected: false,
        isInternetReachable: false,
        ipAddress: null,
        status: 'unknown',
        timestamp: new Date()
      };
    }
  }

  _getNetworkStatus(networkState) {
    if (!networkState.isConnected) return 'offline';
    if (!networkState.isInternetReachable) return 'no_internet';
    if (networkState.type === Network.NetworkStateType.WIFI) return 'excellent';
    if (networkState.type === Network.NetworkStateType.CELLULAR) return 'good';
    return 'unknown';
  }

  /**
   * 📱 DEVICE INFORMATION COMPLÈTE (Expo)
   */
  async getDeviceInfo() {
    try {
      const info = {
        // Device
        deviceName: Device.deviceName,
        deviceType: Device.deviceType, // PHONE, TABLET, DESKTOP, etc.
        brand: Device.brand,
        manufacturer: Device.manufacturer,
        modelName: Device.modelName,
        modelId: Device.modelId,
        designName: Device.designName,
        deviceYearClass: Device.deviceYearClass,
        
        // OS
        os: Platform.OS, // 'ios' or 'android'
        osName: Device.osName,
        osVersion: Device.osVersion,
        osBuildId: Device.osBuildId,
        platformApiLevel: Device.platformApiLevel,
        
        // System
        totalMemory: Device.totalMemory,
        supportedCpuArchitectures: Device.supportedCpuArchitectures,
        
        // App
        appVersion: Constants.expoConfig?.version || '1.0.0',
        appBuildVersion: Constants.expoConfig?.android?.versionCode || 
                         Constants.expoConfig?.ios?.buildNumber || '1',
        
        // Platform
        platform: Platform.OS,
        platformVersion: String(Platform.Version),
        isDevice: !Device.isDevice ? false : true,
        
        timestamp: new Date()
      };

      this.deviceInfo = info;
      return info;
    } catch (error) {
      console.error('❌ Device API error:', error);
      return {
        deviceName: 'Unknown',
        deviceType: 'PHONE',
        brand: 'Unknown',
        os: Platform.OS,
        platform: Platform.OS,
        isDevice: true,
        timestamp: new Date()
      };
    }
  }

  /**
   * 📊 RÉCUPÉRER TOUTES LES INFOS
   */
  async getAllInfo() {
    const [battery, network, device] = await Promise.all([
      this.getBatteryInfo(),
      this.getNetworkInfo(),
      this.getDeviceInfo()
    ]);

    return {
      battery,
      network,
      device,
      timestamp: new Date()
    };
  }

  /**
   * 🎯 FORMAT POUR TRANSMISSION SOCKET.IO
   */
  async getTransmissionData(location) {
    const allInfo = await this.getAllInfo();

    return {
      // GPS
      latitude: location?.latitude || null,
      longitude: location?.longitude || null,
      accuracy: location?.accuracy || null,
      altitude: location?.altitude || null,
      speed: location?.speed || 0,
      heading: location?.heading || null,

      // 🔋 Batterie
      batteryLevel: allInfo.battery.level,
      batteryCharging: allInfo.battery.charging,
      batteryLowPowerMode: allInfo.battery.lowPowerMode,
      batteryState: allInfo.battery.state,
      batteryStatus: allInfo.battery.status,

      // 📶 Réseau
      networkType: allInfo.network.type,
      networkIsConnected: allInfo.network.isConnected,
      networkIsInternetReachable: allInfo.network.isInternetReachable,
      networkIpAddress: allInfo.network.ipAddress,
      networkStatus: allInfo.network.status,

      // 📱 Appareil
      deviceName: allInfo.device.deviceName,
      deviceType: allInfo.device.deviceType,
      deviceBrand: allInfo.device.brand,
      deviceManufacturer: allInfo.device.manufacturer,
      deviceModel: allInfo.device.modelName,
      deviceOS: allInfo.device.os,
      deviceOSName: allInfo.device.osName,
      deviceOSVersion: allInfo.device.osVersion,
      devicePlatform: allInfo.device.platform,
      deviceIsDevice: allInfo.device.isDevice,
      deviceTotalMemory: allInfo.device.totalMemory,
      deviceCpuArchitectures: allInfo.device.supportedCpuArchitectures,
      deviceAppVersion: allInfo.device.appVersion,
      deviceAppBuildVersion: allInfo.device.appBuildVersion,

      timestamp: new Date().toISOString()
    };
  }
}

export default new DeviceInfoService();
