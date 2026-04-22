/**
 * Controleur de Tracking GPS
 * Gere le suivi en temps reel des agents
 */

const { GeoTracking, User, Event, FraudAttempt, Assignment } = require('../models');
const { Op } = require('sequelize');
const geoService = require('../services/geoService');
const { logActivity } = require('../middlewares/activityLogger');

// Configuration Tracking
const TRACKING_CONFIG = {
  maxAccuracy: 100,               // Precision max acceptee (metres)
  maxSpeed: 150,                  // Vitesse max raisonnable (km/h)
  teleportThreshold: 500,         // Seuil teleportation (km/h)
  staleLocationMinutes: 15,       // Position consideree obsolete apres X minutes
  outOfZoneAlertThreshold: 3      // Alertes avant escalade
};

/**
 * Enregistrer une nouvelle position GPS
 */
exports.recordLocation = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      accuracy,
      altitude,
      speed,
      heading,
      batteryLevel,
      isMockLocation,
      networkType,
      cellTowerInfo,
      eventId,
      // Champs enrichis envoyés par la tâche background
      speedKmh: payloadSpeedKmh,
      isMoving: payloadIsMoving,
      batteryCharging,
      batteryStatus,
      batteryEstimatedTime,
      networkOnline,
      networkStatus,
      networkDownlink,
      networkRtt,
      deviceOS,
      deviceBrowser,
      deviceType,
      deviceMemory,
      deviceCPUCores,
      deviceScreenOn,
      deviceScreenResolution,
      deviceBrand,
      deviceModel,
      source,
    } = req.body;

    const userId = req.user.id;

    // Validation des coordonnees
    if (!geoService.isValidCoordinate(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Coordonnees GPS invalides'
      });
    }

    // Detection GPS spoofing - Mock location
    if (isMockLocation) {
      await FraudAttempt.record({
        userId,
        eventId,
        attemptType: 'gps_spoofing',
        severity: 'high',
        description: 'Location simulee detectee',
        details: { latitude, longitude, accuracy },
        latitude,
        longitude,
        ipAddress: req.ip
      });

      return res.status(403).json({
        success: false,
        message: 'Position GPS non autorisee',
        error: 'mock_location_detected'
      });
    }

    // Detection teleportation
    const spoofingCheck = await GeoTracking.detectSpoofing(userId, {
      latitude,
      longitude,
      recordedAt: new Date()
    });

    if (spoofingCheck.isSpoofed) {
      await FraudAttempt.record({
        userId,
        eventId,
        attemptType: 'gps_spoofing',
        severity: 'critical',
        description: 'Teleportation detectee',
        details: spoofingCheck,
        latitude,
        longitude,
        ipAddress: req.ip
      });

      // Ne pas bloquer completement, mais logger
      console.warn(`[FRAUD] Teleportation detected for user ${userId}: ${spoofingCheck.calculatedSpeed} km/h`);
    }

    // Verifier le geofencing si evenement specifie
    let isWithinGeofence = true;
    let distanceFromEvent = null;
    let alerts = [];

    if (eventId) {
      const event = await Event.findByPk(eventId);
      if (event && event.latitude && event.longitude) {
        const distance = geoService.calculateDistance(
          latitude,
          longitude,
          parseFloat(event.latitude),
          parseFloat(event.longitude)
        );

        distanceFromEvent = Math.round(distance);
        isWithinGeofence = distance <= (event.geoRadius || 100);

        if (!isWithinGeofence) {
          alerts.push({
            type: 'out_of_zone',
            message: `Agent hors zone (${distanceFromEvent}m)`,
            distance: distanceFromEvent,
            allowedRadius: event.geoRadius || 100
          });

          // Enregistrer tentative hors zone
          await FraudAttempt.record({
            userId,
            eventId,
            attemptType: 'out_of_zone',
            severity: 'medium',
            description: `Agent a ${distanceFromEvent}m de la zone autorisee`,
            details: { distance: distanceFromEvent, allowedRadius: event.geoRadius },
            latitude,
            longitude,
            ipAddress: req.ip
          });
        }
      }
    }

    // ─── DÉDUPLICATION : éviter les points redondants (agent immobile) ──────
    // Si position < 10m de la dernière ET vitesse < 0.5 km/h ET dans la zone :
    // → on broadcast socket mais on n'écrit PAS en DB (économie stockage ~60%)
    const speedKmh = speed != null ? speed * 3.6 : 0;
    if (isWithinGeofence) {
      const recentPoint = await GeoTracking.findOne({
        where: { userId, eventId: eventId || null },
        order: [['recordedAt', 'DESC']],
        attributes: ['latitude', 'longitude', 'recordedAt'],
      });
      if (recentPoint) {
        const timeDiff = (Date.now() - new Date(recentPoint.recordedAt).getTime()) / 1000;
        const dist = geoService.calculateDistance(
          latitude, longitude,
          parseFloat(recentPoint.latitude), parseFloat(recentPoint.longitude)
        );
        // Skip si même spot (< 10m), pas en mouvement, et dernier point < 60s
        if (dist < 10 && speedKmh < 0.5 && timeDiff < 60) {
          // Broadcast temps réel quand même (sans sauvegarder)
          const io = req.app.get('io');
          if (io) {
            io.to('role:admin').to('role:supervisor').to('global:supervisors').emit('agent:location', {
              userId, eventId, latitude, longitude, accuracy, speed,
              isWithinGeofence, distanceFromEvent, batteryLevel, timestamp: new Date()
            });
          }
          return res.json({ success: true, message: 'Position inchangée (non sauvegardée)', deduplicated: true });
        }
      }
    }

    // Enregistrer la position
    const tracking = await GeoTracking.create({
      userId,
      eventId,
      latitude,
      longitude,
      accuracy,
      altitude,
      speed,
      heading,
      batteryLevel,
      isMockLocation: isMockLocation || false,
      networkType,
      cellTowerInfo,
      isWithinGeofence,
      distanceFromEvent,
      recordedAt: new Date()
    });

    // Mettre a jour la position actuelle de l'utilisateur
    await User.update(
      {
        currentLatitude: latitude,
        currentLongitude: longitude,
        lastLocationUpdate: new Date()
      },
      { where: { id: userId } }
    );

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    if (io) {
      // Payload enrichi (format attendu par EventDetails.jsx via tracking:position_update)
      const enrichedPositionData = {
        userId,
        latitude,
        longitude,
        accuracy,
        altitude,
        speed: speed || 0,
        speedKmh: payloadSpeedKmh ?? (speed != null ? +(speed * 3.6).toFixed(1) : 0),
        heading,
        isMoving: payloadIsMoving ?? (speed != null ? speed > 0.14 : false),
        isConnected: false, // arrière-plan = pas de socket actif côté mobile
        isWithinGeofence,
        distanceFromEvent,
        // Batterie
        batteryLevel: batteryLevel != null ? Math.round(batteryLevel) : null,
        batteryCharging: batteryCharging || false,
        batteryStatus: batteryStatus || null,
        batteryEstimatedTime: batteryEstimatedTime || null,
        // Réseau
        networkType: networkType || null,
        networkOnline: networkOnline !== undefined ? networkOnline : true,
        networkStatus: networkStatus || null,
        networkDownlink: networkDownlink || null,
        networkRtt: networkRtt || null,
        // Appareil
        deviceOS: deviceOS || null,
        deviceBrowser: deviceBrowser || null,
        deviceType: deviceType || null,
        deviceMemory: deviceMemory || null,
        deviceCPUCores: deviceCPUCores || null,
        deviceScreenOn: deviceScreenOn !== undefined ? deviceScreenOn : false,
        deviceScreenResolution: deviceScreenResolution || null,
        deviceBrand: deviceBrand || null,
        deviceModel: deviceModel || null,
        timestamp: Date.now(),
        source: source || 'background',
        user: req.user ? {
          id: req.user.id,
          cin: req.user.cin,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          employeeId: req.user.employeeId,
          role: req.user.role,
          phone: req.user.phone,
        } : null,
      };

      // Émettre tracking:position_update (format EventDetails) + agent:location (legacy)
      if (eventId) {
        io.to(`event-${eventId}`).emit('tracking:position_update', enrichedPositionData);
      }
      io.to('role:admin').to('role:supervisor').to('global:supervisors').emit('tracking:position_update', enrichedPositionData);

      io.to('role:admin').to('role:supervisor').to('global:supervisors').emit('agent:location', {
        userId,
        eventId,
        latitude,
        longitude,
        accuracy,
        speed,
        isWithinGeofence,
        distanceFromEvent,
        batteryLevel,
        batteryCharging: batteryCharging || false,
        batteryStatus: batteryStatus || null,
        networkType,
        timestamp: new Date()
      });

      // ── Alerte sortie de zone (événement dédié pour le dashboard) ──
      if (!isWithinGeofence) {
        io.to('role:admin').to('role:supervisor').to('global:supervisors').emit('agent:zone_exit', {
          userId,
          eventId,
          latitude,
          longitude,
          distanceFromEvent,
          allowedRadius: event?.geoRadius || 100,
          timestamp: new Date(),
          severity: distanceFromEvent > 500 ? 'high' : 'medium',
        });
        // Format compatible ancien dashboard
        io.to('role:admin').to('role:supervisor').to('global:supervisors').emit('tracking:geofence_alert', {
          type: 'geofence_exit',
          userId,
          eventId,
          message: `Agent hors zone — ${distanceFromEvent}m (limite: ${event?.geoRadius || 100}m)`,
          distanceFromEvent,
          allowedRadius: event?.geoRadius || 100,
          timestamp: new Date(),
        });
      }

      // ── Alerte batterie faible ──
      if (batteryLevel !== null && batteryLevel <= 15) {
        io.to('role:admin').to('role:supervisor').to('global:supervisors').emit('agent:battery_low', {
          userId,
          eventId,
          batteryLevel,
          batteryCharging: batteryCharging || false,
          timestamp: new Date(),
        });
        // Format compatible ancien dashboard
        io.to('role:admin').to('role:supervisor').to('global:supervisors').emit('tracking:battery_alert', {
          userId,
          eventId,
          batteryLevel,
          message: `Batterie ${batteryLevel <= 5 ? 'critique' : 'faible'} — ${batteryLevel}%`,
          timestamp: new Date(),
        });
      }

      if (eventId) {
        io.to(`event-${eventId}`).emit('agent:location', {
          userId,
          latitude,
          longitude,
          isWithinGeofence,
          distanceFromEvent,
          batteryLevel,
          timestamp: new Date()
        });
      }
    }

    res.json({
      success: true,
      data: {
        recorded: true,
        isWithinGeofence,
        distanceFromEvent,
        alerts: alerts.length > 0 ? alerts : undefined
      }
    });

  } catch (error) {
    console.error('Record location error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement de la position'
    });
  }
};

