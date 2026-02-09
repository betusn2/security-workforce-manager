/**
 * 📱 SERVICE INFORMATIONS APPAREIL EN TEMPS RÉEL
 * 
 * Récupère toutes les informations de l'appareil :
 * - 🔋 Batterie complète (niveau, charging, temps restant)
 * - 📶 Réseau (type, signal, online/offline)
 * - 📱 Appareil (OS, navigateur, écran)
 * - 📍 GPS (précision, altitude, vitesse)
 */

class DeviceInfoService {
  constructor() {
    this.batteryInfo = null;
    this.networkInfo = null;
    this.deviceInfo = null;
    this.listeners = new Map();
    this.updateInterval = null;
  }

  /**
   * 🔋 BATTERY API COMPLÈTE
   */
  async getBatteryInfo() {
    try {
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery();
        
        const info = {
          level: Math.round(battery.level * 100), // 0-100%
          charging: battery.charging, // true/false
          chargingTime: battery.chargingTime, // Secondes jusqu'à charge complète (Infinity si pas en charge)
          dischargingTime: battery.dischargingTime, // Secondes restantes (Infinity si en charge)
          
          // Calculer temps restant lisible
          estimatedTimeRemaining: this._formatTime(
            battery.charging ? battery.chargingTime : battery.dischargingTime
          ),
          
          // État batterie
          status: this._getBatteryStatus(battery.level, battery.charging),
          
          // Timestamp
          timestamp: new Date()
        };
        
        this.batteryInfo = info;
        return info;
      } else {
        return {
          level: 100,
          charging: false,
          chargingTime: Infinity,
          dischargingTime: Infinity,
          estimatedTimeRemaining: 'Non disponible',
          status: 'unknown',
          timestamp: new Date()
        };
      }
    } catch (error) {
      console.error('❌ Erreur Battery API:', error);
      return null;
    }
  }

  /**
   * 📶 NETWORK INFORMATION API
   */
  getNetworkInfo() {
    try {
      const connection = navigator.connection || 
                        navigator.mozConnection || 
                        navigator.webkitConnection;
      
      if (connection) {
        const info = {
          // Type de connexion (wifi, cellular, ethernet, etc.)
          type: connection.effectiveType || connection.type || 'unknown',
          
          // Vitesse estimée (downlink en Mbps)
          downlink: connection.downlink || null,
          
          // Latence estimée (RTT en ms)
          rtt: connection.rtt || null,
          
          // Data saver activé ?
          saveData: connection.saveData || false,
          
          // Online/Offline
          isOnline: navigator.onLine,
          
          // État connexion
          status: this._getNetworkStatus(connection.effectiveType, navigator.onLine),
          
          // Timestamp
          timestamp: new Date()
        };
        
        this.networkInfo = info;
        return info;
      } else {
        return {
          type: 'unknown',
          downlink: null,
          rtt: null,
          saveData: false,
          isOnline: navigator.onLine,
          status: navigator.onLine ? 'online' : 'offline',
          timestamp: new Date()
        };
      }
    } catch (error) {
      console.error('❌ Erreur Network API:', error);
      return null;
    }
  }

  /**
   * 📱 DEVICE INFORMATION
   */
  getDeviceInfo() {
    try {
      const info = {
        // User Agent
        userAgent: navigator.userAgent,
        
        // Plateforme (Win32, MacIntel, Linux, iPhone, Android, etc.)
        platform: navigator.platform,
        
        // Langue
        language: navigator.language,
        
        // Nombre de cœurs CPU
        cpuCores: navigator.hardwareConcurrency || null,
        
        // Mémoire (en GB)
        memory: navigator.deviceMemory || null,
        
        // Résolution écran
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        
        // Écran allumé (approximation via Page Visibility API)
        screenOn: !document.hidden,
        
        // OS détecté
        os: this._detectOS(),
        
        // Navigateur détecté
        browser: this._detectBrowser(),
        
        // Device type (mobile, tablet, desktop)
        deviceType: this._detectDeviceType(),
        
        // Timestamp
        timestamp: new Date()
      };
      
      this.deviceInfo = info;
      return info;
    } catch (error) {
      console.error('❌ Erreur Device Info:', error);
      return null;
    }
  }

  /**
   * 📍 GPS EXTENDED INFO
   */
  async getGPSExtendedInfo(position) {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy, // Précision en mètres
      altitude: position.coords.altitude, // Altitude en mètres (peut être null)
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading, // Direction en degrés (0-360, peut être null)
      speed: position.coords.speed, // Vitesse en m/s (peut être null)
      speedKmh: position.coords.speed ? (position.coords.speed * 3.6).toFixed(1) : null,
      timestamp: position.timestamp
    };
  }

  /**
   * 🔄 TOUT RÉCUPÉRER EN UNE FOIS
   */
  async getAllInfo() {
    const [battery, network, device] = await Promise.all([
      this.getBatteryInfo(),
      Promise.resolve(this.getNetworkInfo()),
      Promise.resolve(this.getDeviceInfo())
    ]);
    
    return {
      battery,
      network,
      device,
      timestamp: new Date()
    };
  }

  /**
   * 🔔 ÉCOUTER LES CHANGEMENTS
   */
  async startMonitoring(callback, intervalMs = 5000) {
    // Première récupération immédiate
    const info = await this.getAllInfo();
    callback(info);
    
    // Écouter les changements de batterie
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      
      battery.addEventListener('levelchange', async () => {
        const info = await this.getAllInfo();
        callback(info);
      });
      
      battery.addEventListener('chargingchange', async () => {
        const info = await this.getAllInfo();
        callback(info);
      });
    }
    
    // Écouter les changements de réseau
    window.addEventListener('online', async () => {
      const info = await this.getAllInfo();
      callback(info);
    });
    
    window.addEventListener('offline', async () => {
      const info = await this.getAllInfo();
      callback(info);
    });
    
    // Écouter les changements de visibilité (écran on/off)
    document.addEventListener('visibilitychange', async () => {
      const info = await this.getAllInfo();
      callback(info);
    });
    
    // Mise à jour périodique
    this.updateInterval = setInterval(async () => {
      const info = await this.getAllInfo();
      callback(info);
    }, intervalMs);
  }

  /**
   * 🛑 ARRÊTER LE MONITORING
   */
  stopMonitoring() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // ====================================
  // HELPERS PRIVÉS
  // ====================================

  _formatTime(seconds) {
    if (seconds === Infinity || seconds === null) {
      return 'N/A';
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else {
      return `${minutes}min`;
    }
  }

  _getBatteryStatus(level, charging) {
    if (charging) return 'charging';
    if (level < 0.15) return 'critical';
    if (level < 0.3) return 'low';
    if (level < 0.5) return 'medium';
    return 'good';
  }

  _getNetworkStatus(type, isOnline) {
    if (!isOnline) return 'offline';
    
    switch (type) {
      case 'slow-2g':
      case '2g':
        return 'slow';
      case '3g':
        return 'moderate';
      case '4g':
        return 'fast';
      case 'wifi':
        return 'excellent';
      default:
        return 'unknown';
    }
  }

  _detectOS() {
    const ua = navigator.userAgent;
    
    if (ua.includes('Win')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    
    return 'Unknown';
  }

  _detectBrowser() {
    const ua = navigator.userAgent;
    
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    if (ua.includes('Opera')) return 'Opera';
    
    return 'Unknown';
  }

  _detectDeviceType() {
    const ua = navigator.userAgent;
    
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }
}

// Export singleton
const deviceInfoService = new DeviceInfoService();
export default deviceInfoService;
