/**
 * Analytics Controller
 * Endpoints pour l'analytique et les predictions IA
 */

const analyticsService = require('../services/analyticsService');
const { User, Attendance, Incident } = require('../models');
const { Op } = require('sequelize');

/**
 * Obtenir le tableau de bord analytique
 */
exports.getDashboard = async (req, res) => {
  try {
    const dashboard = await analyticsService.generateDashboard();
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la generation du tableau de bord',
      error: error.message
    });
  }
};

/**
 * Analyser les patterns d'un agent
 */
exports.getAgentPatterns = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { days = 90 } = req.query;

    const patterns = await analyticsService.analyzeAgentPatterns(
      parseInt(agentId),
      parseInt(days)
    );

    res.json({
      success: true,
      data: patterns
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'analyse des patterns',
      error: error.message
    });
  }
};

/**
 * Predire le risque d'absence d'un agent
 */
exports.predictAbsenceRisk = async (req, res) => {
  try {
    const { agentId } = req.params;

    const prediction = await analyticsService.predictAbsenceRisk(parseInt(agentId));

    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la prediction',
      error: error.message
    });
  }
};

/**
 * Analyser tous les agents a risque
 */
exports.getAgentsAtRisk = async (req, res) => {
  try {
    const agents = await User.findAll({
      where: { role: 'agent', status: 'active' }
    });

    const results = [];

    for (const agent of agents) {
      const prediction = await analyticsService.predictAbsenceRisk(agent.id);
      if (prediction.riskLevel !== 'low') {
        results.push({
          id: agent.id,
          firstName: agent.firstName,
          lastName: agent.lastName,
          email: agent.email,
          ...prediction
        });
      }
    }

    // Trier par score de risque
    results.sort((a, b) => b.riskScore - a.riskScore);

    res.json({
      success: true,
      data: {
        total: results.length,
        highRisk: results.filter(r => r.riskLevel === 'high').length,
        mediumRisk: results.filter(r => r.riskLevel === 'medium').length,
        agents: results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'analyse des risques',
      error: error.message
    });
  }
};

/**
 * Analyser les zones d'incidents
 */
exports.getIncidentHotspots = async (req, res) => {
  try {
    const { days = 90 } = req.query;

    const analysis = await analyticsService.analyzeIncidentHotspots(parseInt(days));

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'analyse des incidents',
      error: error.message
    });
  }
};

/**
 * Predire les besoins en personnel pour un evenement
 */
exports.predictStaffingNeeds = async (req, res) => {
  try {
    const { eventId } = req.params;

    const prediction = await analyticsService.predictStaffingNeeds(parseInt(eventId));

    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la prediction',
      error: error.message
    });
  }
};

/**
 * Obtenir les tendances de presence
 */
exports.getAttendanceTrends = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Recuperer les donnees groupees par jour
    const attendances = await Attendance.findAll({
      where: {
        date: { [Op.gte]: startDate.toISOString().split('T')[0] }
      },
      attributes: [
        'date',
        'status'
      ],
      raw: true
    });

    // Grouper par date
    const byDate = {};
    attendances.forEach(a => {
      const date = a.date;
      if (!byDate[date]) {
        byDate[date] = { date, present: 0, late: 0, absent: 0, total: 0 };
      }
      byDate[date][a.status]++;
      byDate[date].total++;
    });

    const trends = Object.values(byDate).sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recuperation des tendances',
      error: error.message
    });
  }
};

/**
 * Comparer les performances des agents
 */
exports.compareAgents = async (req, res) => {
  try {
    const { agentIds } = req.body;

    if (!agentIds || !Array.isArray(agentIds)) {
      return res.status(400).json({
        success: false,
        message: 'Liste d\'IDs d\'agents requise'
      });
    }

    const comparisons = [];

    for (const agentId of agentIds) {
      const agent = await User.findByPk(agentId);
      if (agent) {
        const patterns = await analyticsService.analyzeAgentPatterns(agentId, 60);
        comparisons.push({
          id: agent.id,
          name: `${agent.firstName} ${agent.lastName}`,
          overallScore: agent.overallScore,
          patterns
        });
      }
    }

    res.json({
      success: true,
      data: comparisons
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la comparaison',
      error: error.message
    });
  }
};

/**
 * Generer un rapport de performance
 */
exports.generatePerformanceReport = async (req, res) => {
  try {
    const { startDate, endDate, type = 'summary' } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    // Statistiques globales
    const [totalAttendances, totalIncidents, agents] = await Promise.all([
      Attendance.count({
        where: {
          date: { [Op.between]: [start.toISOString().split('T')[0], end.toISOString().split('T')[0]] }
        }
      }),
      Incident.count({
        where: {
          createdAt: { [Op.between]: [start, end] }
        }
      }),
      User.findAll({
        where: { role: 'agent', status: 'active' }
      })
    ]);

    // Calculer les statistiques par agent si type = 'detailed'
    let agentStats = [];
    if (type === 'detailed') {
      for (const agent of agents) {
        const attendances = await Attendance.findAll({
          where: {
            agentId: agent.id,
            date: { [Op.between]: [start.toISOString().split('T')[0], end.toISOString().split('T')[0]] }
          }
        });

        agentStats.push({
          id: agent.id,
          name: `${agent.firstName} ${agent.lastName}`,
          totalDays: attendances.length,
          presentDays: attendances.filter(a => a.status === 'present').length,
          lateDays: attendances.filter(a => a.status === 'late').length,
          absentDays: attendances.filter(a => a.status === 'absent').length,
          totalHours: attendances.reduce((sum, a) => sum + (parseFloat(a.totalHours) || 0), 0).toFixed(1),
          score: agent.overallScore
        });
      }

      // Trier par score
      agentStats.sort((a, b) => b.score - a.score);
    }

    res.json({
      success: true,
      data: {
        period: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        },
        summary: {
          totalAgents: agents.length,
          totalAttendances,
          totalIncidents,
          avgAttendancePerAgent: agents.length > 0
            ? (totalAttendances / agents.length).toFixed(1)
            : 0
        },
        agentStats: type === 'detailed' ? agentStats : undefined,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la generation du rapport',
      error: error.message
    });
  }
};
