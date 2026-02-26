const { Attendance, Assignment, Event, User, Zone, GeoTracking } = require('../models');
const { Op } = require('sequelize');
const { logActivity } = require('../middlewares/activityLogger');
const geoService = require('../services/geoService');
const notificationService = require('../services/notificationService');
const { broadcastAttendance } = require('../utils/socketBroadcast');

// Get device info (IP address and device info)
exports.getDeviceInfo = async (req, res) => {
  try {
    // Get IP address from request headers
    let ipAddress = req.headers['x-forwarded-for'] || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress || 
                   req.connection.socket?.remoteAddress ||
                   'Unknown';
    
    // If x-forwarded-for has multiple IPs, take the first one
    if (ipAddress.includes(',')) {
      ipAddress = ipAddress.split(',')[0].trim();
    }
    
    // Convert IPv6 localhost to more readable format
    if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
      ipAddress = '127.0.0.1 (localhost)';
    }
    
    // Clean IPv6 mapped IPv4 addresses
    if (ipAddress.startsWith('::ffff:')) {
      ipAddress = ipAddress.replace('::ffff:', '');
    }

    // Get device info from user agent
    const userAgent = req.headers['user-agent'] || '';
    let deviceName = 'Unknown';
    
    if (userAgent.includes('Windows')) deviceName = 'Windows PC';
    else if (userAgent.includes('Mac')) deviceName = 'Mac';
    else if (userAgent.includes('Android')) deviceName = 'Android Device';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) deviceName = 'iOS Device';
    else if (userAgent.includes('Linux')) deviceName = 'Linux';
    
    console.log('📱 Device Info Request:', { ipAddress, deviceName });

    res.json({
      success: true,
      data: {
        ipAddress,
        deviceName,
        userAgent
      }
    });
  } catch (error) {
    console.error('Device info error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des informations d\'appareil'
    });
  }
};

