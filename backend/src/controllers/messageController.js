/**
 * Controleur de Messagerie
 * Chat temps reel entre agents et responsables
 */

const { Message, Conversation, User, Event } = require('../models');
const { Op } = require('sequelize');
const { logActivity } = require('../middlewares/activityLogger');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { sendExpoPush } = require('./notificationController');

/**
 * Obtenir les conversations de l'utilisateur
 */
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId, includeArchived } = req.query;

    const conversations = await Conversation.getForUser(userId, {
      includeArchived: includeArchived === 'true',
      eventId
    });

    // Enrichir avec les infos des participants
    const enriched = await Promise.all(conversations.map(async (conv) => {
      let otherParticipant = null;
      let unreadCount = 0;

      if (conv.type === 'direct') {
        const otherUserId = conv.participants?.find(id => id !== userId);
        if (otherUserId) {
          otherParticipant = await User.findByPk(otherUserId, {
            attributes: ['id', 'firstName', 'lastName', 'profilePhoto', 'status']
          });
        }
      }

      // Compter les messages non lus
      unreadCount = await Message.count({
        where: {
          conversationId: conv.id,
          senderId: { [Op.ne]: userId },
          readAt: null
        }
      });

      // Dernier message
      let lastMessage = null;
      if (conv.lastMessageId) {
        lastMessage = await Message.findByPk(conv.lastMessageId, {
          attributes: ['id', 'content', 'messageType', 'senderId', 'createdAt'],
          include: [{
            model: User,
            as: 'sender',
            attributes: ['firstName', 'lastName']
          }]
        });
      }

      return {
        ...conv.toJSON(),
        otherParticipant,
        unreadCount,
        lastMessage
      };
    }));

    res.json({
      success: true,
      data: enriched
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recuperation des conversations'
    });
  }
};

/**
 * Obtenir ou creer une conversation directe
 */
exports.getOrCreateDirectConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const userId = req.user.id;

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'recipientId requis'
      });
    }

    // Verifier que le destinataire existe
    const recipient = await User.findByPk(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Destinataire non trouve'
      });
    }

    const { conversation, created } = await Conversation.findOrCreateDirect(userId, recipientId);

    res.json({
      success: true,
      data: {
        conversation,
        created,
        recipient: {
          id: recipient.id,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          profilePhoto: recipient.profilePhoto
        }
      }
    });

  } catch (error) {
    console.error('Get/create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la creation de la conversation'
    });
  }
};

/**
 * Obtenir les messages d'une conversation
 */
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;
    const userId = req.user.id;

    // Verifier l'acces a la conversation
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvee'
      });
    }

    // Verifier que l'utilisateur fait partie de la conversation
    const isParticipant = conversation.createdBy === userId ||
      conversation.participants?.includes(userId);

    // Admin peut voir toutes les conversations
    if (!isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acces non autorise a cette conversation'
      });
    }

    const where = { conversationId };
    if (before) {
      where.createdAt = { [Op.lt]: new Date(before) };
    }

    const messages = await Message.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'firstName', 'lastName', 'profilePhoto']
      }]
    });

    // Marquer comme lus les messages recus
    await Message.update(
      { readAt: new Date() },
      {
        where: {
          conversationId,
          senderId: { [Op.ne]: userId },
          readAt: null
        }
      }
    );

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Ordre chronologique
        hasMore: messages.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recuperation des messages'
    });
  }
};

/**
 * Envoyer un message
 */
