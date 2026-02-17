const { ActivityLog, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Récupérer tous les logs avec filtres et pagination
 */
exports.getAllLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      entityType,
      status,
      userId,
      startDate,
      endDate,
      search
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Filtres
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (status) where.status = status;
    if (userId) where.userId = userId;

    // Filtre par date
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    // Recherche
    if (search) {
      where[Op.or] = [
        { action: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { ipAddress: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await ActivityLog.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'cin', 'role']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        logs: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des logs'
    });
  }
};

/**
 * Récupérer les statistiques des logs
 */
exports.getLogStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};

    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt[Op.gte] = new Date(startDate);
      if (endDate) dateFilter.createdAt[Op.lte] = new Date(endDate);
    }

    // Total logs
    const totalLogs = await ActivityLog.count({ where: dateFilter });

    // Par statut
    const statusStats = await ActivityLog.findAll({
      where: dateFilter,
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    // Par action
    const actionStats = await ActivityLog.findAll({
      where: dateFilter,
      attributes: [
        'action',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['action'],
      order: [[require('sequelize').fn('COUNT', require('sequelize').col('id')), 'DESC']],
      limit: 10,
      raw: true
    });

    // Par type d'entité
    const entityStats = await ActivityLog.findAll({
      where: dateFilter,
      attributes: [
        'entityType',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['entityType'],
      raw: true
    });

    // Utilisateurs les plus actifs - Requête séparée
    const topUsersRaw = await ActivityLog.findAll({
      where: dateFilter,
      attributes: [
        'userId',
        [require('sequelize').fn('COUNT', require('sequelize').col('ActivityLog.id')), 'count']
      ],
      group: ['userId'],
      order: [[require('sequelize').fn('COUNT', require('sequelize').col('ActivityLog.id')), 'DESC']],
      limit: 10,
      raw: true
    });

    // Enrichir avec les infos utilisateur
    const topUsers = await Promise.all(
      topUsersRaw.map(async (item) => {
        if (item.userId) {
          const user = await User.findByPk(item.userId, {
            attributes: ['firstName', 'lastName', 'email', 'role']
          });
          return {
            userId: item.userId,
            count: item.count,
            user: user ? user.toJSON() : null
          };
        }
        return {
          userId: null,
          count: item.count,
          user: null
        };
      })
    );

    // Logs par jour (derniers 7 jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyLogs = await ActivityLog.findAll({
      where: {
        ...dateFilter,
        createdAt: { [Op.gte]: sevenDaysAgo }
      },
      attributes: [
        [require('sequelize').fn('DATE', require('sequelize').col('created_at')), 'date'],
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: [require('sequelize').fn('DATE', require('sequelize').col('created_at'))],
      order: [[require('sequelize').fn('DATE', require('sequelize').col('created_at')), 'ASC']],
      raw: true
    });

    res.json({
      success: true,
      data: {
        total: totalLogs,
        byStatus: statusStats,
        byAction: actionStats,
        byEntity: entityStats,
        topUsers,
        dailyActivity: dailyLogs
      }
    });
  } catch (error) {
    console.error('Get log stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};

/**
 * Purger les anciens logs
 */
exports.purgeLogs = async (req, res) => {
  try {
    const { beforeDate, action, entityType, status } = req.body;

    if (!beforeDate) {
      return res.status(400).json({
        success: false,
        message: 'La date de purge est requise'
      });
    }

    const where = {
      createdAt: { [Op.lt]: new Date(beforeDate) }
    };

    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (status) where.status = status;

    const count = await ActivityLog.count({ where });

    if (count === 0) {
      return res.json({
        success: true,
        message: 'Aucun log à purger',
        data: { deleted: 0 }
      });
    }

    await ActivityLog.destroy({ where });

    res.json({
      success: true,
      message: `${count} log(s) supprimé(s) avec succès`,
      data: { deleted: count }
    });
  } catch (error) {
    console.error('Purge logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la purge des logs'
    });
  }
};

/**
 * Supprimer des logs spécifiques
 */
exports.deleteLogs = async (req, res) => {
  try {
    const { logIds } = req.body;

    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir au moins un ID de log'
      });
    }

    const count = await ActivityLog.destroy({
      where: { id: logIds }
    });

    res.json({
      success: true,
      message: `${count} log(s) supprimé(s)`,
      data: { deleted: count }
    });
  } catch (error) {
    console.error('Delete logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression des logs'
    });
  }
};

/**
 * Obtenir les types d'actions disponibles
 */
exports.getActionTypes = async (req, res) => {
  try {
    const actions = await ActivityLog.findAll({
      attributes: [
        [require('sequelize').fn('DISTINCT', require('sequelize').col('action')), 'action']
      ],
      raw: true
    });

    const entities = await ActivityLog.findAll({
      attributes: [
        [require('sequelize').fn('DISTINCT', require('sequelize').col('entity_type')), 'entityType']
      ],
      raw: true
    });

    res.json({
      success: true,
      data: {
        actions: actions.map(a => a.action).filter(Boolean),
        entityTypes: entities.map(e => e.entityType).filter(Boolean)
      }
    });
  } catch (error) {
    console.error('Get action types error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des types'
    });
  }
};

/**
 * Export des logs en CSV
 */
exports.exportLogs = async (req, res) => {
  try {
    const {
      action,
      entityType,
      status,
      userId,
      startDate,
      endDate
    } = req.query;

    const where = {};

    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (status) where.status = status;
    if (userId) where.userId = userId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const logs = await ActivityLog.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName', 'email', 'role']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 10000 // Limite pour éviter les exports trop volumineux
    });

    // Générer CSV
    const csvRows = [
      'Date,Utilisateur,Action,Type,Entité,Statut,IP,Description'
    ];

    logs.forEach(log => {
      const userName = log.user 
        ? `${log.user.firstName} ${log.user.lastName}` 
        : 'Système';
      
      csvRows.push([
        new Date(log.createdAt).toLocaleString('fr-FR'),
        userName,
        log.action,
        log.entityType,
        log.entityId || '',
        log.status,
        log.ipAddress || '',
        (log.description || '').replace(/"/g, '""')
      ].map(v => `"${v}"`).join(','));
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
    res.send('\uFEFF' + csv); // BOM pour UTF-8
  } catch (error) {
    console.error('Export logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export des logs'
    });
  }
};

module.exports = exports;