// Check-in
exports.checkIn = async (req, res) => {
  try {
    const {
      eventId,
      latitude: _latitude,
      longitude: _longitude,
      // Fallback: mobile may send checkInLatitude/checkInLongitude
      checkInLatitude,
      checkInLongitude,
      checkInPhoto,
      checkInMethod = 'facial',
      facialMatchScore,
      // Alternative fields from CheckIn page
      accuracy,
      facialVerified,
      facialVerifiedAt,
      deviceFingerprint,
      deviceInfo,
      // NEW: Allow admin/supervisor to check in for an agent
      agentId: requestedAgentId
    } = req.body;

    console.log('✅ CHECK-IN REQUEST RECEIVED:', {
      eventId,
      latitude,
      longitude,
      checkInMethod,
      facialMatchScore,
      facialVerified,
      photoLength: checkInPhoto ? checkInPhoto.length : 0,
      connectedUser: req.user?.id,
      connectedUserRole: req.user?.role,
      requestedAgentId
    });

    // Validate required fields
    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID est requis'
      });
    }

    // Validate GPS coordinates - allow 0 values but not null/undefined
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Position GPS est requise'
      });
    }
    
    // Check for valid numeric values (but don't reassign, just validate)
    const numLat = parseFloat(latitude);
    const numLng = parseFloat(longitude);
    if (isNaN(numLat) || isNaN(numLng)) {
      return res.status(400).json({
        success: false,
        message: 'Coordonnées GPS invalides'
      });
    }

    // Note: checkInPhoto is now optional since CheckIn page doesn't send it
    // Warn if photo is too large
    if (checkInPhoto && checkInPhoto.length > 2000000) {
      console.warn('⚠️ CHECK-IN PHOTO IS VERY LARGE:', checkInPhoto.length, 'bytes');
    }

    // Determine the actual agent ID:
    // - If admin/supervisor is making a check-in for someone else (requestedAgentId provided)
    // - Otherwise use the connected user's ID
    let agentId = req.user.id;
    let checkedInBy = null;

    if (requestedAgentId && (req.user.role === 'admin' || req.user.role === 'supervisor')) {
      // Admin/Supervisor is checking in for another agent
      agentId = requestedAgentId;
      checkedInBy = req.user.id;
      console.log(`👤 ${req.user.role.toUpperCase()} ${req.user.id} is checking in for agent ${agentId}`);
    } else if (requestedAgentId && req.user.role !== 'admin' && req.user.role !== 'supervisor') {
      // Regular agent trying to check in for someone else - not allowed
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas la permission de pointer pour un autre agent'
      });
    }
    const today = new Date().toISOString().split('T')[0];

    // Check if agent is assigned to this event
    console.log('🔍 Checking assignment for:', {
      agentId,
      eventId,
      today,
      userId: req.user.id,
      userRole: req.user.role
    });

    // Find assignment for this agent and event
    const assignment = await Assignment.findOne({
      where: {
        agentId: agentId,
        eventId,
        status: 'confirmed'
      }
    });

    console.log('📋 Assignment found:', assignment ? 'YES' : 'NO', assignment);

    if (!assignment) {
      // Log all assignments for debugging
      const allAssignments = await Assignment.findAll({
        where: { agentId },
        include: [{ model: Event, as: 'event' }]
      });
      console.log(`📋 All assignments for agent ${agentId}:`, allAssignments.length);
      allAssignments.forEach(a => {
        console.log(`  - Event: ${a.event?.name || a.eventId}, Status: ${a.status}`);
      });

      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas affecté à cet événement ou l\'affectation n\'est pas confirmée'
      });
    }

    // Get event details
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Événement non trouvé'
      });
    }

    // ✅ VÉRIFICATION STRICTE DES FENÊTRES DE TEMPS
    const { isCheckInAllowed, getEventTimeStatus } = require('../utils/eventTimeWindows');
    const timeStatus = getEventTimeStatus(event);

    // Vérifier si le check-in est autorisé (2h avant → début + tolérance retard)
    if (!timeStatus.canCheckIn) {
      let detailedMessage = '';
      
      if (timeStatus.isBeforeWindow) {
        const eventStart = new Date(event.startDate);
        const twoHoursBefore = new Date(eventStart.getTime() - 2 * 60 * 60 * 1000);
        const lateThreshold = event.lateThreshold || 15;
        const checkInEnd = new Date(eventStart.getTime() + lateThreshold * 60 * 1000);
        
        detailedMessage = `Le check-in sera disponible de 2h avant le début (${twoHoursBefore.toLocaleString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        })}) jusqu'à ${lateThreshold} min après le début (${checkInEnd.toLocaleString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        })}).`;
      } else if (timeStatus.isAfterCheckInWindow) {
        const lateThreshold = event.lateThreshold || 15;
        detailedMessage = `Le délai de check-in est dépassé (tolérance de ${lateThreshold} minutes après le début).`;
      } else if (timeStatus.isAfterEvent) {
        detailedMessage = 'L\'événement est terminé. Le check-in n\'est plus disponible.';
      } else {
        detailedMessage = 'Le check-in n\'est pas disponible pour le moment.';
      }

      return res.status(403).json({
        success: false,
        message: detailedMessage,
        code: 'CHECKIN_NOT_ALLOWED',
        data: {
          timeStatus,
          event: {
            name: event.name,
            startDate: event.startDate,
            endDate: event.endDate,
            lateThreshold: event.lateThreshold || 15
          }
        }
      });
    }

    // Check for existing attendance
    let attendance = await Attendance.findOne({
      where: { agentId, eventId, date: today }
    });

    if (attendance && attendance.checkInTime) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà pointé pour cet événement aujourd\'hui',
        data: attendance
      });
    }

    // Check geofence
    let isWithinGeofence = null;
    let distanceFromLocation = null;

    if (latitude && longitude && event.latitude && event.longitude) {
      const geoCheck = geoService.checkGeofence(latitude, longitude, event);
      isWithinGeofence = geoCheck.isWithinGeofence;
      distanceFromLocation = geoCheck.distance;

      // Optional: Block check-in if outside geofence
      // if (!isWithinGeofence) {
      //   return res.status(400).json({
      //     success: false,
      //     message: geoCheck.message
      //   });
      // }
    }

    // Determine status (present or late)
    const now = new Date();
    const [checkInHour, checkInMinute] = event.checkInTime.split(':');
    const expectedCheckIn = new Date(today);
    expectedCheckIn.setHours(parseInt(checkInHour), parseInt(checkInMinute), 0, 0);

    const lateThreshold = event.lateThreshold || 15;
    const lateTime = new Date(expectedCheckIn.getTime() + lateThreshold * 60000);

    const status = now > lateTime ? 'late' : 'present';

    // Normalize facialMatchScore to ensure it's between 0-1
    let normalizedScore = facialMatchScore;
    if (facialMatchScore && facialMatchScore > 1) {
      normalizedScore = facialMatchScore / 100;
    }

    // Create or update attendance
    if (attendance) {
      attendance.checkInTime = now;
      attendance.checkInLatitude = latitude;
      attendance.checkInLongitude = longitude;
      attendance.checkInPhoto = checkInPhoto;
      attendance.checkInMethod = checkInMethod;
      attendance.checkInDeviceName = deviceInfo?.deviceName || null;
      attendance.checkInDeviceIP = deviceInfo?.ipAddress || null;
      attendance.checkInDeviceMAC = deviceInfo?.macAddress || null;
      attendance.checkedInBy = checkedInBy; // Track if admin/supervisor performed the check-in
      attendance.facialMatchScore = normalizedScore;
      attendance.facialVerified = facialVerified || (normalizedScore && normalizedScore >= 0.5);
      if (facialVerified || (normalizedScore && normalizedScore >= 0.5)) {
        attendance.facialVerifiedAt = now;
      }
      attendance.status = status;
      attendance.isWithinGeofence = isWithinGeofence;
      attendance.distanceFromLocation = distanceFromLocation;
    } else {
      const isFacialVerified = facialVerified || (normalizedScore && normalizedScore >= 0.5);
      attendance = await Attendance.create({
        agentId,
        eventId,
        date: today,
        checkInTime: now,
        checkInLatitude: latitude,
        checkInLongitude: longitude,
        checkInPhoto,
        checkInMethod,
        checkInDeviceName: deviceInfo?.deviceName || null,
        checkInDeviceIP: deviceInfo?.ipAddress || null,
        checkInDeviceMAC: deviceInfo?.macAddress || null,
        checkedInBy, // Track if admin/supervisor performed the check-in
        facialMatchScore: normalizedScore,
        facialVerified: isFacialVerified,
        facialVerifiedAt: isFacialVerified ? now : null,
        status,
        isWithinGeofence,
        distanceFromLocation
      });
    }

    await attendance.save();

    console.log('✅ CHECK-IN SAVED TO DATABASE:', {
      attendanceId: attendance.id,
      checkInTime: attendance.checkInTime,
      facialMatchScore: attendance.facialMatchScore,
      checkInMethod: attendance.checkInMethod,
      status: attendance.status
    });

    // Enregistrer la position GPS dans GeoTracking pour le suivi en temps réel
    if (latitude && longitude) {
      try {
        await GeoTracking.create({
          userId: agentId,
          eventId: eventId,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          accuracy: deviceInfo?.accuracy ? parseFloat(deviceInfo.accuracy) : null,
          batteryLevel: deviceInfo?.batteryLevel ? parseInt(deviceInfo.batteryLevel) : null,
          isWithinGeofence: isWithinGeofence !== null ? isWithinGeofence : true,
          distanceFromEvent: distanceFromLocation ? parseFloat(distanceFromLocation) : null,
          recordedAt: now,
          createdAt: now
        });
        console.log('📍 Position GPS enregistrée dans GeoTracking pour le suivi en temps réel');

        // ✅ NOUVEAU: Démarrer le tracking GPS en temps réel
        const io = req.app.get('io');
        const gpsTrackingService = req.app.get('gpsTrackingService');
        
        if (io && gpsTrackingService) {
          const user = await User.findByPk(agentId, {
            attributes: ['id', 'firstName', 'lastName', 'employeeId', 'role', 'phone', 'cin']
          });

          const initialPosition = {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            accuracy: deviceInfo?.accuracy ? parseFloat(deviceInfo.accuracy) : null,
            batteryLevel: deviceInfo?.batteryLevel ? parseInt(deviceInfo.batteryLevel) : 100,
            isMoving: false
          };

          // Démarrer le tracking GPS automatique
          await gpsTrackingService.startTracking(user.id, eventId, initialPosition);
          console.log(`🚀 Tracking GPS démarré pour ${user.firstName} ${user.lastName} sur événement ${eventId}`);
        }
      } catch (geoError) {
        console.error('⚠️ Erreur lors de l\'enregistrement de la position GPS:', geoError.message);
        console.error('Stack:', geoError.stack);
        // Ne pas bloquer le check-in si l'enregistrement GPS échoue
      }
    }

    // If late, notify supervisors
    if (status === 'late') {
      const supervisors = await User.findAll({
        where: { role: { [Op.in]: ['supervisor', 'admin'] }, status: 'active' }
      });
      try {
        await notificationService.notifyLateAlert(req.user, event, supervisors);
      } catch (err) {
        console.error('Late notification error:', err);
      }
    }

    await logActivity({
      userId: agentId,
      action: 'CHECK_IN',
      entityType: 'attendance',
      entityId: attendance.id,
      description: `Pointage d'entrée pour "${event.name}"`,
      newValues: {
        status,
        time: now,
        isWithinGeofence,
        distanceFromLocation
      },
      req
    });

    res.status(201).json({
      success: true,
      message: status === 'late' ? 'Pointage enregistré (Retard)' : 'Pointage enregistré',
      data: {
        attendance,
        event: {
          name: event.name,
          location: event.location,
          checkOutTime: event.checkOutTime
        },
        geoStatus: {
          isWithinGeofence,
          distance: distanceFromLocation,
          message: isWithinGeofence === false
            ? `Hors zone (${distanceFromLocation}m)`
            : 'Dans la zone'
        }
      }
    });
  } catch (error) {
    console.error('❌ CHECK-IN ERROR:', {
      message: error.message,
      code: error.code,
      sql: error.sql,
      stack: error.stack,
      details: error.errors ? error.errors.map(e => e.message) : []
    });
    res.status(500).json({
      success: false,
      message: 'Erreur lors du pointage',
      error: error.message,
      details: error.errors ? error.errors.map(e => e.message) : []
    });
  }
};

