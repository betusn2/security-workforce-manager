const { Event, Assignment, Attendance, User, Zone } = require('../models');
const { Op } = require('sequelize');
const { logActivity } = require('../middlewares/activityLogger');
const { computeEventStatus, combineDateAndTime } = require('../utils/eventHelpers');
const { broadcastEvent } = require('../utils/socketBroadcast');

/**
 * Middleware pour mettre à jour automatiquement les statuts des événements
 */
const updateEventStatuses = async (events) => {
  const eventsArray = Array.isArray(events) ? events : [events];
  
  for (const event of eventsArray) {
    const computedStatus = computeEventStatus(event);
    
    // Si le statut calculé est différent, mettre à jour
    if (computedStatus !== event.status && computedStatus === 'completed') {
      try {
        await Event.update(
          { status: 'completed' },
          { where: { id: event.id } }
        );
        event.status = 'completed';
        console.log(`✅ Event "${event.name}" auto-updated to completed`);
      } catch (error) {
        console.error(`❌ Error updating event ${event.id}:`, error);
      }
    }
    
    // Ajouter le statut calculé pour l'affichage
    event.computedStatus = computedStatus;
  }
  
  return eventsArray;
};

// Get all events with filters
exports.getEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      startDate,
      endDate,
      search,
      sortBy = 'startDate',
      sortOrder = 'DESC'
    } = req.query;

    const where = {};

    // Support pour plusieurs statuts séparés par des virgules
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      if (statuses.length > 1) {
        where.status = { [Op.in]: statuses };
      } else {
        where.status = status;
      }
    }
    if (type) where.type = type;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } }
      ];
    }
    if (startDate && endDate) {
      where.startDate = { [Op.between]: [startDate, endDate] };
    }

    const { count, rows } = await Event.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: User,
          as: 'supervisor',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: Assignment,
          as: 'assignments',
          attributes: ['id', 'status'],
          required: false
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      distinct: true
    });

    // Add assignment count to each event and calculer le statut correct
    const events = rows.map(event => {
      const eventJson = event.toJSON();
      const correctStatus = computeEventStatus(event);
      
      return {
        ...eventJson,
        status: correctStatus, // Toujours utiliser le statut calculé
        assignedAgentsCount: event.assignments?.filter(a =>
          ['pending', 'confirmed'].includes(a.status)
        ).length || 0
      };
    });

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des événements'
    });
  }
};

// Get event by ID
exports.getEventById = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: User,
          as: 'supervisor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'employeeId', 'phone']
        },
        {
          model: Assignment,
          as: 'assignments',
          required: false,
          include: [
            {
              model: User,
              as: 'agent',
              required: false,
              attributes: ['id', 'employeeId', 'firstName', 'lastName', 'phone', 'profilePhoto']
            }
          ]
        },
        {
          model: Attendance,
          as: 'attendances',
          required: false,
          include: [
            {
              model: User,
              as: 'agent',
              required: false,
              attributes: ['id', 'firstName', 'lastName']
            }
          ]
        }
      ]
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Événement non trouvé'
      });
    }

    // Calculer le statut correct
    const eventJson = event.toJSON();
    const correctStatus = computeEventStatus(event);
    
    res.json({
      success: true,
      data: {
        ...eventJson,
        status: correctStatus // Toujours utiliser le statut calculé
      }
    });
  } catch (error) {
    console.error('❌ Get event by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'événement',
      error: error.message
    });
  }
};

// Create event
exports.createEvent = async (req, res) => {
  try {
    const {
      name, description, type, location, latitude, longitude, geoRadius,
      startDate, endDate, checkInTime, checkOutTime, lateThreshold,
      requiredAgents, recurrence, notes
    } = req.body;

    const event = await Event.create({
      name,
      description,
      type: type || 'regular',
      location,
      latitude,
      longitude,
      geoRadius: geoRadius || 100,
      startDate,
      endDate,
      checkInTime,
      checkOutTime,
      lateThreshold: lateThreshold || 15,
      requiredAgents: requiredAgents || 1,
      status: 'scheduled',
      recurrence,
      notes,
      createdBy: req.user.id
    });

    await logActivity({
      userId: req.user.id,
      action: 'CREATE_EVENT',
      entityType: 'event',
      entityId: event.id,
      description: `Événement "${event.name}" créé`,
      newValues: event.toJSON(),
      req
    });

    // 🔥 BROADCAST TEMPS RÉEL - Nouvel événement
    broadcastEvent.created(event.toJSON(), { broadcast: 'all' });

    res.status(201).json({
      success: true,
      message: 'Événement créé avec succès',
      data: event
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'événement',
      error: error.message
    });
  }
};

