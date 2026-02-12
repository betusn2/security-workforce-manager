const { User, Attendance, Assignment, UserDocument } = require('../models');
const { Op } = require('sequelize');
const { logActivity } = require('../middlewares/activityLogger');
const { prepareDocumentsForCreation, saveDocumentsAfterUserCreation } = require('./documentController');
const websocketService = require('../services/websocketService');
const { broadcastUser } = require('../utils/socketBroadcast');

// Get all users with pagination and filters
exports.getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const where = {};

    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { employeeId: { [Op.like]: `%${search}%` } }
      ];
    }

    console.log('🔍 [DEBUG] Starting getUsers query with supervisor + creator includes...');
    
    // VERSION PROGRESSIVE - Test avec supervisor + creator includes
    const users = await User.findAll({
      where,
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      attributes: { exclude: ['password', 'refreshToken', 'facialVector'] },
      include: [
        {
          model: User,
          as: 'supervisor',
          attributes: ['id', 'firstName', 'lastName', 'employeeId', 'profilePhoto', 'role'],
          required: false
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName', 'employeeId', 'role'],
          required: false
        }
      ]
    });

    console.log(`✅ [DEBUG] Query successful with supervisor + creator, found ${users.length} users`);

    const count = await User.count({ where });

    res.json({
      success: true,
      data: {
        users: users,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('❌ [DEBUG] Get users error:', error.message);
    console.error('   Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs',
      debug: {
        error: error.message,
        name: error.name,
        step: 'supervisor_creator_include'
      }
    });
  }
};

// Get single user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'refreshToken', 'facialVector'] },
      include: [
        {
          model: Assignment,
          as: 'assignments',
          limit: 10,
          order: [['createdAt', 'DESC']]
        },
        {
          model: User,
          as: 'supervisor',
          attributes: ['id', 'firstName', 'lastName', 'employeeId', 'cin', 'profilePhoto', 'phone', 'email']
        },
        {
          model: User,
          as: 'supervisedAgents',
          attributes: ['id', 'firstName', 'lastName', 'employeeId', 'profilePhoto', 'status']
        },
        {
          model: UserDocument,
          as: 'documents',
          attributes: { exclude: ['fileContent'] }, // Exclure le contenu base64 pour performance
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'utilisateur'
    });
  }
};

// Générer automatiquement l'ID employé selon le rôle
const generateEmployeeId = async (role) => {
  const prefixes = {
    agent: 'AGT',
    supervisor: 'RES',
    admin: 'ADM',
    user: 'UTI'
  };

  const prefix = prefixes[role] || 'UTI';

  // Trouver le dernier ID avec ce préfixe
  const lastUser = await User.findOne({
    where: {
      employeeId: { [Op.like]: `${prefix}%` }
    },
    order: [['employeeId', 'DESC']],
    paranoid: false // Inclure les utilisateurs supprimés pour éviter les doublons
  });

  let nextNumber = 1;
  if (lastUser && lastUser.employeeId) {
    // Extraire le numéro du dernier ID (ex: AGT00015 -> 15)
    const match = lastUser.employeeId.match(/\d+$/);
    if (match) {
      nextNumber = parseInt(match[0], 10) + 1;
    }
  }

  // Formater avec des zéros (ex: AGT00001)
  return `${prefix}${String(nextNumber).padStart(5, '0')}`;
};