/**
 * Obtenir l'historique des positions d'un utilisateur
 */
exports.getUserHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, eventId, limit = 1000 } = req.query;

    // Verifier les permissions
    if (req.user.role === 'agent' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Acces non autorise'
      });
    }

    const where = { userId };

    if (startDate && endDate) {
      where.recordedAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    if (eventId) {
      where.eventId = eventId;
    }

    const tracks = await GeoTracking.findAll({
      where,
      order: [['recordedAt', 'DESC']],
      limit: parseInt(limit),
      attributes: [
        'id', 'latitude', 'longitude', 'accuracy', 'speed',
        'heading', 'isWithinGeofence', 'distanceFromEvent',
        'batteryLevel', 'recordedAt'
      ]
    });

    // Calculer les statistiques
    const stats = {
      totalPoints: tracks.length,
      outOfZoneCount: tracks.filter(t => !t.isWithinGeofence).length,
      avgAccuracy: tracks.length > 0
        ? tracks.reduce((sum, t) => sum + (t.accuracy || 0), 0) / tracks.length
        : 0,
      maxSpeed: Math.max(...tracks.map(t => t.speed || 0)),
      totalDistance: this.calculateTotalDistance(tracks)
    };

    res.json({
      success: true,
      data: {
        tracks: tracks.reverse(), // Ordre chronologique
        stats
      }
    });

  } catch (error) {
    console.error('Get user history error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recuperation de l\'historique'
    });
  }
};

