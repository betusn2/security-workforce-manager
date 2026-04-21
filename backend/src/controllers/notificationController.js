const { Notification, User } = require('../models');
const { Op } = require('sequelize');
const notificationService = require('../services/notificationService');
const axios = require('axios');

// ─── Expo Push Helper ────────────────────────────────────────────────────────
async function sendExpoPush(expoPushToken, { title, body, data = {} }) {
  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) return;
  try {
    await axios.post('https://exp.host/--/api/v2/push/send', {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'security-messages',
    }, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 5000,
    });
  } catch (err) {
    console.warn('⚠️ Expo push failed:', err?.message);
  }
}
exports.sendExpoPush = sendExpoPush;

// ─── Register mobile push token ──────────────────────────────────────────────
exports.registerPushToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'token requis' });
    // Use raw query — expoPushToken is not in the Sequelize model to avoid
    // breaking SELECT queries on servers where the column may not exist yet.
    await User.sequelize.query(
      'UPDATE users SET expoPushToken = ? WHERE id = ?',
      { replacements: [token, req.user.id] }
    );
    console.log(`📱 Push token enregistré pour ${req.user.id} (${platform || 'unknown'})`);
    res.json({ success: true, message: 'Token enregistré' });
  } catch (error) {
    // Column might not exist yet — not fatal
    console.warn('⚠️ registerPushToken (non fatal):', error.message);
    res.json({ success: true, message: 'Token enregistré (pending migration)' });
  }
};

// Get notifications for current user
exports.getMyNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      channel = 'in_app'
    } = req.query;

    const where = {
      userId: req.user.id,
      channel
    };

    if (type) where.type = type;
    if (status) where.status = status;

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      success: true,
      data: {
        notifications: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des notifications'
    });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);

    res.json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors du comptage des notifications'
    });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id,
      req.user.id
    );

    res.json({
      success: true,
      message: 'Notification marquée comme lue',
      data: notification
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message || 'Notification non trouvée'
    });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.update(
      { status: 'read', readAt: new Date() },
      {
        where: {
          userId: req.user.id,
          channel: 'in_app',
          status: { [Op.notIn]: ['read'] }
        }
      }
    );

    res.json({
      success: true,
      message: 'Toutes les notifications marquées comme lues'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des notifications'
    });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification non trouvée'
      });
    }

    await notification.destroy();

    res.json({
      success: true,
      message: 'Notification supprimée'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la notification'
    });
  }
};

// Send notification (admin only)
exports.sendNotification = async (req, res) => {
  try {
    const { userId, userIds, recipientId, type, title, message, channels, priority, data: extraData } = req.body;

    // Accept recipientId as alias for userId
    const targetUserIds = userIds || (userId ? [userId] : recipientId ? [recipientId] : []);

    if (targetUserIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Au moins un utilisateur doit être spécifié'
      });
    }

    // Get Socket.IO instance for real-time delivery
    const socketIOService = req.app.get('socketIOService');

    const results = [];

    for (const targetUserId of targetUserIds) {
      try {
        // Save to DB via notification service
        const notifications = await notificationService.notify(targetUserId, {
          type:     type || 'general',
          title,
          message,
          channels: channels || ['in_app'],
          priority: priority || 'normal'
        });

        // Real-time: emit via Socket.IO to user's room
        if (socketIOService) {
          socketIOService.io.to(`user:${targetUserId}`).emit('admin:message', {
            title:      title || '📢 Message Admin',
            message,
            priority:   priority || 'normal',
            senderName: req.user?.name || 'Admin',
            timestamp:  Date.now(),
            ...(extraData || {}),
          });
        }

        // Push notification (works when app is in background)
        try {
          const [[tokenRow]] = await User.sequelize.query(
            'SELECT expoPushToken FROM users WHERE id = ?',
            { replacements: [targetUserId] }
          );
          if (tokenRow?.expoPushToken) {
            await sendExpoPush(tokenRow.expoPushToken, {
              title: title || '📢 Message Admin',
              body:  message,
              data:  { popup: true, priority: priority || 'normal', type: type || 'message', ...(extraData || {}) },
            });
          }
        } catch (_) { /* push token column may not exist yet */ }

        results.push({ userId: targetUserId, success: true, notificationCount: notifications.length });
      } catch (err) {
        results.push({ userId: targetUserId, success: false, error: err.message });
      }
    }

    res.json({
      success: true,
      message: 'Notifications envoyées',
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi des notifications'
    });
  }
};