// Check-out
exports.checkOut = async (req, res) => {
  try {
    const {
      latitude: _latitude,
      longitude: _longitude,
      // Fallback: mobile may send checkOutLatitude/checkOutLongitude
      checkOutLatitude,
      checkOutLongitude,
      checkOutPhoto,
      checkOutMethod = 'facial',
      notes
    } = req.body;

    // Support both field name formats
    const latitude = _latitude ?? checkOutLatitude;
    const longitude = _longitude ?? checkOutLongitude;

    const { isCheckOutAllowed, getEventTimeStatus } = require('../utils/eventTimeWindows');

    const agentId = req.user.id;
    const attendanceId = req.params.id;

    const attendance = await Attendance.findOne({
      where: { id: attendanceId, agentId },
      include: [{ model: Event, as: 'event' }]
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Pointage d\'entrée non trouvé'
      });
    }

    if (!attendance.checkInTime) {
      return res.status(400).json({
        success: false,
        message: 'Vous devez d\'abord pointer votre entrée'
      });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà pointé votre sortie'
      });
    }

    // ✅ VÉRIFICATION STRICTE: Check-out avec tolérance anticipé/tardif
    const event = attendance.event;
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Événement non trouvé'
      });
    }

    const timeStatus = getEventTimeStatus(event);

    if (!timeStatus.canCheckOut) {
      let detailedMessage = '';
      
      const eventEnd = new Date(event.endDate);
      const earlyCheckoutTolerance = event.earlyCheckoutTolerance || 30;
      const lateCheckoutTolerance = event.lateCheckoutTolerance || 15;
      const checkOutStart = new Date(eventEnd.getTime() - earlyCheckoutTolerance * 60 * 1000);
      const checkOutEnd = new Date(eventEnd.getTime() + lateCheckoutTolerance * 60 * 1000);
      
      if (!timeStatus.isInCheckOutWindow && timeStatus.isDuringEvent) {
        detailedMessage = `Le check-out sera disponible de ${earlyCheckoutTolerance} min avant la fin (${checkOutStart.toLocaleString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        })}) jusqu'à ${lateCheckoutTolerance} min après la fin (${checkOutEnd.toLocaleString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        })}).`;
      } else if (timeStatus.isAfterCheckOutWindow) {
        detailedMessage = `Le délai de check-out est dépassé (tolérance de ${lateCheckoutTolerance} minutes après la fin).`;
      } else {
        detailedMessage = 'Le check-out n\'est pas encore disponible.';
      }

      return res.status(403).json({
        success: false,
        message: detailedMessage,
        code: 'CHECKOUT_NOT_ALLOWED',
        data: {
          timeStatus,
          event: {
            name: event.name,
            endDate: event.endDate,
            earlyCheckoutTolerance: earlyCheckoutTolerance,
            lateCheckoutTolerance: lateCheckoutTolerance
          }
        }
      });
    }

    const now = new Date();

    // Check for early departure
    const [checkOutHour, checkOutMinute] = attendance.event.checkOutTime.split(':');
    const expectedCheckOut = new Date(attendance.date);
    expectedCheckOut.setHours(parseInt(checkOutHour), parseInt(checkOutMinute), 0, 0);

    if (now < expectedCheckOut) {
      attendance.status = 'early_departure';
    }

    attendance.checkOutTime = now;
    attendance.checkOutLatitude = latitude;
    attendance.checkOutLongitude = longitude;
    attendance.checkOutPhoto = checkOutPhoto;
    attendance.checkOutMethod = checkOutMethod;
    if (notes) attendance.notes = notes;

    // Calculate total hours
    const checkIn = new Date(attendance.checkInTime);
    const hours = (now - checkIn) / (1000 * 60 * 60);
    attendance.totalHours = Math.round(hours * 100) / 100;

    // Check geofence for checkout
    if (latitude && longitude && attendance.event.latitude && attendance.event.longitude) {
      const geoCheck = geoService.checkGeofence(latitude, longitude, attendance.event);
      attendance.checkOutLatitude = latitude;
      attendance.checkOutLongitude = longitude;

      // ✅ NOUVEAU: Arrêter le tracking GPS et enregistrer position check-out
      try {
        await GeoTracking.create({
          userId: agentId,
          eventId: attendance.eventId,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          accuracy: req.body.accuracy ? parseFloat(req.body.accuracy) : null,
          batteryLevel: req.body.batteryLevel ? parseInt(req.body.batteryLevel) : null,
          isWithinGeofence: geoCheck?.isWithinGeofence || true,
          distanceFromEvent: geoCheck?.distance ? parseFloat(geoCheck.distance) : null,
          recordedAt: now,
          createdAt: now
        });

        // Arrêter le tracking GPS automatique
        const gpsTrackingService = req.app.get('gpsTrackingService');
        if (gpsTrackingService) {
          await gpsTrackingService.stopTracking(agentId);
          console.log(`⏹️ Tracking GPS arrêté pour agent ${agentId} lors du check-out`);
        }
      } catch (geoError) {
        console.error('⚠️ Erreur enregistrement position check-out:', geoError.message);
      }
    }

    await attendance.save();

    await logActivity({
      userId: agentId,
      action: 'CHECK_OUT',
      entityType: 'attendance',
      entityId: attendance.id,
      description: `Pointage de sortie pour "${attendance.event.name}"`,
      newValues: {
        checkOutTime: now,
        totalHours: attendance.totalHours
      },
      req
    });

    res.json({
      success: true,
      message: 'Pointage de sortie enregistré',
      data: {
        attendance,
        summary: {
          checkIn: attendance.checkInTime,
          checkOut: attendance.checkOutTime,
          totalHours: attendance.totalHours,
          status: attendance.status
        }
      }
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du pointage de sortie'
    });
  }
};