/**
 * Calculer la distance totale parcourue
 */
exports.calculateTotalDistance = (tracks) => {
  if (tracks.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < tracks.length; i++) {
    totalDistance += geoService.calculateDistance(
      parseFloat(tracks[i-1].latitude),
      parseFloat(tracks[i-1].longitude),
      parseFloat(tracks[i].latitude),
      parseFloat(tracks[i].longitude)
    );
  }

  return Math.round(totalDistance);
};

/**
 * Obtenir les positions en temps reel pour un evenement
 */
exports.getEventLivePositions = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verifier que l'evenement existe
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Evenement non trouve'
      });
    }

    // Obtenir les agents assignes a l'evenement
    const assignments = await Assignment.findAll({
      where: {
        eventId,
        status: { [Op.in]: ['confirmed', 'pending'] }
      },
      include: [{
        model: User,
        as: 'agent',
        attributes: [
          'id', 'employeeId', 'firstName', 'lastName',
          'profilePhoto', 'phone', 'currentLatitude',
          'currentLongitude', 'lastLocationUpdate', 'status'
        ]
      }]
    });

    // Formater les donnees — enrichir avec la dernière position de GeoTracking
    const agentIds = assignments.map(a => a.agent?.id).filter(Boolean);

    // Fetch latest enriched tracking record per agent
    // Using findOne+ORDER per agent avoids MySQL strict mode issues with GROUP BY + non-agg cols
    const latestTrackingsList = agentIds.length > 0
      ? await Promise.all(
          agentIds.map(uid =>
            GeoTracking.findOne({
              where: { userId: uid },
              order: [['recordedAt', 'DESC']],
              raw: true,
            }).catch(() => null)
          )
        ).then(results => results.filter(Boolean))
      : [];

    const latestByUser = {};
    latestTrackingsList.forEach(t => { latestByUser[t.userId] = t; });

    const agents = assignments.map(a => {
      const agent = a.agent;
      // Prefer live tracking record if fresher
      const live = latestByUser[agent.id];
      const lat = live?.latitude ?? agent.currentLatitude;
      const lng = live?.longitude ?? agent.currentLongitude;
      const lastUpdate = live?.recordedAt ?? agent.lastLocationUpdate;

      const isOnline = lastUpdate &&
        (new Date() - new Date(lastUpdate)) < TRACKING_CONFIG.staleLocationMinutes * 60 * 1000;

      let distance = null;
      let isWithinGeofence = null;

      if (lat && lng && event.latitude && event.longitude) {
        distance = geoService.calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          parseFloat(event.latitude),
          parseFloat(event.longitude)
        );
        isWithinGeofence = distance <= (event.geoRadius || 100);
      }

      return {
        // Flat fields — used by dashboard loadLivePositions
        userId: agent.id,
        latitude:  lat ? parseFloat(lat) : null,
        longitude: lng ? parseFloat(lng) : null,
        accuracy:  live?.accuracy ?? null,
        altitude:  live?.altitude ?? null,
        speed:     live?.speed ?? null,
        speedKmh:  live?.speed != null ? +(live.speed * 3.6).toFixed(1) : 0,
        batteryLevel: live?.batteryLevel ?? null,
        networkType:  live?.networkType ?? null,
        isWithinGeofence,
        distanceFromEvent: distance ? Math.round(distance) : null,
        timestamp: lastUpdate,
        isOnline,
        // Legacy nested format (keep for backward compat)
        id: agent.id,
        employeeId: agent.employeeId,
        name: `${agent.firstName} ${agent.lastName}`,
        photo: agent.profilePhoto,
        phone: agent.phone,
        position: lat ? {
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          updatedAt: lastUpdate
        } : null,
        distance: distance ? Math.round(distance) : null,
        assignmentStatus: a.status,
        user: {
          id: agent.id,
          firstName: agent.firstName,
          lastName: agent.lastName,
          employeeId: agent.employeeId,
          phone: agent.phone,
        },
      };
    });

    // Alertes actives
    const alerts = [];
    agents.forEach(agent => {
      if (agent.isOnline && agent.isWithinGeofence === false) {
        alerts.push({
          type: 'out_of_zone',
          agentId: agent.id,
          agentName: agent.name,
          distance: agent.distance,
          message: `${agent.name} est hors zone (${agent.distance}m)`
        });
      }
      if (!agent.isOnline && agent.position) {
        alerts.push({
          type: 'offline',
          agentId: agent.id,
          agentName: agent.name,
          lastSeen: agent.position?.updatedAt,
          message: `${agent.name} hors ligne`
        });
      }
    });

    res.json({
      success: true,
      data: {
        event: {
          id: event.id,
          name: event.name,
          location: event.location,
          latitude: parseFloat(event.latitude),
          longitude: parseFloat(event.longitude),
          geoRadius: event.geoRadius || 100
        },
        agents,
        alerts,
        stats: {
          total: agents.length,
          online: agents.filter(a => a.isOnline).length,
          withinZone: agents.filter(a => a.isWithinGeofence).length,
          outOfZone: agents.filter(a => a.isWithinGeofence === false).length
        }
      }
    });

  } catch (error) {
    console.error('Get event live positions error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recuperation des positions'
    });
  }
};

