module.exports = (sequelize, DataTypes) => {
  const GeoTracking = sequelize.define('GeoTracking', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false
    },
    accuracy: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      comment: 'Precision en metres'
    },
    altitude: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true
    },
    speed: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      comment: 'Vitesse en km/h'
    },
    heading: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Direction 0-360 degres'
    },
    
    // 🔋 BATTERIE - Infos complètes
    batteryLevel: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Niveau batterie 0-100%'
    },
    batteryCharging: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: 'Appareil en charge ?'
    },
    batteryChargingTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Secondes jusqu\'à charge complète'
    },
    batteryDischargingTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Secondes batterie restantes'
    },
    batteryStatus: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'charging, critical, low, medium, good'
    },
    batteryEstimatedTime: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Temps restant lisible (ex: 2h 30min)'
    },
    
    // 📶 RÉSEAU - Infos détaillées
    networkType: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'wifi, 4g, 5g, slow-2g, 2g, 3g'
    },
    networkDownlink: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      comment: 'Vitesse téléchargement Mbps'
    },
    networkRtt: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Latence réseau en ms'
    },
    networkSaveData: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: 'Mode économie données activé ?'
    },
    networkOnline: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: 'Appareil connecté à internet ?'
    },
    networkStatus: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'online, offline, slow, moderate, fast, excellent'
    },
    
    // 📱 APPAREIL - Infos système
    deviceOS: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Windows, macOS, Linux, Android, iOS'
    },
    deviceBrowser: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Chrome, Firefox, Safari, Edge, Opera'
    },
    deviceType: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'mobile, tablet, desktop'
    },
    devicePlatform: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Win32, MacIntel, iPhone, Android, etc.'
    },
    deviceLanguage: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'Langue appareil (en, fr, ar, etc.)'
    },
    deviceCPUCores: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Nombre de cœurs CPU'
    },
    deviceMemory: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'RAM en GB'
    },
    deviceScreenResolution: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Résolution écran (ex: 1920x1080)'
    },
    deviceScreenOn: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: 'Écran allumé ou éteint ?'
    },
    
    // 🛡️ SÉCURITÉ
    isMockLocation: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Detection GPS spoofing'
    },
    cellTowerInfo: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Info triangulation'
    },
    
    // 🌍 GÉOFENCING
    isWithinGeofence: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    distanceFromEvent: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Distance en metres'
    },
    
    // ⏱️ TRACKING
    recordedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    isMoving: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: 'Agent en mouvement ?'
    }
  }, {
    tableName: 'geo_tracking',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'event_id'] },
      { fields: ['recorded_at'] },
      { fields: ['user_id', 'recorded_at'] },
      { fields: ['battery_level'] },
      { fields: ['network_status'] },
      { fields: ['device_screen_on'] }
    ]
  });

  // Methode pour detecter le GPS spoofing
  GeoTracking.detectSpoofing = async function(userId, newLocation) {
    const lastLocation = await this.findOne({
      where: { userId },
      order: [['recordedAt', 'DESC']]
    });

    if (!lastLocation) return { isSpoofed: false };

    const timeDiff = (new Date(newLocation.recordedAt) - new Date(lastLocation.recordedAt)) / 1000; // secondes
    if (timeDiff <= 0) return { isSpoofed: false };

    // Calculer la distance
    const R = 6371000; // Rayon terre en metres
    const lat1 = lastLocation.latitude * Math.PI / 180;
    const lat2 = newLocation.latitude * Math.PI / 180;
    const deltaLat = (newLocation.latitude - lastLocation.latitude) * Math.PI / 180;
    const deltaLon = (newLocation.longitude - lastLocation.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // en metres

    // Vitesse calculee en km/h
    const calculatedSpeed = (distance / timeDiff) * 3.6;

    // Flags de spoofing
    const flags = {
      teleportation: calculatedSpeed > 500, // Plus de 500 km/h = impossible
      mockLocation: newLocation.isMockLocation,
      lowAccuracy: newLocation.accuracy > 100, // Plus de 100m de precision = suspect
      impossibleSpeed: calculatedSpeed > 150 && timeDiff < 60 // Plus de 150km/h sur moins d'1 min
    };

    return {
      isSpoofed: flags.teleportation || flags.mockLocation || flags.impossibleSpeed,
      flags,
      calculatedSpeed,
      distance,
      timeDiff
    };
  };

  return GeoTracking;
};