// Get attendance records
exports.getAttendances = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      eventId,
      agentId,
      status,
      startDate,
      endDate,
      date,
      sortBy = 'date',
      sortOrder = 'DESC'
    } = req.query;

    const where = {};
    
    // If user is an agent, only show their attendance
    if (req.user.role === 'agent') {
      where.agentId = req.user.id;
    } else if (agentId) {
      // If admin/supervisor and they specified agentId, use it
      where.agentId = agentId;
    }
    
    if (eventId) where.eventId = eventId;
    if (status) where.status = status;
    // Support both single date and date range
    if (date) {
      where.date = date;
    } else if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.date = { [Op.gte]: startDate };
    } else if (endDate) {
      where.date = { [Op.lte]: endDate };
    }

    const { count, rows } = await Attendance.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'employeeId', 'firstName', 'lastName', 'phone', 'profilePhoto']
        },
        {
          model: Event,
          as: 'event',
          attributes: ['id', 'name', 'location', 'checkInTime', 'checkOutTime']
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    // Fetch zone assignments for each attendance (safe - errors don't break response)
    for (const attendance of rows) {
      try {
        if (attendance.agentId && attendance.eventId) {
          const assignment = await Assignment.findOne({
            where: {
              agentId: attendance.agentId,
              eventId: attendance.eventId,
              status: 'confirmed'
            },
            include: [{
              model: Zone,
              as: 'zone',
              attributes: ['id', 'name', 'color', 'description'],
              required: false
            }]
          });
          
          if (assignment) {
            attendance.dataValues.assignment = assignment;
          }
        }
      } catch (zoneErr) {
        // Zone lookup failed - continue without zone info
        console.log('⚠️ Zone lookup skipped for attendance:', attendance.id);
      }
    }

    res.json({
      success: true,
      data: {
        attendances: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('❌ getAttendances ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des présences',
      error: error.message
    });
  }
};

// Get attendance by ID
exports.getAttendanceById = async (req, res) => {
  try {
    const attendance = await Attendance.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'agent',
          attributes: { exclude: ['password', 'refreshToken', 'facialVector'] }
        },
        {
          model: Event,
          as: 'event'
        }
      ]
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Présence non trouvée'
      });
    }

    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la présence'
    });
  }
};