exports.sendMessage = async (req, res) => {
  try {
    const {
      conversationId,
      content,
      messageType = 'text',
      latitude,
      longitude,
      isUrgent,
      replyToId
    } = req.body;

    const userId = req.user.id;

    // Verifier la conversation
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvee'
      });
    }

    // Verifier l'acces
    const isParticipant = conversation.createdBy === userId ||
      conversation.participants?.includes(userId);

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Acces non autorise'
      });
    }

    // Determiner le destinataire (pour conversations directes)
    let recipientId = null;
    if (conversation.type === 'direct') {
      recipientId = conversation.participants?.find(id => id !== userId);
    }

    // Creer le message
    const message = await Message.create({
      conversationId,
      senderId: userId,
      recipientId,
      eventId: conversation.eventId,
      messageType,
      content,
      latitude,
      longitude,
      isUrgent: isUrgent || false,
      replyToId,
      deliveredAt: new Date()
    });

    // Charger les infos du sender
    const fullMessage = await Message.findByPk(message.id, {
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'firstName', 'lastName', 'profilePhoto']
      }]
    });

    // Mettre a jour la conversation
    await conversation.update({
      lastMessageId: message.id,
      lastMessageAt: new Date()
    });

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    if (io) {
      // Notifier les participants
      const participants = conversation.participants || [];
      participants.forEach(participantId => {
        if (participantId !== userId) {
          io.to(`user:${participantId}`).emit('message:new', {
            conversationId,
            message: fullMessage.toJSON()
          });
        }
      });

      // Si broadcast evenement
      if (conversation.type === 'event_broadcast' && conversation.eventId) {
        io.to(`event-${conversation.eventId}`).emit('message:broadcast', {
          conversationId,
          message: fullMessage.toJSON()
        });
      }

      // Notifier admin si message urgent
      if (isUrgent) {
        io.to('role:admin').emit('message:urgent', {
          conversationId,
          message: fullMessage.toJSON(),
          sender: `${req.user.firstName} ${req.user.lastName}`
        });
      }
    }

    // Log
    await logActivity({
      userId,
      action: 'SEND_MESSAGE',
      entityType: 'message',
      entityId: message.id,
      description: `Message envoye dans conversation ${conversationId}`,
      req
    });

    // Send Expo push notification to recipient (handles background/screen-off)
    if (recipientId) {
      const recipient = await User.findByPk(recipientId, { attributes: ['expoPushToken', 'firstName', 'lastName'] });
      if (recipient?.expoPushToken) {
        const senderName = `${req.user.firstName} ${req.user.lastName}`;
        await sendExpoPush(recipient.expoPushToken, {
          title: isUrgent ? `🚨 Message urgent de ${senderName}` : `💬 ${senderName}`,
          body: messageType === 'text' ? (content?.substring(0, 120) || 'Nouveau message') : '📎 Fichier reçu',
          data: { conversationId, messageId: message.id, type: 'chat_message' },
        });
      }
    }

    res.status(201).json({
      success: true,
      data: fullMessage
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du message'
    });
  }
};

/**
 * Envoyer un message avec fichier
 */
exports.sendMessageWithFile = async (req, res) => {
  try {
    const {
      conversationId,
      content,
      fileContent, // Base64
      fileName,
      fileMimeType
    } = req.body;

    const userId = req.user.id;

    // Verifier la conversation
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvee'
      });
    }

    // Determiner le type de message
    let messageType = 'file';
    if (fileMimeType?.startsWith('image/')) {
      messageType = 'image';
    } else if (fileMimeType?.startsWith('audio/')) {
      messageType = 'voice';
    }

    // Sauvegarder le fichier
    let fileUrl = null;
    let fileSize = 0;

    if (fileContent) {
      const uploadsDir = path.join(__dirname, '../../uploads/messages');
      await fs.mkdir(uploadsDir, { recursive: true });

      const ext = path.extname(fileName) || '.bin';
      const storedName = `${uuidv4()}${ext}`;
      const filePath = path.join(uploadsDir, storedName);

      const base64Data = fileContent.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(filePath, buffer);

      fileUrl = `/uploads/messages/${storedName}`;
      fileSize = buffer.length;
    }

    // Determiner le destinataire
    let recipientId = null;
    if (conversation.type === 'direct') {
      recipientId = conversation.participants?.find(id => id !== userId);
    }

    // Creer le message
    const message = await Message.create({
      conversationId,
      senderId: userId,
      recipientId,
      eventId: conversation.eventId,
      messageType,
      content,
      fileUrl,
      fileName,
      fileSize,
      fileMimeType,
      deliveredAt: new Date()
    });

    // Charger les infos completes
    const fullMessage = await Message.findByPk(message.id, {
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'firstName', 'lastName', 'profilePhoto']
      }]
    });

    // Mettre a jour la conversation
    await conversation.update({
      lastMessageId: message.id,
      lastMessageAt: new Date()
    });

    // Broadcast
    const io = req.app.get('io');
    if (io) {
      const participants = conversation.participants || [];
      participants.forEach(participantId => {
        if (participantId !== userId) {
          io.to(`user:${participantId}`).emit('message:new', {
            conversationId,
            message: fullMessage.toJSON()
          });
        }
      });
    }

    res.status(201).json({
      success: true,
      data: fullMessage
    });

  } catch (error) {
    console.error('Send message with file error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du message'
    });
  }
};

