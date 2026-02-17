/**
 * WhatsApp Controller
 * Gestion des notifications WhatsApp
 */

const whatsappService = require('../services/whatsappService');
const { User, Event, Assignment } = require('../models');
const { Op } = require('sequelize');

/**
 * Verifier le statut de WhatsApp
 */
exports.checkStatus = async (req, res) => {
  try {
    const status = await whatsappService.checkInstance();
    res.json({
      success: true,
      data: {
        configured: whatsappService.isConfigured(),
        ...status,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la verification du statut WhatsApp',
      error: error.message
    });
  }
};

/**
 * Obtenir le QR code pour connecter WhatsApp
 */
exports.getQRCode = async (req, res) => {
  try {
    const qrCode = await whatsappService.getQRCode();
    res.json({
      success: true,
      data: qrCode
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recuperation du QR code',
      error: error.message
    });
  }
};

/**
 * Initialiser l'instance WhatsApp
 */
exports.initInstance = async (req, res) => {
  try {
    const result = await whatsappService.createInstance();
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'initialisation de WhatsApp',
      error: error.message
    });
  }
};

/**
 * Envoyer un message de test
 */
exports.sendTestMessage = async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        message: 'Numero de telephone et message requis'
      });
    }

    const result = await whatsappService.sendTextMessage(phone, message);

    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du message',
      error: error.message
    });
  }
};

/**
 * Envoyer une notification d'affectation
 */
exports.sendAssignmentNotification = async (req, res) => {
  try {
    const { agentId, eventId } = req.body;

    const agent = await User.findByPk(agentId);
    const event = await Event.findByPk(eventId);

    if (!agent || !event) {
      return res.status(404).json({
        success: false,
        message: 'Agent ou evenement non trouve'
      });
    }

    if (!agent.phone) {
      return res.status(400).json({
        success: false,
        message: 'L\'agent n\'a pas de numero de telephone'
      });
    }

    const result = await whatsappService.sendAssignmentNotification(agent, event);

    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de la notification',
      error: error.message
    });
  }
};

/**
 * Envoyer un rappel de pointage
 */
exports.sendCheckInReminder = async (req, res) => {
  try {
    const { agentId, eventId } = req.body;

    const agent = await User.findByPk(agentId);
    const event = await Event.findByPk(eventId);

    if (!agent || !event) {
      return res.status(404).json({
        success: false,
        message: 'Agent ou evenement non trouve'
      });
    }

    const result = await whatsappService.sendCheckInReminder(agent, event);

    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du rappel',
      error: error.message
    });
  }
};

/**
 * Envoyer les plannings de la semaine a tous les agents
 */
exports.sendWeeklySchedules = async (req, res) => {
  try {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Recuperer tous les agents actifs
    const agents = await User.findAll({
      where: {
        role: 'agent',
        status: 'active'
      }
    });

    const results = [];

    for (const agent of agents) {
      if (!agent.phone) continue;

      // Recuperer les affectations de l'agent pour la semaine
      const assignments = await Assignment.findAll({
        where: {
          agentId: agent.id,
        },
        include: [{ 
          model: Event, 
          as: 'event',
          where: {
            startDate: {
              [Op.gte]: today,
              [Op.lte]: nextWeek
            }
          }
        }],
        order: [[{ model: Event, as: 'event' }, 'startDate', 'ASC']]
      });

      if (assignments.length > 0) {
        const result = await whatsappService.sendWeeklySchedule(agent, assignments);
        results.push({
          agentId: agent.id,
          agentName: `${agent.firstName} ${agent.lastName}`,
          ...result
        });
      }
    }

    res.json({
      success: true,
      data: {
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi des plannings',
      error: error.message
    });
  }
};

/**
 * Envoyer le rapport quotidien aux superviseurs
 */
exports.sendDailyReports = async (req, res) => {
  try {
    const { stats } = req.body;

    // Recuperer tous les superviseurs
    const supervisors = await User.findAll({
      where: {
        role: ['supervisor', 'admin'],
        status: 'active'
      }
    });

    const results = [];

    for (const supervisor of supervisors) {
      if (!supervisor.phone) continue;

      const result = await whatsappService.sendDailyReport(supervisor, stats);
      results.push({
        supervisorId: supervisor.id,
        supervisorName: `${supervisor.firstName} ${supervisor.lastName}`,
        ...result
      });
    }

    res.json({
      success: true,
      data: {
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi des rapports',
      error: error.message
    });
  }
};

/**
 * Envoyer une alerte SOS
 */
exports.sendSOSAlert = async (req, res) => {
  try {
    const { agentId, latitude, longitude } = req.body;

    const agent = await User.findByPk(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent non trouve'
      });
    }

    // Recuperer tous les superviseurs
    const supervisors = await User.findAll({
      where: {
        role: ['supervisor', 'admin'],
        status: 'active'
      }
    });

    const results = [];

    for (const supervisor of supervisors) {
      if (!supervisor.phone) continue;

      const result = await whatsappService.sendSOSAlert(
        supervisor,
        agent,
        { latitude, longitude }
      );
      results.push({
        supervisorId: supervisor.id,
        ...result
      });
    }

    res.json({
      success: true,
      message: 'Alertes SOS envoyees',
      data: {
        sent: results.filter(r => r.success).length,
        results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi des alertes SOS',
      error: error.message
    });
  }
};

/**
 * Broadcast un message a tous les agents
 */
exports.broadcastMessage = async (req, res) => {
  try {
    const { message, targetRole = 'all' } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message requis'
      });
    }

    const whereClause = {
      status: 'active'
    };

    if (targetRole !== 'all') {
      whereClause.role = targetRole;
    }

    const users = await User.findAll({
      where: whereClause
    });

    const results = [];

    for (const user of users) {
      if (!user.phone) continue;

      const result = await whatsappService.sendTextMessage(user.phone, message);
      results.push({
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        ...result
      });

      // Pause entre les messages pour eviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    res.json({
      success: true,
      data: {
        total: users.length,
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors du broadcast',
      error: error.message
    });
  }
};