// Get my attendance (for agents)
exports.getMyAttendance = async (req, res) => {
  try {
    const { startDate, endDate, eventId } = req.query;
    const where = { agentId: req.user.id };

    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    }
    if (eventId) where.eventId = eventId;

    const attendances = await Attendance.findAll({
      where,
      include: [
        {
          model: Event,
          as: 'event',
          attributes: ['id', 'name', 'location', 'checkInTime', 'checkOutTime']
        }
      ],
      order: [['date', 'DESC']]
    });

    res.json({
      success: true,
      data: attendances
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de vos présences'
    });
  }
};

// Get today's attendance status for agent
exports.getTodayStatus = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const attendances = await Attendance.findAll({
      where: {
        agentId: req.user.id,
        date: today
      },
      include: [
        {
          model: Event,
          as: 'event',
          attributes: ['id', 'name', 'location', 'checkInTime', 'checkOutTime']
        }
      ]
    });

    // Get today's assignments
    const assignments = await Assignment.findAll({
      where: {
        agentId: req.user.id,
        status: 'confirmed'
      },
      include: [
        {
          model: Event,
          as: 'event',
          where: {
            startDate: { [Op.lte]: today },
            endDate: { [Op.gte]: today },
            status: { [Op.in]: ['scheduled', 'active'] }
          }
        }
      ]
    });

    const todayEvents = assignments.map(a => ({
      eventId: a.event.id,
      eventName: a.event.name,
      location: a.event.location,
      checkInTime: a.event.checkInTime,
      checkOutTime: a.event.checkOutTime,
      attendance: attendances.find(att => att.eventId === a.event.id) || null
    }));

    res.json({
      success: true,
      data: {
        date: today,
        events: todayEvents
      }
    });
  } catch (error) {
    console.error('❌ getTodayStatus ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut du jour',
      error: error.message
    });
  }
};