// Broadcast notification to all users or by role
exports.broadcastNotification = async (req, res) => {
  try {
    const { type, title, message, channels, priority, role } = req.body;

    const userWhere = { status: 'active' };
    if (role) userWhere.role = role;

    const users = await User.findAll({
      where: userWhere,
      attributes: ['id']
    });

    const socketIOService = req.app.get('socketIOService');
    const results = { sent: 0, failed: 0 };

    for (const user of users) {
      try {
        await notificationService.notify(user.id, {
          type:     type || 'system',
          title,
          message,
          channels: channels || ['in_app'],
          priority: priority || 'normal'
        });

        // Real-time Socket.IO
        if (socketIOService) {
          socketIOService.io.to(`user:${user.id}`).emit('admin:message', {
            title:      title || '📢 Diffusion Admin',
            message,
            priority:   priority || 'normal',
            senderName: req.user?.name || 'Admin',
            targetType: 'broadcast',
            timestamp:  Date.now(),
          });
        }

        // Expo push for background delivery
        try {
          const [[tokenRow]] = await User.sequelize.query(
            'SELECT expoPushToken FROM users WHERE id = ?',
            { replacements: [user.id] }
          );
          if (tokenRow?.expoPushToken) {
            await sendExpoPush(tokenRow.expoPushToken, {
              title: title || '📢 Diffusion Admin',
              body:  message,
              data:  { popup: true, priority: priority || 'normal', type: type || 'broadcast' },
            });
          }
        } catch (_) { /* non-fatal */ }

        results.sent++;
      } catch (err) {
        results.failed++;
      }
    }

    res.json({
      success: true,
      message: `Notification diffusée: ${results.sent} envoyée(s), ${results.failed} échouée(s)`,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la diffusion des notifications'
    });
  }
};

// Get all notifications (admin only)
exports.getAllNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      userId,
      type,
      status,
      channel,
      startDate,
      endDate
    } = req.query;

    const where = {};
    if (userId) where.userId = userId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [startDate, endDate] };
    }

    const { count, rows } = await Notification.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      success: true,
      data: {
        notifications: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des notifications'
    });
  }
};

// Get notification statistics
exports.getNotificationStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [startDate, endDate] };
    }

    const notifications = await Notification.findAll({ where });

    const stats = {
      total: notifications.length,
      byStatus: {
        pending: notifications.filter(n => n.status === 'pending').length,
        sent: notifications.filter(n => n.status === 'sent').length,
        delivered: notifications.filter(n => n.status === 'delivered').length,
        failed: notifications.filter(n => n.status === 'failed').length,
        read: notifications.filter(n => n.status === 'read').length
      },
      byChannel: {
        email: notifications.filter(n => n.channel === 'email').length,
        sms: notifications.filter(n => n.channel === 'sms').length,
        whatsapp: notifications.filter(n => n.channel === 'whatsapp').length,
        push: notifications.filter(n => n.channel === 'push').length,
        in_app: notifications.filter(n => n.channel === 'in_app').length
      },
      byType: {}
    };

    // Count by type
    notifications.forEach(n => {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
    });

    // Calculate success rate
    const sentNotifications = notifications.filter(n =>
      ['sent', 'delivered', 'read'].includes(n.status)
    ).length;
    stats.successRate = stats.total > 0
      ? Math.round((sentNotifications / stats.total) * 100)
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

// Send popup to all users of given roles (admin/supervisor → agents/supervisors)
exports.sendPopupToRoles = async (req, res) => {
  try {
    const { title, message, priority, roles = ['agent', 'supervisor'] } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'message requis' });
    }

    const socketIOService = req.app.get('socketIOService');

    // Socket.IO broadcast to connected users by role
    if (socketIOService) {
      const payload = {
        title:      title || '📢 Message diffusé',
        message,
        priority:   priority || 'normal',
        senderName: req.user?.name || req.user?.firstName || 'Admin',
        targetType: 'broadcast',
        timestamp:  Date.now(),
      };
      for (const role of roles) {
        socketIOService.io.to(`role:${role}`).emit('admin:message', payload);
      }
    }

    // Expo push for users that are offline
    const users = await User.findAll({
      where: { role: roles, status: 'active' },
      attributes: ['id'],
    });

    let pushSent = 0;
    for (const user of users) {
      try {
        const [[tokenRow]] = await User.sequelize.query(
          'SELECT expoPushToken FROM users WHERE id = ?',
          { replacements: [user.id] }
        );
        if (tokenRow?.expoPushToken) {
          await sendExpoPush(tokenRow.expoPushToken, {
            title: title || '📢 Message diffusé',
            body:  message,
            data:  { popup: true, priority: priority || 'normal', type: 'broadcast' },
          });
          pushSent++;
        }
      } catch (_) { /* non-fatal */ }
    }

    res.json({
      success: true,
      message: `Popup envoyé à ${users.length} utilisateurs (${pushSent} push)`,
    });
  } catch (error) {
    console.error('sendPopupToRoles error:', error);
    res.status(500).json({ success: false, message: 'Erreur envoi popup' });
  }
};