/**
 * Valider si une position est dans la zone d'un evenement
 */
exports.validatePosition = async (req, res) => {
  try {
    const { latitude, longitude, eventId } = req.body;

    if (!geoService.isValidCoordinate(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Coordonnees invalides'
      });
    }

    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Evenement non trouve'
      });
    }

    if (!event.latitude || !event.longitude) {
      return res.status(400).json({
        success: false,
        message: 'L\'evenement n\'a pas de coordonnees definies'
      });
    }

    const distance = geoService.calculateDistance(
      latitude,
      longitude,
      parseFloat(event.latitude),
      parseFloat(event.longitude)
    );

    const isValid = distance <= (event.geoRadius || 100);
    const direction = geoService.getDirection(
      latitude,
      longitude,
      parseFloat(event.latitude),
      parseFloat(event.longitude)
    );

    res.json({
      success: true,
      data: {
        isValid,
        distance: Math.round(distance),
        allowedRadius: event.geoRadius || 100,
        direction,
        message: isValid
          ? 'Position valide'
          : `Vous etes a ${Math.round(distance)}m de la zone (max ${event.geoRadius || 100}m)`
      }
    });

  } catch (error) {
    console.error('Validate position error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la validation de la position'
    });
  }
};

/**
 * Obtenir toutes les positions en temps reel (admin)
 */