// Update event
exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Événement non trouvé'
      });
    }

    console.log('📥 Données reçues pour mise à jour:', {
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      checkInTime: req.body.checkInTime,
      checkOutTime: req.body.checkOutTime
    });

    const oldValues = event.toJSON();
    const allowedFields = [
      'name', 'description', 'type', 'location', 'latitude', 'longitude',
      'geoRadius', 'startDate', 'endDate', 'checkInTime', 'checkOutTime',
      'lateThreshold', 'requiredAgents', 'status', 'recurrence', 'notes',
      'supervisorId', 'priority', 'color', 'recurrenceType', 'recurrenceEndDate', 'contactName', 'contactPhone'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        event[field] = req.body[field];
      }
    });

    await event.save();

    console.log('✅ Événement mis à jour:', {
      startDate: event.startDate,
      endDate: event.endDate,
      checkInTime: event.checkInTime,
      checkOutTime: event.checkOutTime
    });

    await logActivity({
      userId: req.user.id,
      action: 'UPDATE_EVENT',
      entityType: 'event',
      entityId: event.id,
      description: `Événement "${event.name}" mis à jour`,
      oldValues,
      newValues: event.toJSON(),
      req
    });

    // 🔥 BROADCAST TEMPS RÉEL - Événement modifié
    broadcastEvent.updated(event.toJSON(), { broadcast: 'all' });

    res.json({
      success: true,
      message: 'Événement mis à jour',
      data: event
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour événement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'événement'
    });
  }
};

