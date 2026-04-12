/**
 * phaseController.js
 * Gestion des confirmations de phases par le responsable.
 *
 * Endpoints:
 *   GET  /events/:id/phases               → statut + confirmations toutes phases
 *   POST /events/:id/phases/:phase/confirm → confirmer une phase (checklist)
 *   POST /events/:id/phases/setup/zones    → confirmer zones mise en place
 *   GET  /events/:id/supervised-agents     → agents supervisés + présence
 */

const { Event, User, Assignment, Attendance, Zone } = require('../models');
const { Op } = require('sequelize');

const VALID_PHASES = ['preparation', 'setup', 'execution'];

// ─── GET /events/:id/phases ───────────────────────────────────────────────────
exports.getPhaseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id, {
      attributes: [
        'id', 'name', 'startDate', 'endDate', 'checkInTime', 'checkOutTime', 'status', 'color',
        'preparationStartDate', 'preparationEndDate', 'preparationStartTime', 'preparationEndTime',
        'preparationResponsableId', 'preparationAgentsCount',
        'preparationConfirmed', 'preparationConfirmedAt', 'preparationConfirmedBy', 'preparationChecklist',
        'setupStartDate', 'setupEndDate', 'setupStartTime', 'setupEndTime',
        'setupResponsableId', 'setupAgentsCount',
        'setupConfirmed', 'setupConfirmedAt', 'setupConfirmedBy', 'setupChecklist', 'setupZonesConfirmed',
        'executionConfirmed', 'executionConfirmedAt', 'executionConfirmedBy', 'executionChecklist',
      ],
    });

    if (!event) return res.status(404).json({ success: false, message: 'Événement introuvable' });

    // Zones for this event
    const zones = await Zone.findAll({
      where: { eventId: id, isActive: true },
      attributes: ['id', 'name', 'description', 'color', 'setupConfirmed', 'setupConfirmedAt', 'setupConfirmedBy'],
      order: [['order', 'ASC']],
    });

    const buildPhaseInfo = (prefix, startDate, endDate, startTime, endTime, responsableId, agentsCount, confirmed, confirmedAt, confirmedBy, checklist) => ({
      startDate, endDate, startTime, endTime, responsableId, agentsCount,
      confirmed: !!confirmed,
      confirmedAt,
      confirmedBy,
      checklist: checklist || { phaseStarted: false, agentsPresent: false, zonesVerified: false, phaseDone: false },
    });

    const phases = {
      preparation: buildPhaseInfo(
        'preparation',
        event.preparationStartDate, event.preparationEndDate,
        event.preparationStartTime, event.preparationEndTime,
        event.preparationResponsableId, event.preparationAgentsCount,
        event.preparationConfirmed, event.preparationConfirmedAt, event.preparationConfirmedBy, event.preparationChecklist
      ),
      setup: {
        ...buildPhaseInfo(
          'setup',
          event.setupStartDate, event.setupEndDate,
          event.setupStartTime, event.setupEndTime,
          event.setupResponsableId, event.setupAgentsCount,
          event.setupConfirmed, event.setupConfirmedAt, event.setupConfirmedBy, event.setupChecklist
        ),
        zonesConfirmed: event.setupZonesConfirmed || [],
        zones,
      },
      execution: buildPhaseInfo(
        'execution',
        event.startDate, event.endDate,
        event.checkInTime, event.checkOutTime,
        null, null,
        event.executionConfirmed, event.executionConfirmedAt, event.executionConfirmedBy, event.executionChecklist
      ),
    };

    return res.json({ success: true, data: { event: { id: event.id, name: event.name, status: event.status, color: event.color }, phases } });
  } catch (err) {
    console.error('phaseController.getPhaseStatus:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── POST /events/:id/phases/:phase/confirm ───────────────────────────────────
exports.confirmPhase = async (req, res) => {
  try {
    const { id, phase } = req.params;
    if (!VALID_PHASES.includes(phase)) {
      return res.status(400).json({ success: false, message: 'Phase invalide. Valeurs: preparation, setup, execution' });
    }

    const { checklist } = req.body;  // { phaseStarted, agentsPresent, zonesVerified, phaseDone }
    const now = new Date();
    const responsableId = req.user.id;

    const updateData = {
      [`${phase}Confirmed`]: true,
      [`${phase}ConfirmedAt`]: now,
      [`${phase}ConfirmedBy`]: responsableId,
      [`${phase}Checklist`]: {
        phaseStarted:  !!checklist?.phaseStarted,
        agentsPresent: !!checklist?.agentsPresent,
        zonesVerified: !!checklist?.zonesVerified,
        phaseDone:     !!checklist?.phaseDone,
      },
    };

    const [updated] = await Event.update(updateData, { where: { id } });
    if (!updated) return res.status(404).json({ success: false, message: 'Événement introuvable' });

    return res.json({
      success: true,
      message: `Phase ${phase} confirmée avec succès`,
      data: {
        phase,
        confirmed: true,
        confirmedAt: now,
        confirmedBy: responsableId,
        checklist: updateData[`${phase}Checklist`],
      },
    });
  } catch (err) {
    console.error('phaseController.confirmPhase:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── POST /events/:id/phases/setup/zones ─────────────────────────────────────
exports.confirmSetupZones = async (req, res) => {
  try {
    const { id } = req.params;
    const { zoneIds } = req.body;  // array of zone IDs to confirm
    if (!Array.isArray(zoneIds)) {
      return res.status(400).json({ success: false, message: 'zoneIds doit être un tableau' });
    }

    const now = new Date();
    const responsableId = req.user.id;

    // Mark each zone as confirmed
    await Zone.update(
      { setupConfirmed: true, setupConfirmedAt: now, setupConfirmedBy: responsableId },
      { where: { id: { [Op.in]: zoneIds }, eventId: id } }
    );

    // Also store the array on the event
    await Event.update(
      { setupZonesConfirmed: zoneIds },
      { where: { id } }
    );

    return res.json({
      success: true,
      message: `${zoneIds.length} zone(s) confirmée(s) pour la mise en place`,
      data: { zonesConfirmed: zoneIds, confirmedAt: now, confirmedBy: responsableId },
    });
  } catch (err) {
    console.error('phaseController.confirmSetupZones:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── GET /events/:id/supervised-agents ────────────────────────────────────────
exports.getSupervisedAgents = async (req, res) => {
  try {
    const { id } = req.params;
    const supervisorId = req.user.id;
    const role = req.user.role;

    // Admin see all, supervisor sees their own agents
    const agentFilter = role === 'admin'
      ? {}
      : { supervisorId };

    // Get agents assigned to this event
    const assignments = await Assignment.findAll({
      where: { eventId: id, status: { [Op.in]: ['pending', 'confirmed'] } },
      include: [{
        model: User,
        as: 'agent',
        where: agentFilter,
        attributes: ['id', 'firstName', 'lastName', 'employeeId', 'role', 'profilePhoto', 'phone'],
        required: true,
      }],
    });

    // Get today's attendance for these agents
    const agentIds = assignments.map(a => a.agentId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendances = agentIds.length > 0
      ? await Attendance.findAll({
          where: {
            eventId: id,
            agentId: { [Op.in]: agentIds },
            checkInTime: { [Op.gte]: today, [Op.lt]: tomorrow },
          },
          attributes: ['agentId', 'checkInTime', 'checkOutTime', 'status'],
        })
      : [];

    const attendanceMap = {};
    attendances.forEach(a => { attendanceMap[a.agentId] = a; });

    const result = assignments.map(asgn => {
      const att = attendanceMap[asgn.agentId];
      return {
        assignmentId: asgn.id,
        assignmentStatus: asgn.status,
        agent: asgn.agent,
        attendance: att
          ? { checkInTime: att.checkInTime, checkOutTime: att.checkOutTime, status: att.status }
          : null,
        isPresent: !!att && att.status !== 'absent',
      };
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('phaseController.getSupervisedAgents:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
