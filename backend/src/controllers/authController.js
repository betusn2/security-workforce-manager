const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { logActivity } = require('../middlewares/activityLogger');

// Generate JWT tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  return { accessToken, refreshToken };
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { employeeId, firstName, lastName, email, password, phone, role, whatsappNumber } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: { [require('sequelize').Op.or]: [{ email }, { employeeId }] }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email
          ? 'Cet email est déjà utilisé'
          : 'Cet ID employé existe déjà'
      });
    }

    const user = await User.create({
      employeeId,
      firstName,
      lastName,
      email,
      password,
      phone,
      whatsappNumber,
      role: role || 'agent'
    });

    const { accessToken, refreshToken } = generateTokens(user);

    user.refreshToken = refreshToken;
    await user.save();

    await logActivity({
      userId: user.id,
      action: 'REGISTER',
      entityType: 'user',
      entityId: user.id,
      description: 'Nouvel utilisateur créé',
      req
    });

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      data: {
        user: user.toJSON(),
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du compte',
      error: error.message
    });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });

    if (!user) {
      // Log failed attempt with unknown user
      await logActivity({
        userId: null,
        action: 'LOGIN_FAILED',
        entityType: 'auth',
        entityId: null,
        description: `Tentative de connexion avec email inconnu: ${email}`,
        req,
        status: 'failure',
        errorMessage: 'Email non trouvé'
      });
      
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    if (user.status !== 'active') {
      await logActivity({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'auth',
        entityId: user.id,
        description: `Tentative de connexion avec compte inactif: ${user.email}`,
        req,
        status: 'failure',
        errorMessage: `Compte ${user.status}`
      });
      
      return res.status(403).json({
        success: false,
        message: 'Compte désactivé ou suspendu. Contactez l\'administrateur.'
      });
    }

    // Validation: Seuls les admins et utilisateurs spécifiques peuvent se connecter par email
    if (user.role === 'agent' || user.role === 'supervisor' || user.role === 'responsable') {
      await logActivity({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        description: `Tentative de connexion par email refusée (${user.role})`,
        req,
        status: 'failure'
      });

      return res.status(403).json({
        success: false,
        message: user.role === 'agent' 
          ? 'Les agents doivent se connecter via la section Agents (CIN)'
          : 'Les responsables doivent se connecter via la section Responsables (CIN)'
      });
    }

    const isPasswordValid = await user.validatePassword(password);

    if (!isPasswordValid) {
      await logActivity({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        description: 'Tentative de connexion échouée',
        req,
        status: 'failure'
      });

      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    await logActivity({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      description: 'Connexion réussie',
      req
    });

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: user.toJSON(),
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion',
      error: error.message
    });
  }
};