exports.getAllLivePositions = async (req, res) => {
  try {
    // Admin seulement
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acces reserve aux administrateurs'
      });
    }

    const agents = await User.findAll({
      where: {
        role: { [Op.in]: ['agent', 'supervisor'] },
        status: 'active',
        currentLatitude: { [Op.ne]: null }
      },
      attributes: [
        'id', 'employeeId', 'firstName', 'lastName',
        'profilePhoto', 'role', 'currentLatitude',
        'currentLongitude', 'lastLocationUpdate'
      ],
      include: [{
        model: User,
        as: 'supervisor',
        attributes: ['id', 'firstName', 'lastName']
      }]
    });

    const now = new Date();
    const formattedAgents = agents.map(agent => ({
      id: agent.id,
      employeeId: agent.employeeId,
      name: `${agent.firstName} ${agent.lastName}`,
      role: agent.role,
      photo: agent.profilePhoto,
      supervisor: agent.supervisor ? `${agent.supervisor.firstName} ${agent.supervisor.lastName}` : null,
      position: {
        latitude: parseFloat(agent.currentLatitude),
        longitude: parseFloat(agent.currentLongitude)
      },
      lastUpdate: agent.lastLocationUpdate,
      isOnline: (now - new Date(agent.lastLocationUpdate)) < TRACKING_CONFIG.staleLocationMinutes * 60 * 1000
    }));

    res.json({
      success: true,
      data: {
        agents: formattedAgents,
        stats: {
          total: formattedAgents.length,
          online: formattedAgents.filter(a => a.isOnline).length,
          offline: formattedAgents.filter(a => !a.isOnline).length
        }
      }
    });

  } catch (error) {
    console.error('Get all live positions error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recuperation des positions'
    });
  }
};

/**
 * Obtenir toutes les positions temps réel pour un événement
 */