// Create new user (admin only)
exports.createUser = async (req, res) => {
  try {
    const {
      firstName, lastName, email, password, phone,
      whatsappNumber, role, address, dateOfBirth, hireDate,
      currentLatitude, currentLongitude, supervisorId, cin,
      facialVector, facialPhoto, profilePhoto,
      documents, // Nouveau: documents à uploader
      // Informations physiques
      height, weight,
      // Informations professionnelles
      diploma, diplomaLevel, securityCard, securityCardExpiry,
      experienceYears, specializations, languages,
      // Contact d'urgence
      emergencyContact, emergencyPhone,
      // Scores
      punctualityScore, reliabilityScore, professionalismScore
    } = req.body;

    // Validation: Un agent doit obligatoirement avoir un superviseur
    const userRole = role || 'agent';
    if (userRole === 'agent' && !supervisorId) {
      return res.status(400).json({
        success: false,
        message: 'Un agent de sécurité doit obligatoirement avoir un responsable assigné'
      });
    }

    // Pour les agents et superviseurs, le CIN est obligatoire
    if (['agent', 'supervisor'].includes(userRole) && !cin) {
      return res.status(400).json({
        success: false,
        message: 'Le numéro CIN est obligatoire pour les agents et responsables'
      });
    }

    // Vérifier que le superviseur existe et est bien un superviseur ou admin
    if (supervisorId) {
      const supervisor = await User.findByPk(supervisorId);
      if (!supervisor) {
        return res.status(400).json({
          success: false,
          message: 'Le responsable sélectionné n\'existe pas'
        });
      }
      if (!['supervisor', 'admin'].includes(supervisor.role)) {
        return res.status(400).json({
          success: false,
          message: 'Le responsable doit être un superviseur ou un administrateur'
        });
      }
    }

    // Check for existing user (email, CIN ou téléphone principal)
    const whereConditions = [{ email }];
    if (cin) {
      whereConditions.push({ cin: cin.toUpperCase().trim() });
    }
    if (phone) {
      whereConditions.push({ phone: phone.trim() });
    }

    const existing = await User.findOne({
      where: { [Op.or]: whereConditions }
    });

    if (existing) {
      if (existing.email === email) {
        return res.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé par un autre utilisateur'
        });
      }
      if (cin && existing.cin === cin.toUpperCase().trim()) {
        return res.status(400).json({
          success: false,
          message: 'Ce numéro CIN est déjà utilisé par un autre utilisateur'
        });
      }
      if (phone && existing.phone === phone.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Ce numéro de téléphone principal est déjà utilisé par un autre utilisateur'
        });
      }
    }

    // Générer automatiquement l'ID employé
    const employeeId = await generateEmployeeId(userRole);

    // Pour agents et superviseurs: mot de passe = CIN (si pas de mot de passe fourni)
    let userPassword = password;
    if (['agent', 'supervisor'].includes(userRole) && cin && !password) {
      userPassword = cin.toUpperCase().trim();
    }

    const user = await User.create({
      employeeId,
      firstName,
      lastName,
      email,
      password: userPassword,
      phone,
      whatsappNumber,
      role: userRole,
      address,
      dateOfBirth,
      hireDate,
      currentLatitude,
      currentLongitude,
      supervisorId,
      cin: cin ? cin.toUpperCase().trim() : null,
      profilePhoto: profilePhoto || facialPhoto || null,
      // Informations physiques
      height,
      weight,
      // Informations professionnelles
      diploma,
      diplomaLevel,
      securityCard,
      securityCardExpiry,
      experienceYears,
      specializations,
      languages,
      // Contact d'urgence
      emergencyContact,
      emergencyPhone,
      // Scores
      punctualityScore,
      reliabilityScore,
      professionalismScore
    });

    // Sauvegarder le vecteur facial si fourni (pour la reconnaissance faciale)
    if (facialVector && Array.isArray(facialVector)) {
      user.setEncryptedFacialVector(facialVector);
      await user.save();
    }

    // Gérer les documents si fournis (section optionnelle)
    let uploadedDocuments = [];
    let documentErrors = [];

    if (documents && Array.isArray(documents) && documents.length > 0) {
      // Préparer et valider les documents
      const { prepared, errors } = prepareDocumentsForCreation(documents, req.user.id);
      documentErrors = errors;

      // Sauvegarder les documents après création de l'utilisateur
      if (prepared.length > 0) {
        uploadedDocuments = await saveDocumentsAfterUserCreation(user.id, prepared, req.user.id);

        // Log de l'upload des documents
        if (uploadedDocuments.length > 0) {
          await logActivity({
            userId: req.user.id,
            action: 'UPLOAD_DOCUMENTS',
            entityType: 'user_document',
            entityId: user.id,
            description: `${uploadedDocuments.length} document(s) uploadé(s) pour ${user.firstName} ${user.lastName}`,
            newValues: { documentIds: uploadedDocuments.map(d => d.id) },
            req
          });
        }
      }
    }

    await logActivity({
      userId: req.user.id,
      action: 'CREATE_USER',
      entityType: 'user',
      entityId: user.id,
      description: `Utilisateur ${user.firstName} ${user.lastName} créé`,
      newValues: user.toJSON(),
      req
    });

    // 🔥 BROADCAST TEMPS RÉEL - Nouvel utilisateur
    broadcastUser.created(user.toJSON(), { broadcast: 'all' });

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: {
        ...user.toJSON(),
        documents: uploadedDocuments.map(d => d.toJSON()),
        documentErrors: documentErrors.length > 0 ? documentErrors : undefined
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'utilisateur',
      error: error.message
    });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const oldValues = user.toJSON();
    const allowedFields = [
      'firstName', 'lastName', 'phone', 'whatsappNumber',
      'role', 'status', 'address', 'dateOfBirth', 'hireDate', 'notificationPreferences',
      'currentLatitude', 'currentLongitude', 'supervisorId', 'cin', 'facialDescriptor',
      // Informations physiques
      'height', 'weight',
      // Informations professionnelles
      'diploma', 'diplomaLevel', 'securityCard', 'securityCardExpiry',
      'experienceYears', 'specializations', 'languages',
      // Contact d'urgence
      'emergencyContact', 'emergencyPhone',
      // Scores
      'punctualityScore', 'reliabilityScore', 'professionalismScore'
    ];

    // Validation: Si on change le rôle vers agent, vérifier qu'un superviseur est assigné
    if (req.body.role === 'agent' && !req.body.supervisorId && !user.supervisorId) {
      return res.status(400).json({
        success: false,
        message: 'Un agent de sécurité doit obligatoirement avoir un responsable assigné'
      });
    }

    // Vérifier que le superviseur existe et est valide
    if (req.body.supervisorId) {
      const supervisor = await User.findByPk(req.body.supervisorId);
      if (!supervisor) {
        return res.status(400).json({
          success: false,
          message: 'Le responsable sélectionné n\'existe pas'
        });
      }
      if (!['supervisor', 'admin'].includes(supervisor.role)) {
        return res.status(400).json({
          success: false,
          message: 'Le responsable doit être un superviseur ou un administrateur'
        });
      }
    }

    // Vérifier l'unicité du CIN (si modifié)
    if (req.body.cin && req.body.cin.toUpperCase().trim() !== user.cin) {
      const existingCin = await User.findOne({
        where: {
          cin: req.body.cin.toUpperCase().trim(),
          id: { [Op.ne]: user.id }
        }
      });
      if (existingCin) {
        return res.status(400).json({
          success: false,
          message: 'Ce numéro CIN est déjà utilisé par un autre utilisateur'
        });
      }
    }

    // Vérifier l'unicité du téléphone principal (si modifié)
    if (req.body.phone && req.body.phone.trim() !== user.phone) {
      const existingPhone = await User.findOne({
        where: {
          phone: req.body.phone.trim(),
          id: { [Op.ne]: user.id }
        }
      });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Ce numéro de téléphone principal est déjà utilisé par un autre utilisateur'
        });
      }
    }

    // Only admins can change role and status
    if (req.user.role !== 'admin') {
      const adminOnlyFields = ['role', 'status'];
      adminOnlyFields.forEach(field => delete req.body[field]);
    }

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        // Handle facialDescriptor - convert array to JSON string if needed
        if (field === 'facialDescriptor' && Array.isArray(req.body[field])) {
          user[field] = JSON.stringify(req.body[field]);
          console.log('✅ Descripteur facial mis à jour pour utilisateur:', user.id);
        } else {
          user[field] = req.body[field];
        }
      }
    });

    await user.save();

    await logActivity({
      userId: req.user.id,
      action: 'UPDATE_USER',
      entityType: 'user',
      entityId: user.id,
      description: `Utilisateur ${user.firstName} ${user.lastName} mis à jour`,
      oldValues,
      newValues: user.toJSON(),
      req
    });

    // 🔥 BROADCAST TEMPS RÉEL - Utilisateur modifié
    broadcastUser.updated(user.toJSON(), { broadcast: 'all' });

    res.json({
      success: true,
      message: 'Utilisateur mis à jour',
      data: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'utilisateur'
    });
  }
};