// Delete event
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Événement non trouvé'
      });
    }

    // Check if event has active assignments
    const activeAssignments = await Assignment.count({
      where: {
        eventId: event.id,
        status: { [Op.in]: ['pending', 'confirmed'] }
      }
    });

    if (activeAssignments > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer: ${activeAssignments} affectation(s) active(s) existante(s)`
      });
    }

    await event.destroy();

    const eventData = event.toJSON();

    await logActivity({
      userId: req.user.id,
      action: 'DELETE_EVENT',
      entityType: 'event',
      entityId: event.id,
      description: `Événement "${event.name}" supprimé`,
      oldValues: eventData,
      req
    });

    // 🔥 BROADCAST TEMPS RÉEL - Événement supprimé
    broadcastEvent.deleted({ id: event.id, name: event.name }, { broadcast: 'all' });

    res.json({
      success: true,
      message: 'Événement supprimé'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'événement'
    });
  }
};

// Get active events for today
exports.getTodayEvents = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const events = await Event.findAll({
      where: {
        startDate: { [Op.lte]: tomorrow },
        endDate: { [Op.gte]: today },
        status: { [Op.in]: ['scheduled', 'active'] }
      },
      include: [
        {
          model: User,
          as: 'supervisor',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: Assignment,
          as: 'assignments',
          where: { status: { [Op.in]: ['pending', 'confirmed'] } },
          required: false,
          include: [
            {
              model: User,
              as: 'agent',
              attributes: ['id', 'firstName', 'lastName', 'phone']
            }
          ]
        }
      ],
      order: [['checkInTime', 'ASC']]
    });

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des événements du jour'
    });
  }
};

// Get events for agent
exports.getMyEvents = async (req, res) => {
  try {
    const { upcoming = 'true' } = req.query;

    const whereAssignment = {
      agentId: req.user.id,
      status: { [Op.in]: ['pending', 'confirmed'] }
    };

    // Utiliser une requête SQL brute pour gérer correctement le buffer de 2h après la fin
    const assignments = await Assignment.sequelize.query(`
      SELECT 
        a.id as assignmentId,
        a.status as assignmentStatus,
        a.role as assignmentRole,
        a.zoneId,
        e.id as eventId,
        e.name,
        e.description,
        e.location,
        e.startDate,
        e.endDate,
        e.checkInTime,
        e.checkOutTime,
        e.status as eventStatus,
        e.requiredAgents,
        e.supervisorId,
        DATE_ADD(
          CONCAT(DATE(e.endDate), ' ', IFNULL(e.checkOutTime, '23:59:59')), 
          INTERVAL 2 HOUR
        ) as eventEndPlus2h
      FROM assignments a
      INNER JOIN events e ON a.eventId = e.id
      WHERE a.agentId = ?
        AND a.status IN ('pending', 'confirmed')
        AND a.deletedAt IS NULL
        AND e.deletedAt IS NULL
        AND e.status NOT IN ('cancelled', 'terminated')
        ${upcoming === 'true' ? `AND DATE_ADD(
          CONCAT(DATE(e.endDate), ' ', IFNULL(e.checkOutTime, '23:59:59')), 
          INTERVAL 2 HOUR
        ) >= NOW()` : ''}
      ORDER BY e.startDate ASC
    `, {
      replacements: [req.user.id],
      type: Assignment.sequelize.QueryTypes.SELECT
    });

    // Charger les zones et superviseurs pour chaque assignment
    for (const assignment of assignments) {
      if (assignment.zoneId) {
        const zone = await Zone.findByPk(assignment.zoneId, {
          attributes: ['id', 'name', 'description', 'color', 'priority']
        });
        assignment.zone = zone;
      }
      
      // Charger le superviseur si présent
      if (assignment.supervisorId) {
        const supervisor = await User.findByPk(assignment.supervisorId, {
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        });
        assignment.supervisor = supervisor;
      }
    }

    const events = assignments.map(a => ({
      id: a.eventId,
      name: a.name,
      description: a.description,
      location: a.location,
      startDate: a.startDate,
      endDate: a.endDate,
      checkInTime: a.checkInTime,
      checkOutTime: a.checkOutTime,
      status: a.eventStatus,
      requiredAgents: a.requiredAgents,
      supervisorId: a.supervisorId,
      supervisor: a.supervisor,
      assignmentId: a.assignmentId,
      assignmentStatus: a.assignmentStatus,
      assignmentRole: a.assignmentRole,
      zone: a.zone
    }));

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Error in getMyEvents:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de vos événements'
    });
  }
};

// Get event statistics
exports.getEventStats = async (req, res) => {
  try {
    const eventId = req.params.id;

    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Événement non trouvé'
      });
    }

    const attendances = await Attendance.findAll({
      where: { eventId }
    });

    const assignments = await Assignment.findAll({
      where: { eventId }
    });

    const stats = {
      totalAssignments: assignments.length,
      confirmedAssignments: assignments.filter(a => a.status === 'confirmed').length,
      pendingAssignments: assignments.filter(a => a.status === 'pending').length,
      totalAttendances: attendances.length,
      presentCount: attendances.filter(a => a.status === 'present').length,
      lateCount: attendances.filter(a => a.status === 'late').length,
      absentCount: assignments.filter(a => a.status === 'confirmed').length - attendances.length,
      averageCheckInTime: null,
      totalHoursWorked: attendances.reduce((sum, a) => sum + (parseFloat(a.totalHours) || 0), 0)
    };

    // Calculate average check-in time
    const checkInTimes = attendances
      .filter(a => a.checkInTime)
      .map(a => new Date(a.checkInTime).getTime());

    if (checkInTimes.length > 0) {
      const avgTime = new Date(checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length);
      stats.averageCheckInTime = avgTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

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

// Get event notification statistics
exports.getEventNotificationStats = async (req, res) => {
  try {
    const eventId = req.params.id;

    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Événement non trouvé'
      });
    }

    const assignments = await Assignment.findAll({
      where: { eventId },
      include: [
        {
          model: User,
          as: 'agent',
          where: { status: 'active' },
          attributes: ['id', 'firstName', 'lastName', 'role']
        }
      ]
    });

    const supervisors = new Set();
    const agents = new Set();
    const confirmed = assignments.filter(a => a.status === 'confirmed');

    assignments.forEach(assignment => {
      if (assignment.agent) {
        // Utiliser assignment.role qui définit le rôle dans cette affectation
        if (assignment.role === 'supervisor') {
          supervisors.add(assignment.agentId);
        } else if (assignment.role === 'primary' || assignment.role === 'backup') {
          // primary et backup sont des agents
          agents.add(assignment.agentId);
        }
      }
    });

    res.json({
      success: true,
      data: {
        totalSupervisors: supervisors.size,
        totalAgents: agents.size,
        confirmedAssignments: confirmed.length,
        totalAssignments: assignments.length,
        event: {
          id: event.id,
          name: event.name,
          startDate: event.startDate,
          location: event.location
        }
      }
    });
  } catch (error) {
    console.error('Event notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques de notification'
    });
  }
};