// Login by CIN (for agents and supervisors separately)
exports.loginByCin = async (req, res) => {
  try {
    const { cin, userType } = req.body; // userType: 'agent' ou 'supervisor'
    const { isCheckInAllowed, getEventTimeStatus } = require('../utils/eventTimeWindows');
    const { Assignment, Event } = require('../models');
    const { Op } = require('sequelize');

    if (!cin || !cin.trim()) {
      await logActivity({
        userId: null,
        action: 'LOGIN_BY_CIN_FAILED',
        entityType: 'auth',
        entityId: null,
        description: 'Tentative de connexion CIN sans CIN fourni',
        req,
        status: 'failure',
        errorMessage: 'CIN manquant'
      });
      
      return res.status(400).json({
        success: false,
        message: 'CIN requis'
      });
    }

    if (!userType || !['agent', 'supervisor'].includes(userType)) {
      await logActivity({
        userId: null,
        action: 'LOGIN_BY_CIN_FAILED',
        entityType: 'auth',
        entityId: null,
        description: `Tentative de connexion CIN avec type invalide: ${userType}`,
        req,
        status: 'failure',
        errorMessage: 'Type utilisateur invalide'
      });
      
      return res.status(400).json({
        success: false,
        message: 'Type d\'utilisateur requis (agent ou supervisor)'
      });
    }

    const user = await User.findOne({ where: { cin: cin.trim() } });

    if (!user) {
      await logActivity({
        userId: null,
        action: 'LOGIN_BY_CIN_FAILED',
        entityType: 'auth',
        entityId: null,
        description: `Tentative de connexion avec CIN inconnu: ${cin}`,
        req,
        status: 'failure',
        errorMessage: 'CIN non trouvé'
      });
      
      return res.status(401).json({
        success: false,
        message: 'CIN non trouvé'
      });
    }

    // Validate that the user role matches the requested userType
    if (userType === 'agent' && user.role !== 'agent') {
      await logActivity({
        userId: user.id,
        action: 'LOGIN_BY_CIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        description: `Tentative de connexion CIN agent refusée (rôle: ${user.role})`,
        req,
        status: 'failure'
      });

      return res.status(403).json({
        success: false,
        message: user.role === 'supervisor' || user.role === 'responsable'
          ? 'Ce CIN appartient à un responsable. Utilisez la section Responsables'
          : 'Ce CIN ne correspond pas à un agent'
      });
    }

    if (userType === 'supervisor' && user.role !== 'supervisor' && user.role !== 'responsable') {
      await logActivity({
        userId: user.id,
        action: 'LOGIN_BY_CIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        description: `Tentative de connexion CIN responsable refusée (rôle: ${user.role})`,
        req,
        status: 'failure'
      });

      return res.status(403).json({
        success: false,
        message: user.role === 'agent'
          ? 'Ce CIN appartient à un agent. Utilisez la section Agents'
          : 'Ce CIN ne correspond pas à un responsable'
      });
    }

    if (user.status !== 'active') {
      await logActivity({
        userId: user.id,
        action: 'LOGIN_BY_CIN_FAILED',
        entityType: 'auth',
        entityId: user.id,
        description: `Tentative de connexion CIN avec compte inactif: ${user.cin}`,
        req,
        status: 'failure',
        errorMessage: `Compte ${user.status}`
      });
      
      return res.status(403).json({
        success: false,
        message: 'Compte désactivé ou suspendu. Contactez l\'administrateur.'
      });
    }

    // ✅ VÉRIFICATION DES FENÊTRES DE TEMPS POUR LES ÉVÉNEMENTS
    // Récupérer les affectations confirmées de l'utilisateur
    // Pour les agents : via la table assignments (agentId)
    // Pour les superviseurs/responsables : via events.supervisorId
    let eventsToCheck = [];

    if (userType === 'supervisor') {
      // Superviseur : chercher les événements où il est désigné comme superviseur
      const supervisorEvents = await Event.findAll({
        where: {
          supervisorId: user.id,
          status: { [Op.notIn]: ['cancelled', 'terminated'] }
        }
      });
      // Construire des objets compatibles avec la structure attendue plus bas
      eventsToCheck = supervisorEvents.map(e => ({ event: e }));
    } else {
      // Agent : chercher via la table assignments
      const assignments = await Assignment.findAll({
        where: {
          agentId: user.id,
          status: 'confirmed'
        },
        include: [{
          model: Event,
          as: 'event',
          required: true
        }]
      });
      eventsToCheck = assignments;
    }

    if (eventsToCheck.length === 0) {
      await logActivity({
        userId: user.id,
        action: 'LOGIN_BY_CIN_FAILED',
        entityType: 'auth',
        entityId: user.id,
        description: userType === 'supervisor'
          ? 'Connexion CIN refusée - aucun événement supervisé actif'
          : 'Connexion CIN refusée - aucune affectation confirmée',
        req,
        status: 'failure',
        errorMessage: 'Aucune affectation'
      });

      return res.status(403).json({
        success: false,
        message: userType === 'supervisor'
          ? 'Vous n\'êtes responsable d\'aucun événement actif.'
          : 'Vous n\'avez aucune affectation confirmée.',
        code: 'NO_ASSIGNMENTS'
      });
    }

    // ✅ PLUS DE BLOCAGE PAR FENÊTRE DE TEMPS
    // La connexion est toujours autorisée si l'utilisateur est actif et a des affectations.
    // L'app mobile gère l'affichage des événements disponibles dans l'écran CheckIn.
    // On inclut TOUS les événements (valid + hors fenêtre) dans la réponse.
    const allEventsForResponse = eventsToCheck.map(assignment => {
      const event = assignment.event;
      const timeStatus = getEventTimeStatus(event);
      return { event, timeStatus };
    });

    // ✅ Connexion autorisée - Générer les tokens
    const { accessToken, refreshToken } = generateTokens(user);
    // Generate special checkInToken for mobile/agent checkin
    const checkInToken = jwt.sign(
      { id: user.id, role: user.role, type: 'checkin' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    await logActivity({
      userId: user.id,
      action: 'LOGIN_BY_CIN',
      entityType: 'user',
      entityId: user.id,
      description: `Connexion par CIN réussie - ${allEventsForResponse.length} événement(s) trouvé(s)`,
      req
    });

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: user.toJSON(),
        accessToken,
        refreshToken,
        checkInToken,
        validEvents: allEventsForResponse.map(ve => ({
          eventId: ve.event.id,
          eventName: ve.event.name,
          startDate: ve.event.startDate,
          endDate: ve.event.endDate,
          canCheckIn: ve.timeStatus.canCheckIn,
          canCheckOut: ve.timeStatus.canCheckOut,
          isDuringEvent: ve.timeStatus.isDuringEvent,
          isInPreWindow: ve.timeStatus.isInPreWindow
        }))
      }
    });
  } catch (error) {
    console.error('Login by CIN error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion',
      error: error.message
    });
  }
};