// Delete user (soft delete)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Prevent deleting yourself
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas supprimer votre propre compte'
      });
    }

    const userData = user.toJSON();
    
    await user.destroy(); // Soft delete due to paranoid: true

    await logActivity({
      userId: req.user.id,
      action: 'DELETE_USER',
      entityType: 'user',
      entityId: user.id,
      description: `Utilisateur ${user.firstName} ${user.lastName} supprimé`,
      oldValues: userData,
      req
    });

    // 🔥 BROADCAST TEMPS RÉEL - Utilisateur supprimé
    broadcastUser.deleted({ id: user.id, firstName: user.firstName, lastName: user.lastName }, { broadcast: 'all' });

    res.json({
      success: true,
      message: 'Utilisateur supprimé'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'utilisateur'
    });
  }
};

// Get all agents (for assignments)
exports.getAgents = async (req, res) => {
  try {
    const { available, eventId, date } = req.query;

    const where = {
      role: 'agent',
      status: 'active'
    };

    let agents = await User.findAll({
      where,
      attributes: [
        'id', 
        'employeeId', 
        'firstName', 
        'lastName', 
        'phone', 
        'profilePhoto',
        'currentLatitude',
        'currentLongitude',
        'lastLocationUpdate',
        'address',
        'rating',
        'overallScore'
      ],
      order: [['firstName', 'ASC']]
    });

    // Filter by availability if requested
    if (available === 'true' && eventId && date) {
      const assignedAgentIds = await Assignment.findAll({
        where: {
          eventId,
          status: { [Op.notIn]: ['cancelled', 'declined'] }
        },
        attributes: ['agentId']
      }).then(assignments => assignments.map(a => a.agentId));

      agents = agents.filter(agent => !assignedAgentIds.includes(agent.id));
    }

    res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des agents'
    });
  }
};

// Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.date = { [Op.between]: [startDate, endDate] };
    }

    const attendances = await Attendance.findAll({
      where: { agentId: userId, ...dateFilter }
    });

    const assignments = await Assignment.findAll({
      where: { agentId: userId }
    });

    const stats = {
      totalAssignments: assignments.length,
      confirmedAssignments: assignments.filter(a => a.status === 'confirmed').length,
      totalAttendances: attendances.length,
      presentCount: attendances.filter(a => a.status === 'present').length,
      lateCount: attendances.filter(a => a.status === 'late').length,
      absentCount: attendances.filter(a => a.status === 'absent').length,
      totalHours: attendances.reduce((sum, a) => sum + (parseFloat(a.totalHours) || 0), 0),
      averageHoursPerDay: 0,
      attendanceRate: 0
    };

    if (stats.totalAttendances > 0) {
      stats.averageHoursPerDay = Math.round((stats.totalHours / stats.totalAttendances) * 100) / 100;
      stats.attendanceRate = Math.round((stats.presentCount / stats.totalAttendances) * 100);
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

// Reset user password (admin only)
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    user.password = newPassword;
    await user.save();

    await logActivity({
      userId: req.user.id,
      action: 'RESET_PASSWORD',
      entityType: 'user',
      entityId: user.id,
      description: `Mot de passe réinitialisé pour ${user.firstName} ${user.lastName}`,
      req
    });

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation du mot de passe'
    });
  }
};

// Get user's facial vector for verification
exports.getFacialVector = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Decrypt and return the facial vector
    const facialVector = user.getDecryptedFacialVector();

    res.json({
      success: true,
      data: {
        facialVector,
        updatedAt: user.facialVectorUpdatedAt
      }
    });
  } catch (error) {
    console.error('Get facial vector error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du vecteur facial'
    });
  }
};

// Update user's facial vector
exports.updateFacialVector = async (req, res) => {
  try {
    const { facialVector, profilePhoto } = req.body;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    if (!facialVector || !Array.isArray(facialVector)) {
      return res.status(400).json({
        success: false,
        message: 'Vecteur facial invalide'
      });
    }

    // Encrypt and save the facial vector
    user.setEncryptedFacialVector(facialVector);

    // Update profile photo if provided
    if (profilePhoto) {
      user.profilePhoto = profilePhoto;
    }

    await user.save();

    await logActivity({
      userId: req.user.id,
      action: 'UPDATE_FACIAL_VECTOR',
      entityType: 'user',
      entityId: user.id,
      description: `Vecteur facial mis à jour pour ${user.firstName} ${user.lastName}`,
      req
    });

    res.json({
      success: true,
      message: 'Vecteur facial mis à jour',
      data: {
        updatedAt: user.facialVectorUpdatedAt
      }
    });
  } catch (error) {
    console.error('Update facial vector error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du vecteur facial'
    });
  }
};