/**
 * Broadcast message a tous les agents d'un evenement
 */
exports.broadcastToEvent = async (req, res) => {
  try {
    const { eventId, content, messageType = 'text', isUrgent } = req.body;
    const userId = req.user.id;

    // Verifier les permissions (admin ou supervisor)
    if (!['admin', 'supervisor'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Permission refusee'
      });
    }

    // Verifier l'evenement
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Evenement non trouve'
      });
    }

    // Trouver ou creer la conversation broadcast de l'evenement
    let conversation = await Conversation.findOne({
      where: {
        eventId,
        type: 'event_broadcast'
      }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        eventId,
        type: 'event_broadcast',
        name: `Broadcast - ${event.name}`,
        createdBy: userId,
        participants: []
      });
    }

    // Creer le message
    const message = await Message.create({
      conversationId: conversation.id,
      senderId: userId,
      eventId,
      messageType,
      content,
      isBroadcast: true,
      isUrgent: isUrgent || false,
      deliveredAt: new Date()
    });

    // Charger les infos
    const fullMessage = await Message.findByPk(message.id, {
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'firstName', 'lastName', 'profilePhoto', 'role']
      }]
    });

    // Mettre a jour la conversation
    await conversation.update({
      lastMessageId: message.id,
      lastMessageAt: new Date()
    });

    // Broadcast a tous les agents de l'evenement
    const io = req.app.get('io');
    if (io) {
      io.to(`event-${eventId}`).emit('message:broadcast', {
        eventId,
        eventName: event.name,
        message: fullMessage.toJSON(),
        isUrgent
      });

      // Notification push aux admins si urgent
      if (isUrgent) {
        io.to('role:admin').emit('broadcast:urgent', {
          eventId,
          eventName: event.name,
          sender: `${req.user.firstName} ${req.user.lastName}`,
          content: content?.substring(0, 100)
        });
      }
    }

    // Log
    await logActivity({
      userId,
      action: 'BROADCAST_MESSAGE',
      entityType: 'event',
      entityId: eventId,
      description: `Broadcast envoye a l'evenement ${event.name}`,
      req
    });

    res.status(201).json({
      success: true,
      message: 'Broadcast envoye',
      data: fullMessage
    });

  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du broadcast'
    });
  }
};

/**
 * Marquer un message comme lu
 */
exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouve'
      });
    }

    if (message.senderId !== req.user.id) {
      await message.update({ readAt: new Date() });
    }

    // Notifier l'expediteur
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${message.senderId}`).emit('message:read', {
        messageId,
        readAt: new Date()
      });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur'
    });
  }
};

/**
 * Obtenir tous les messages (admin audit)
 */
exports.getAllMessages = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acces reserve aux administrateurs'
      });
    }

    const { userId, eventId, startDate, endDate, page = 1, limit = 50 } = req.query;

    const where = {};
    if (userId) where.senderId = userId;
    if (eventId) where.eventId = eventId;
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const { count, rows } = await Message.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName', 'role']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'firstName', 'lastName', 'role']
        },
        {
          model: Conversation,
          as: 'conversation',
          attributes: ['id', 'type', 'name']
        }
      ]
    });

    res.json({
      success: true,
      data: {
        messages: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get all messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur'
    });
  }
};