// Refresh token
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token requis'
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }

    const user = await User.findByPk(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }

    const tokens = generateTokens(user);

    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expiré. Veuillez vous reconnecter.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rafraîchissement du token'
    });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    const user = req.user;

    user.refreshToken = null;
    await user.save();

    await logActivity({
      userId: user.id,
      action: 'LOGOUT',
      entityType: 'user',
      entityId: user.id,
      description: 'Déconnexion',
      req
    });

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la déconnexion'
    });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    res.json({
      success: true,
      data: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, whatsappNumber, address, notificationPreferences, facialDescriptor } = req.body;
    const user = req.user;

    const oldValues = user.toJSON();

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (whatsappNumber !== undefined) user.whatsappNumber = whatsappNumber;
    if (address !== undefined) user.address = address;
    if (notificationPreferences) user.notificationPreferences = notificationPreferences;
    if (facialDescriptor !== undefined) {
      // Store facialDescriptor as JSON string if it's an array
      if (Array.isArray(facialDescriptor)) {
        user.facialDescriptor = JSON.stringify(facialDescriptor);
        console.log('✅ Descripteur facial mis à jour pour utilisateur:', user.id);
      } else {
        user.facialDescriptor = facialDescriptor;
      }
    }

    await user.save();

    await logActivity({
      userId: user.id,
      action: 'UPDATE_PROFILE',
      entityType: 'user',
      entityId: user.id,
      description: 'Profil mis à jour',
      oldValues,
      newValues: user.toJSON(),
      req
    });

    res.json({
      success: true,
      message: 'Profil mis à jour',
      data: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil'
    });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    const isValid = await user.validatePassword(currentPassword);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    await logActivity({
      userId: user.id,
      action: 'CHANGE_PASSWORD',
      entityType: 'user',
      entityId: user.id,
      description: 'Mot de passe modifié',
      req
    });

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de mot de passe'
    });
  }
};

// Update facial vector
exports.updateFacialVector = async (req, res) => {
  try {
    const { facialVector } = req.body;
    const user = req.user;

    if (!facialVector || !Array.isArray(facialVector)) {
      return res.status(400).json({
        success: false,
        message: 'Vecteur facial invalide'
      });
    }

    user.setEncryptedFacialVector(facialVector);
    await user.save();

    await logActivity({
      userId: user.id,
      action: 'UPDATE_FACIAL_VECTOR',
      entityType: 'user',
      entityId: user.id,
      description: 'Vecteur facial mis à jour',
      req
    });

    res.json({
      success: true,
      message: 'Vecteur facial enregistré avec succès',
      data: {
        facialVectorUpdatedAt: user.facialVectorUpdatedAt
      }
    });
  } catch (error) {
    console.error('❌ Update facial vector error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du vecteur facial',
      error: error.message
    });
  }
};

// ==========================================
// LOGIN PAR CIN (Agents & Responsables)
// ==========================================

// Vérifier le CIN (sans login complet) - pour pré-validation
exports.verifyCin = async (req, res) => {
  try {
    const { cin } = req.body;

    if (!cin) {
      return res.status(400).json({
        success: false,
        message: 'Le numéro CIN est requis'
      });
    }

    const user = await User.findOne({
      where: { cin: cin.toUpperCase().trim() },
      attributes: ['id', 'firstName', 'lastName', 'employeeId', 'role', 'status', 'profilePhoto', 'facialVector']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'CIN non reconnu'
      });
    }

    res.json({
      success: true,
      data: {
        exists: true,
        isActive: user.status === 'active',
        hasFacialVector: !!user.facialVector,
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          employeeId: user.employeeId,
          role: user.role,
          profilePhoto: user.profilePhoto
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
};

// Obtenir le vecteur facial pour vérification (après login CIN)
exports.getFacialVectorForCheckIn = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

      if (!user.facialVector) {
      console.log('Facial vector missing for user:', user.email);
      return res.status(404).json({
        success: false,
        message: 'Aucun vecteur facial enregistré'
      });
    }

    console.log('Facial vector raw (length):', user.facialVector?.length);

    let facialVector;
    try {
      facialVector = user.getDecryptedFacialVector();
      console.log('Facial vector decrypted successfully, length:', facialVector?.length);
    } catch (decryptError) {
      console.error('Facial vector decryption error:', decryptError.message);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors du décryptage du vecteur facial',
        error: decryptError.message
      });
    }

    res.json({
      success: true,
      data: {
        facialVector,
        updatedAt: user.facialVectorUpdatedAt
      }
    });
  } catch (error) {
    console.error('❌ Get facial vector error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du vecteur facial',
      error: error.message
    });
  }
};