// Get all supervisors (supervisors and admins who can manage agents)
exports.getSupervisors = async (req, res) => {
  try {
    const supervisors = await User.findAll({
      where: {
        role: { [Op.in]: ['supervisor', 'admin'] },
        status: 'active'
      },
      attributes: [
        'id', 
        'employeeId', 
        'firstName', 
        'lastName', 
        'cin', 
        'email', 
        'phone', 
        'profilePhoto', 
        'role',
        'currentLatitude',
        'currentLongitude',
        'lastLocationUpdate',
        'address',
        'rating',
        'overallScore'
      ],
      order: [['firstName', 'ASC']]
    });

    // Compter le nombre d'agents supervisés pour chaque superviseur
    const supervisorsWithCount = await Promise.all(
      supervisors.map(async (supervisor) => {
        const agentCount = await User.count({
          where: { supervisorId: supervisor.id }
        });
        return {
          ...supervisor.toJSON(),
          agentCount
        };
      })
    );

    res.json({
      success: true,
      data: supervisorsWithCount
    });
  } catch (error) {
    console.error('Get supervisors error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des responsables'
    });
  }
};

// Get agents supervised by a specific supervisor
exports.getSupervisedAgents = async (req, res) => {
  try {
    const supervisorId = req.params.id || req.user.id;

    const agents = await User.findAll({
      where: {
        supervisorId,
        role: 'agent'
      },
      attributes: { exclude: ['password', 'refreshToken', 'facialVector'] },
      order: [['firstName', 'ASC']]
    });

    res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    console.error('Get supervised agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des agents supervisés'
    });
  }
};

// ============================================
// Fonctions de vérification d'unicité en temps réel
// ============================================

// Vérifier l'unicité de l'email
exports.checkEmailUnique = async (req, res) => {
  try {
    const { email, excludeId } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email requis'
      });
    }

    const where = { email: email.toLowerCase().trim() };
    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    const existing = await User.findOne({ where });

    res.json({
      success: true,
      data: {
        isUnique: !existing,
        field: 'email'
      }
    });
  } catch (error) {
    console.error('Check email unique error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de l\'email'
    });
  }
};

// Vérifier l'unicité du CIN
exports.checkCinUnique = async (req, res) => {
  try {
    const { cin, excludeId } = req.query;

    if (!cin) {
      return res.status(400).json({
        success: false,
        message: 'CIN requis'
      });
    }

    const where = { cin: cin.toUpperCase().trim() };
    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    const existing = await User.findOne({ where });

    res.json({
      success: true,
      data: {
        isUnique: !existing,
        field: 'cin'
      }
    });
  } catch (error) {
    console.error('Check CIN unique error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du CIN'
    });
  }
};

// Search user by CIN
exports.searchByCin = async (req, res) => {
  try {
    const { cin } = req.params;

    if (!cin) {
      return res.status(400).json({
        success: false,
        message: 'CIN requis'
      });
    }

    const user = await User.findOne({
      where: { 
        cin: cin.toUpperCase().trim(),
        deletedAt: null
      },
      attributes: [
        'id', 'employeeId', 'cin', 'firstName', 'lastName', 'email',
        'phone', 'role', 'profilePhoto', 'facialVector', 'facialDescriptor',
        'status', 'hireDate'
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Aucun agent trouvé avec ce CIN'
      });
    }

    // Retourner les données brutes sans toJSON() pour inclure facialVector
    const userData = user.get({ plain: true });
    
    // Décrypter le vecteur facial si présent
    if (userData.facialVector) {
      try {
        userData.facialVector = user.getDecryptedFacialVector();
        console.log('✅ Facial vector decrypted for searchByCin:', {
          cin: userData.cin,
          vectorLength: userData.facialVector?.length
        });
      } catch (decryptError) {
        console.error('⚠️ Error decrypting facial vector:', decryptError.message);
        userData.facialVector = null;
      }
    }

    res.json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('Search by CIN error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche'
    });
  }
};

// Vérifier l'unicité du téléphone principal
exports.checkPhoneUnique = async (req, res) => {
  try {
    const { phone, excludeId } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Numéro de téléphone requis'
      });
    }

    const where = { phone: phone.trim() };
    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    const existing = await User.findOne({ where });

    res.json({
      success: true,
      data: {
        isUnique: !existing,
        field: 'phone'
      }
    });
  } catch (error) {
    console.error('Check phone unique error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du téléphone'
    });
  }
};