// Manual attendance update (admin/supervisor)
exports.updateAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findByPk(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Présence non trouvée'
      });
    }

    const oldValues = attendance.toJSON();
    const { status, notes, checkInTime, checkOutTime } = req.body;

    if (status) attendance.status = status;
    if (notes !== undefined) attendance.notes = notes;
    if (checkInTime) attendance.checkInTime = checkInTime;
    if (checkOutTime) attendance.checkOutTime = checkOutTime;

    attendance.verifiedBy = req.user.id;
    attendance.verifiedAt = new Date();

    await attendance.save();

    await logActivity({
      userId: req.user.id,
      action: 'UPDATE_ATTENDANCE',
      entityType: 'attendance',
      entityId: attendance.id,
      description: 'Présence mise à jour manuellement',
      oldValues,
      newValues: attendance.toJSON(),
      req
    });

    res.json({
      success: true,
      message: 'Présence mise à jour',
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la présence'
    });
  }
};

// Mark absent (for supervisors/admins)
exports.markAbsent = async (req, res) => {
  try {
    const { agentId, eventId, date, notes } = req.body;

    // Check for existing attendance
    let attendance = await Attendance.findOne({
      where: { agentId, eventId, date }
    });

    if (attendance) {
      return res.status(400).json({
        success: false,
        message: 'Un enregistrement existe déjà pour cette date'
      });
    }

    attendance = await Attendance.create({
      agentId,
      eventId,
      date,
      status: 'absent',
      notes,
      verifiedBy: req.user.id,
      verifiedAt: new Date()
    });

    // Notify supervisors about absence
    const agent = await User.findByPk(agentId);
    const event = await Event.findByPk(eventId);
    const supervisors = await User.findAll({
      where: { role: { [Op.in]: ['supervisor', 'admin'] }, status: 'active' }
    });

    try {
      await notificationService.notifyAbsenceAlert(agent, event, supervisors);
    } catch (err) {
      console.error('Absence notification error:', err);
    }

    await logActivity({
      userId: req.user.id,
      action: 'MARK_ABSENT',
      entityType: 'attendance',
      entityId: attendance.id,
      description: `Agent marqué absent`,
      newValues: attendance.toJSON(),
      req
    });

    res.status(201).json({
      success: true,
      message: 'Absence enregistrée',
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement de l\'absence'
    });
  }
};