// ==========================================
// GESTION DES APPAREILS AUTORISÉS
// ==========================================

// Ajouter un appareil autorisé
exports.addAuthorizedDevice = async (req, res) => {
  try {
    const { userId, deviceFingerprint, deviceName, deviceInfo } = req.body;

    // Seul un admin peut ajouter des appareils, ou l'utilisateur pour lui-même
    const targetUserId = userId || req.user.id;

    if (userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seul un administrateur peut ajouter des appareils pour d\'autres utilisateurs'
      });
    }

    const user = await User.findByPk(targetUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const devices = user.authorizedDevices || [];

    // Vérifier si l'appareil existe déjà
    const existingDevice = devices.find(d => d.fingerprint === deviceFingerprint);
    if (existingDevice) {
      return res.status(400).json({
        success: false,
        message: 'Cet appareil est déjà autorisé'
      });
    }

    // Ajouter le nouvel appareil
    devices.push({
      fingerprint: deviceFingerprint,
      name: deviceName || 'Appareil inconnu',
      info: deviceInfo,
      addedAt: new Date().toISOString(),
      addedBy: req.user.id
    });

    user.authorizedDevices = devices;
    await user.save();

    await logActivity({
      userId: req.user.id,
      action: 'ADD_AUTHORIZED_DEVICE',
      entityType: 'user',
      entityId: targetUserId,
      description: `Appareil autorisé ajouté: ${deviceName || deviceFingerprint}`,
      req
    });

    res.json({
      success: true,
      message: 'Appareil autorisé avec succès',
      data: { devices: user.authorizedDevices }
    });
  } catch (error) {
    console.error('Add device error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout de l\'appareil'
    });
  }
};

// Supprimer un appareil autorisé
exports.removeAuthorizedDevice = async (req, res) => {
  try {
    const { userId, deviceFingerprint } = req.body;

    const targetUserId = userId || req.user.id;

    if (userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seul un administrateur peut supprimer des appareils pour d\'autres utilisateurs'
      });
    }

    const user = await User.findByPk(targetUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const devices = user.authorizedDevices || [];
    const filteredDevices = devices.filter(d => d.fingerprint !== deviceFingerprint);

    if (filteredDevices.length === devices.length) {
      return res.status(404).json({
        success: false,
        message: 'Appareil non trouvé'
      });
    }

    user.authorizedDevices = filteredDevices;
    await user.save();

    await logActivity({
      userId: req.user.id,
      action: 'REMOVE_AUTHORIZED_DEVICE',
      entityType: 'user',
      entityId: targetUserId,
      description: `Appareil autorisé supprimé`,
      req
    });

    res.json({
      success: true,
      message: 'Appareil supprimé',
      data: { devices: user.authorizedDevices }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'appareil'
    });
  }
};

// Lister les appareils autorisés
exports.getAuthorizedDevices = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;

    if (req.params.userId && req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    const user = await User.findByPk(userId, {
      attributes: ['id', 'authorizedDevices']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      data: { devices: user.authorizedDevices || [] }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des appareils'
    });
  }
};

// Vérifier si un appareil est autorisé
exports.checkDeviceAuthorization = async (req, res) => {
  try {
    const { deviceFingerprint } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const devices = user.authorizedDevices || [];

    // Si aucun appareil n'est configuré, autoriser tous les appareils
    if (devices.length === 0) {
      return res.json({
        success: true,
        data: {
          isAuthorized: true,
          noDevicesConfigured: true,
          message: 'Aucun appareil configuré - tous les appareils sont autorisés'
        }
      });
    }

    const isAuthorized = devices.some(d => d.fingerprint === deviceFingerprint);

    res.json({
      success: true,
      data: {
        isAuthorized,
        noDevicesConfigured: false,
        message: isAuthorized ? 'Appareil autorisé' : 'Appareil non autorisé'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
};