exports.getRealtimePositions = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Récupérer l'événement avec ses coordonnées
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Événement non trouvé'
      });
    }

    // Récupérer les agents assignés à cet événement
    const assignments = await Assignment.findAll({
      where: {
        eventId,
        status: { [Op.in]: ['confirmed', 'accepted', 'checked_in'] }
      },
      include: [{
        model: User,
        as: 'agent',
        attributes: ['id', 'employeeId', 'firstName', 'lastName', 'profilePhoto', 'role']
      }]
    });

    const userIds = assignments.map(a => a.agentId);

    // Ajouter le superviseur de l'événement s'il existe
    if (event.supervisorId && !userIds.includes(event.supervisorId)) {
      userIds.push(event.supervisorId);
      console.log(`✅ Superviseur ${event.supervisorId} ajouté au suivi`);
    }

    // Si aucun utilisateur à suivre, retourner vide
    if (userIds.length === 0) {
      console.log('Aucun agent ou superviseur assigné à cet événement');
      return res.json({
        success: true,
        positions: [],
        event: {
          id: event.id,
          name: event.name,
          latitude: event.latitude,
          longitude: event.longitude,
          geoRadius: event.geoRadius || 100
        }
      });
    }

    console.log(`${userIds.length} personne(s) à suivre (agents + superviseur), recherche des positions GPS...`);

    // Récupérer les dernières positions pour chaque utilisateur
    // Utiliser une sous-requête pour obtenir la dernière position de chaque user
    const latestPositions = await GeoTracking.findAll({
      where: {
        userId: { [Op.in]: userIds }
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'employeeId', 'firstName', 'lastName', 'profilePhoto', 'role'],
        required: true
      }],
      order: [['recordedAt', 'DESC']],
      limit: 1000 // Récupérer plus pour filtrer après
    });

    // Filtrer pour garder seulement la dernière position par utilisateur
    const userLatestMap = {};
    latestPositions.forEach(pos => {
      if (!userLatestMap[pos.userId] || 
          new Date(pos.recordedAt) > new Date(userLatestMap[pos.userId].recordedAt)) {
        userLatestMap[pos.userId] = pos;
      }
    });

    const positions = Object.values(userLatestMap);

    // Enrichir avec les calculs de distance et géofencing
    const enrichedPositions = positions.map(pos => {
      let isInsideGeofence = true;
      let distanceFromEvent = null;

      if (event.latitude && event.longitude) {
        const distance = geoService.calculateDistance(
          parseFloat(pos.latitude),
          parseFloat(pos.longitude),
          parseFloat(event.latitude),
          parseFloat(event.longitude)
        );
        distanceFromEvent = Math.round(distance);
        isInsideGeofence = distance <= (event.geoRadius || 100);
      }

      return {
        id: pos.id,
        userId: pos.userId,
        latitude: parseFloat(pos.latitude),
        longitude: parseFloat(pos.longitude),
        accuracy: pos.accuracy,
        speed: pos.speed,
        heading: pos.heading,
        batteryLevel: pos.batteryLevel,
        isInsideGeofence,
        distanceFromEvent,
        createdAt: pos.recordedAt,
        user: pos.user
      };
    });

    res.json({
      success: true,
      positions: enrichedPositions,
      event: {
        id: event.id,
        name: event.name,
        latitude: event.latitude,
        longitude: event.longitude,
        geoRadius: event.geoRadius || 100
      }
    });

  } catch (error) {
    console.error('Get realtime positions error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des positions',
      error: error.message
    });
  }
};

/**
 * Obtenir les alertes de tracking
 */
exports.getTrackingAlerts = async (req, res) => {
  try {
    const { eventId, isResolved, severity, limit = 50 } = req.query;

    const where = {};
    if (eventId) where.eventId = eventId;
    // Note: isResolved column doesn't exist yet, skip this filter
    // if (isResolved !== undefined) where.isResolved = isResolved === 'true';
    if (severity) where.severity = severity;

    const alerts = await FraudAttempt.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      attributes: { 
        exclude: ['isResolved', 'resolvedAt', 'resolvedBy', 'resolution'] // Exclude columns that don't exist in DB yet
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'employeeId', 'firstName', 'lastName', 'profilePhoto'],
        required: false
      }, {
        model: Event,
        as: 'event',
        attributes: ['id', 'name', 'latitude', 'longitude', 'geoRadius'],
        required: false
      }]
    });

    // Formater les alertes
    const formattedAlerts = alerts.map(alert => ({
      id: alert.id,
      alertType: alert.attemptType,
      title: getAlertTitle(alert.attemptType),
      message: alert.description,
      severity: mapSeverityToAlert(alert.severity),
      latitude: alert.latitude ? parseFloat(alert.latitude) : null,
      longitude: alert.longitude ? parseFloat(alert.longitude) : null,
      distanceFromZone: alert.details?.distance || null,
      isResolved: false, // Column doesn't exist yet, default to false
      resolvedAt: null,  // Column doesn't exist yet
      createdAt: alert.createdAt,
      user: alert.user,
      event: alert.event
    }));

    res.json({
      success: true,
      alerts: formattedAlerts
    });

  } catch (error) {
    console.error('Get tracking alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des alertes',
      error: error.message
    });
  }
};