// Get personal stats for the authenticated agent (used by mobile /attendance/my-stats)
exports.getMyStats = async (req, res) => {
  try {
    const where = { agentId: req.user.id };

    const attendances = await Attendance.findAll({ where });

    const present = attendances.filter(a => a.status === 'present').length;
    const late    = attendances.filter(a => a.status === 'late').length;
    const absent  = attendances.filter(a => a.status === 'absent').length;
    const total   = attendances.length;
    const totalHours = attendances.reduce((sum, a) => sum + (parseFloat(a.totalHours) || 0), 0);

    const punctualityRate = (present + late) > 0
      ? Math.round((present / (present + late)) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        presentCount: present,
        lateCount: late,
        absentCount: absent,
        total,
        totalHours: parseFloat(totalHours.toFixed(2)),
        punctualityRate,
        // also expose raw keys for compatibility
        present,
        late,
        absent
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur stats personnelles' });
  }
};

// Get paginated attendance history for the authenticated agent (used by mobile /attendance/my-history)
exports.getMyHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { agentId: req.user.id };
    if (status && status !== 'all') where.status = status;

    const { count, rows } = await Attendance.findAndCountAll({
      where,
      include: [{ model: Event, as: 'event', attributes: ['id', 'name', 'location', 'checkInTime', 'checkOutTime'] }],
      order: [['date', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: {
        attendances: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: offset + rows.length < count
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur historique présences' });
  }
};

// Get attendance statistics
exports.getAttendanceStats = async (req, res) => {
  try {
    const { startDate, endDate, eventId, agentId } = req.query;

    const where = {};
    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    }
    if (eventId) where.eventId = eventId;
    if (agentId) where.agentId = agentId;

    const attendances = await Attendance.findAll({ where });

    const stats = {
      total: attendances.length,
      present: attendances.filter(a => a.status === 'present').length,
      late: attendances.filter(a => a.status === 'late').length,
      absent: attendances.filter(a => a.status === 'absent').length,
      excused: attendances.filter(a => a.status === 'excused').length,
      earlyDeparture: attendances.filter(a => a.status === 'early_departure').length,
      totalHours: attendances.reduce((sum, a) => sum + (parseFloat(a.totalHours) || 0), 0),
      withinGeofence: attendances.filter(a => a.isWithinGeofence === true).length,
      outsideGeofence: attendances.filter(a => a.isWithinGeofence === false).length,
      facialVerified: attendances.filter(a => a.facialVerified === true).length,
      facialNotVerified: attendances.filter(a => a.facialVerified === false || !a.facialVerified).length
    };

    stats.attendanceRate = stats.total > 0
      ? Math.round(((stats.present + stats.late) / stats.total) * 100)
      : 0;

    stats.punctualityRate = (stats.present + stats.late) > 0
      ? Math.round((stats.present / (stats.present + stats.late)) * 100)
      : 0;

    stats.facialVerificationRate = stats.total > 0
      ? Math.round((stats.facialVerified / stats.total) * 100)
      : 0;

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};

// Real-time geolocation update
exports.updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // Find active attendance for today
    const attendance = await Attendance.findOne({
      where: {
        agentId: req.user.id,
        date: today,
        checkInTime: { [Op.not]: null },
        checkOutTime: null
      },
      include: [{ model: Event, as: 'event' }]
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Aucun pointage actif trouvé'
      });
    }

    // Check geofence
    const geoCheck = geoService.checkGeofence(latitude, longitude, attendance.event);

    // Emit location update via Socket.IO if configured
    const io = req.app.get('io');
    if (io) {
      io.to(`event-${attendance.eventId}`).emit('agent-location', {
        agentId: req.user.id,
        agentName: `${req.user.firstName} ${req.user.lastName}`,
        latitude,
        longitude,
        isWithinGeofence: geoCheck.isWithinGeofence,
        distance: geoCheck.distance,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      data: {
        isWithinGeofence: geoCheck.isWithinGeofence,
        distance: geoCheck.distance,
        message: geoCheck.message
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la position'
    });
  }
};