/**
 * Résoudre une alerte
 */
exports.resolveAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const { resolution } = req.body;

    const alert = await FraudAttempt.findByPk(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alerte non trouvée'
      });
    }

    await alert.update({
      isResolved: true,
      resolvedAt: new Date(),
      resolvedBy: req.user.id,
      resolution: resolution || 'Résolu par administrateur'
    });

    res.json({
      success: true,
      message: 'Alerte résolue avec succès'
    });

  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la résolution de l\'alerte'
    });
  }
};

/**
 * Build timeline segments from ordered GeoTracking points
 */
function buildPresenceTimeline(points) {
  if (points.length === 0) {
    return { segments: [], totalInZoneMinutes: 0, totalOutZoneMinutes: 0, totalOfflineMinutes: 0, compliancePercent: 0 };
  }

  const GAP_MS = 5 * 60 * 1000; // 5-minute gap threshold
  const segments = [];
  let segStart = new Date(points[0].createdAt);
  let segStatus = points[0].isWithinGeofence ? 'in_zone' : 'out_zone';

  for (let i = 1; i < points.length; i++) {
    const prevTime = new Date(points[i - 1].createdAt);
    const currTime = new Date(points[i].createdAt);
    const gap = currTime - prevTime;

    if (gap > GAP_MS) {
      segments.push({ start: segStart, end: prevTime, status: segStatus, durationMinutes: Math.round((prevTime - segStart) / 60000) });
      segments.push({ start: prevTime, end: currTime, status: 'offline', durationMinutes: Math.round(gap / 60000) });
      segStart = currTime;
      segStatus = points[i].isWithinGeofence ? 'in_zone' : 'out_zone';
    } else {
      const currStatus = points[i].isWithinGeofence ? 'in_zone' : 'out_zone';
      if (currStatus !== segStatus) {
        segments.push({ start: segStart, end: currTime, status: segStatus, durationMinutes: Math.round((currTime - segStart) / 60000) });
        segStart = currTime;
        segStatus = currStatus;
      }
    }
  }

  const lastTime = new Date(points[points.length - 1].createdAt);
  segments.push({ start: segStart, end: lastTime, status: segStatus, durationMinutes: Math.round((lastTime - segStart) / 60000) });

  const totalInZoneMinutes = segments.filter(s => s.status === 'in_zone').reduce((s, x) => s + x.durationMinutes, 0);
  const totalOutZoneMinutes = segments.filter(s => s.status === 'out_zone').reduce((s, x) => s + x.durationMinutes, 0);
  const totalOfflineMinutes = segments.filter(s => s.status === 'offline').reduce((s, x) => s + x.durationMinutes, 0);
  const totalMinutes = totalInZoneMinutes + totalOutZoneMinutes + totalOfflineMinutes;
  const compliancePercent = totalMinutes > 0 ? Math.round((totalInZoneMinutes / totalMinutes) * 10000) / 100 : 0;

  return { segments, totalInZoneMinutes, totalOutZoneMinutes, totalOfflineMinutes, compliancePercent };
}

/**
 * GET /api/tracking/timeline/:eventId/:agentId
 * Presence timeline for an agent during an event
 */
exports.getPresenceTimeline = async (req, res) => {
  try {
    const { eventId, agentId } = req.params;

    const points = await GeoTracking.findAll({
      where: { userId: agentId, eventId },
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'isWithinGeofence', 'distanceFromEvent', 'createdAt', 'recordedAt']
    });

    const timeline = buildPresenceTimeline(points);

    res.json({ success: true, data: timeline });
  } catch (error) {
    console.error('Get presence timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la timeline de présence',
      error: error.message
    });
  }
};

// Helper functions
function getAlertTitle(alertType) {
  const titles = {
    'gps_spoofing': 'GPS Spoofing détecté',
    'out_of_zone': 'Agent hors zone',
    'late_arrival': 'Retard',
    'low_battery': 'Batterie faible',
    'connection_lost': 'Connexion perdue'
  };
  return titles[alertType] || 'Alerte';
}

function mapSeverityToAlert(severity) {
  const mapping = {
    'critical': 'critical',
    'high': 'critical',
    'medium': 'warning',
    'low': 'info'
  };
  return mapping[severity] || 'info';
}
