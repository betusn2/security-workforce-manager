const { Permission, RolePermission, UserPermission, User } = require('../models');
const { Op } = require('sequelize');

// Liste de toutes les permissions disponibles dans l'application
const DEFAULT_PERMISSIONS = [
  // Module: Dashboard
  { code: 'dashboard.view', name: 'Voir le tableau de bord', module: 'dashboard', action: 'view' },
  { code: 'dashboard.stats', name: 'Voir les statistiques', module: 'dashboard', action: 'view' },

  // Module: Utilisateurs
  { code: 'users.view', name: 'Voir les utilisateurs', module: 'users', action: 'view' },
  { code: 'users.create', name: 'Créer des utilisateurs', module: 'users', action: 'create' },
  { code: 'users.update', name: 'Modifier des utilisateurs', module: 'users', action: 'update' },
  { code: 'users.delete', name: 'Supprimer des utilisateurs', module: 'users', action: 'delete' },
  { code: 'users.manage_permissions', name: 'Gérer les permissions', module: 'users', action: 'manage' },

  // Module: Événements
  { code: 'events.view', name: 'Voir les événements', module: 'events', action: 'view' },
  { code: 'events.create', name: 'Créer des événements', module: 'events', action: 'create' },
  { code: 'events.update', name: 'Modifier des événements', module: 'events', action: 'update' },
  { code: 'events.delete', name: 'Supprimer des événements', module: 'events', action: 'delete' },

  // Module: Assignments (Affectations)
  { code: 'assignments.view', name: 'Voir les affectations', module: 'assignments', action: 'view' },
  { code: 'assignments.create', name: 'Créer des affectations', module: 'assignments', action: 'create' },
  { code: 'assignments.update', name: 'Modifier des affectations', module: 'assignments', action: 'update' },
  { code: 'assignments.delete', name: 'Supprimer des affectations', module: 'assignments', action: 'delete' },

  // Module: Pointage (Attendance)
  { code: 'attendance.view', name: 'Voir les pointages', module: 'attendance', action: 'view' },
  { code: 'attendance.view_own', name: 'Voir ses propres pointages', module: 'attendance', action: 'view' },
  { code: 'attendance.create', name: 'Créer des pointages', module: 'attendance', action: 'create' },
  { code: 'attendance.update', name: 'Modifier des pointages', module: 'attendance', action: 'update' },
  { code: 'attendance.checkin', name: 'Pointer (check-in/out)', module: 'attendance', action: 'create' },

  // Module: Rapports
  { code: 'reports.view', name: 'Voir les rapports', module: 'reports', action: 'view' },
  { code: 'reports.export', name: 'Exporter les rapports', module: 'reports', action: 'export' },
  { code: 'reports.advanced', name: 'Rapports avancés', module: 'reports', action: 'view' },

  // Module: Incidents
  { code: 'incidents.view', name: 'Voir les incidents', module: 'incidents', action: 'view' },
  { code: 'incidents.create', name: 'Signaler des incidents', module: 'incidents', action: 'create' },
  { code: 'incidents.update', name: 'Modifier des incidents', module: 'incidents', action: 'update' },
  { code: 'incidents.resolve', name: 'Résoudre des incidents', module: 'incidents', action: 'update' },
  { code: 'incidents.delete', name: 'Supprimer des incidents', module: 'incidents', action: 'delete' },

  // Module: Notifications
  { code: 'notifications.view', name: 'Voir les notifications', module: 'notifications', action: 'view' },
  { code: 'notifications.send', name: 'Envoyer des notifications', module: 'notifications', action: 'create' },
  { code: 'notifications.broadcast', name: 'Diffuser des notifications', module: 'notifications', action: 'create' },

  // Module: Messages
  { code: 'messages.view', name: 'Voir les messages', module: 'messages', action: 'view' },
  { code: 'messages.send', name: 'Envoyer des messages', module: 'messages', action: 'create' },
  { code: 'messages.broadcast', name: 'Diffuser des messages', module: 'messages', action: 'create' },

  // Module: Tracking (Géolocalisation)
  { code: 'tracking.view', name: 'Voir la géolocalisation', module: 'tracking', action: 'view' },
  { code: 'tracking.view_agents', name: 'Voir position des agents', module: 'tracking', action: 'view' },
  { code: 'tracking.history', name: 'Voir historique positions', module: 'tracking', action: 'view' },

  // Module: SOS
  { code: 'sos.trigger', name: 'Déclencher une alerte SOS', module: 'sos', action: 'create' },
  { code: 'sos.view', name: 'Voir les alertes SOS', module: 'sos', action: 'view' },
  { code: 'sos.respond', name: 'Répondre aux alertes SOS', module: 'sos', action: 'update' },

  // Module: Badges
  { code: 'badges.view', name: 'Voir les badges', module: 'badges', action: 'view' },
  { code: 'badges.award', name: 'Attribuer des badges', module: 'badges', action: 'create' },
  { code: 'badges.manage', name: 'Gérer les badges', module: 'badges', action: 'manage' },

  // Module: Documents
  { code: 'documents.view', name: 'Voir les documents', module: 'documents', action: 'view' },
  { code: 'documents.upload', name: 'Uploader des documents', module: 'documents', action: 'create' },
  { code: 'documents.verify', name: 'Vérifier des documents', module: 'documents', action: 'update' },
  { code: 'documents.delete', name: 'Supprimer des documents', module: 'documents', action: 'delete' },

  // Module: Administration
  { code: 'admin.access', name: 'Accéder à l\'espace admin', module: 'admin', action: 'view' },
  { code: 'admin.settings', name: 'Modifier les paramètres', module: 'admin', action: 'manage' },
  { code: 'admin.logs', name: 'Voir les logs d\'activité', module: 'admin', action: 'view' },
  { code: 'admin.permissions', name: 'Gérer les permissions', module: 'admin', action: 'manage' },

  // Module: Nouvelles pages ajoutées - Database Management
  { code: 'database.view', name: 'Voir les sauvegardes BD', module: 'database', action: 'view' },
  { code: 'database.backup', name: 'Créer des sauvegardes', module: 'database', action: 'create' },
  { code: 'database.restore', name: 'Restaurer la BD', module: 'database', action: 'update' },
  { code: 'database.delete', name: 'Supprimer sauvegardes', module: 'database', action: 'delete' },

  // Module: Check-In/Out
  { code: 'checkin.view', name: 'Voir les check-in/out', module: 'checkin', action: 'view' },
  { code: 'checkin.create', name: 'Effectuer check-in/out', module: 'checkin', action: 'create' },
  { code: 'checkin.verify', name: 'Vérifier check-in/out', module: 'checkin', action: 'update' },

  // Module: Facial Recognition
  { code: 'facial.view', name: 'Voir reconnaissance faciale', module: 'facial', action: 'view' },
  { code: 'facial.enroll', name: 'Enregistrer visages', module: 'facial', action: 'create' },
  { code: 'facial.verify', name: 'Vérifier visages', module: 'facial', action: 'update' },
  { code: 'facial.delete', name: 'Supprimer données faciales', module: 'facial', action: 'delete' },

  // Module: Logs Admin
  { code: 'logs.view', name: 'Voir les journaux', module: 'logs', action: 'view' },
  { code: 'logs.export', name: 'Exporter les journaux', module: 'logs', action: 'export' },
  { code: 'logs.clear', name: 'Effacer les journaux', module: 'logs', action: 'delete' },

  // Module: Agent Tracking (carte)
  { code: 'agent_tracking.view', name: 'Voir carte agents', module: 'agent_tracking', action: 'view' },
  { code: 'agent_tracking.monitor', name: 'Surveiller agents', module: 'agent_tracking', action: 'view' },

  // Module: Supervisor Agents Management
  { code: 'supervisor_agents.view', name: 'Voir agents supervisés', module: 'supervisor_agents', action: 'view' },
  { code: 'supervisor_agents.assign', name: 'Assigner agents', module: 'supervisor_agents', action: 'create' },
  { code: 'supervisor_agents.manage', name: 'Gérer agents', module: 'supervisor_agents', action: 'update' },

  // Module: Attendance Verification
  { code: 'attendance_verification.view', name: 'Voir vérification pointage', module: 'attendance_verification', action: 'view' },
  { code: 'attendance_verification.verify', name: 'Vérifier pointages', module: 'attendance_verification', action: 'update' },
  { code: 'attendance_verification.approve', name: 'Approuver pointages', module: 'attendance_verification', action: 'update' },

  // Module: Creation History
  { code: 'creation_history.view', name: 'Voir historique création', module: 'creation_history', action: 'view' },
  { code: 'creation_history.export', name: 'Exporter historique', module: 'creation_history', action: 'export' },

  // Module: Settings
  { code: 'settings.view', name: 'Voir paramètres', module: 'settings', action: 'view' },
  { code: 'settings.update', name: 'Modifier paramètres', module: 'settings', action: 'update' },
  { code: 'settings.system', name: 'Paramètres système', module: 'settings', action: 'manage' },

  // Module: Permissions Management
  { code: 'permissions.view', name: 'Voir permissions', module: 'permissions', action: 'view' },
  { code: 'permissions.assign', name: 'Assigner permissions', module: 'permissions', action: 'update' },
  { code: 'permissions.manage', name: 'Gérer permissions', module: 'permissions', action: 'manage' },

  // Module: Profile
  { code: 'profile.view', name: 'Voir profil', module: 'profile', action: 'view' },
  { code: 'profile.update', name: 'Modifier profil', module: 'profile', action: 'update' },
  { code: 'profile.change_password', name: 'Changer mot de passe', module: 'profile', action: 'update' },

  // Module: Monitoring
  { code: 'monitoring.view', name: 'Voir surveillance système', module: 'monitoring', action: 'view' },
  { code: 'monitoring.alerts', name: 'Voir alertes système', module: 'monitoring', action: 'view' },
  { code: 'monitoring.manage', name: 'Gérer surveillance', module: 'monitoring', action: 'manage' },

  // Module: Pages du menu manquantes
  // Planning
  { code: 'planning.view', name: 'Voir planning', module: 'planning', action: 'view' },
  { code: 'planning.create', name: 'Créer planning', module: 'planning', action: 'create' },
  { code: 'planning.update', name: 'Modifier planning', module: 'planning', action: 'update' },
  { code: 'planning.delete', name: 'Supprimer planning', module: 'planning', action: 'delete' },

  // Presences
  { code: 'presences.view', name: 'Voir présences', module: 'presences', action: 'view' },
  { code: 'presences.manage', name: 'Gérer présences', module: 'presences', action: 'update' },
  { code: 'presences.export', name: 'Exporter présences', module: 'presences', action: 'export' },

  // Verification (système global de vérification)
  { code: 'verification.view', name: 'Voir vérifications', module: 'verification', action: 'view' },
  { code: 'verification.process', name: 'Traiter vérifications', module: 'verification', action: 'update' },
  { code: 'verification.approve', name: 'Approuver éléments', module: 'verification', action: 'update' },

  // Pointage (système principal de pointage)
  { code: 'pointage.view', name: 'Voir pointages', module: 'pointage', action: 'view' },
  { code: 'pointage.manage', name: 'Gérer pointages', module: 'pointage', action: 'update' },
  { code: 'pointage.validate', name: 'Valider pointages', module: 'pointage', action: 'update' },

  // GPS Tracking (distinct du tracking général)
  { code: 'gps_tracking.view', name: 'Voir suivi GPS', module: 'gps_tracking', action: 'view' },
  { code: 'gps_tracking.monitor', name: 'Surveiller GPS', module: 'gps_tracking', action: 'view' },
  { code: 'gps_tracking.history', name: 'Historique GPS', module: 'gps_tracking', action: 'view' },

  // Classification/Classement
  { code: 'classification.view', name: 'Voir classements', module: 'classification', action: 'view' },
  { code: 'classification.update', name: 'Modifier classements', module: 'classification', action: 'update' },
  { code: 'classification.export', name: 'Exporter classements', module: 'classification', action: 'export' },

  // Advanced Notifications
  { code: 'advanced_notifications.view', name: 'Voir notifications avancées', module: 'advanced_notifications', action: 'view' },
  { code: 'advanced_notifications.create', name: 'Créer notifications avancées', module: 'advanced_notifications', action: 'create' },
  { code: 'advanced_notifications.manage', name: 'Gérer notifications avancées', module: 'advanced_notifications', action: 'manage' },

  // Audit Trail
  { code: 'audit_trail.view', name: 'Voir piste d\'audit', module: 'audit_trail', action: 'view' },
  { code: 'audit_trail.export', name: 'Exporter logs audit', module: 'audit_trail', action: 'export' },
  { code: 'audit_trail.analyze', name: 'Analyser audit', module: 'audit_trail', action: 'view' },

  // Module: Zones (gestion des zones d'événements)
  { code: 'zones.view', name: 'Voir les zones', module: 'zones', action: 'view' },
  { code: 'zones.create', name: 'Créer des zones', module: 'zones', action: 'create' },
  { code: 'zones.update', name: 'Modifier des zones', module: 'zones', action: 'update' },
  { code: 'zones.delete', name: 'Supprimer des zones', module: 'zones', action: 'delete' },
  { code: 'zones.assign', name: 'Assigner agents aux zones', module: 'zones', action: 'create' },
  { code: 'zones.manage', name: 'Gérer toutes les zones', module: 'zones', action: 'manage' }
];

// Permissions par défaut pour chaque rôle
const DEFAULT_ROLE_PERMISSIONS = {
  admin: [
    // Admin a toutes les permissions
    'dashboard.view', 'dashboard.stats',
    'users.view', 'users.create', 'users.update', 'users.delete', 'users.manage_permissions',
    'events.view', 'events.create', 'events.update', 'events.delete',
    'assignments.view', 'assignments.create', 'assignments.update', 'assignments.delete',
    'attendance.view', 'attendance.view_own', 'attendance.create', 'attendance.update', 'attendance.checkin',
    'reports.view', 'reports.export', 'reports.advanced',
    'incidents.view', 'incidents.create', 'incidents.update', 'incidents.resolve', 'incidents.delete',
    'notifications.view', 'notifications.send', 'notifications.broadcast',
    'messages.view', 'messages.send', 'messages.broadcast',
    'tracking.view', 'tracking.view_agents', 'tracking.history',
    'sos.trigger', 'sos.view', 'sos.respond',
    'badges.view', 'badges.award', 'badges.manage',
    'documents.view', 'documents.upload', 'documents.verify', 'documents.delete',
    'admin.access', 'admin.settings', 'admin.logs', 'admin.permissions',
    // Nouveaux modules
    'database.view', 'database.backup', 'database.restore', 'database.delete',
    'checkin.view', 'checkin.create', 'checkin.verify',
    'facial.view', 'facial.enroll', 'facial.verify', 'facial.delete',
    'logs.view', 'logs.export', 'logs.clear',
    'agent_tracking.view', 'agent_tracking.monitor',
    'supervisor_agents.view', 'supervisor_agents.assign', 'supervisor_agents.manage',
    'attendance_verification.view', 'attendance_verification.verify', 'attendance_verification.approve',
    'creation_history.view', 'creation_history.export',
    'settings.view', 'settings.update', 'settings.system',
    'permissions.view', 'permissions.assign', 'permissions.manage',
    'profile.view', 'profile.update', 'profile.change_password',
    'monitoring.view', 'monitoring.alerts', 'monitoring.manage',
    // Nouveaux modules du menu
    'planning.view', 'planning.create', 'planning.update', 'planning.delete',
    'presences.view', 'presences.manage', 'presences.export',
    'verification.view', 'verification.process', 'verification.approve',
    'pointage.view', 'pointage.manage', 'pointage.validate',
    'gps_tracking.view', 'gps_tracking.monitor', 'gps_tracking.history',
    'classification.view', 'classification.update', 'classification.export',
    'advanced_notifications.view', 'advanced_notifications.create', 'advanced_notifications.manage',
    'audit_trail.view', 'audit_trail.export', 'audit_trail.analyze',
    // Zones
    'zones.view', 'zones.create', 'zones.update', 'zones.delete', 'zones.assign', 'zones.manage'
  ],
  supervisor: [
    'dashboard.view', 'dashboard.stats',
    'users.view',
    'events.view', 'events.create', 'events.update',
    'assignments.view', 'assignments.create', 'assignments.update',
    'attendance.view', 'attendance.view_own', 'attendance.update', 'attendance.checkin',
    'reports.view', 'reports.export',
    'incidents.view', 'incidents.create', 'incidents.update', 'incidents.resolve',
    'notifications.view', 'notifications.send',
    'messages.view', 'messages.send', 'messages.broadcast',
    'tracking.view', 'tracking.view_agents', 'tracking.history',
    'sos.trigger', 'sos.view', 'sos.respond',
    'badges.view', 'badges.award',
    'documents.view', 'documents.upload', 'documents.verify',
    // Nouveaux modules pour superviseur
    'checkin.view', 'checkin.verify',
    'facial.view',
    'logs.view',
    'agent_tracking.view', 'agent_tracking.monitor',
    'supervisor_agents.view', 'supervisor_agents.assign', 'supervisor_agents.manage',
    'attendance_verification.view', 'attendance_verification.verify', 'attendance_verification.approve',
    'creation_history.view',
    'settings.view',
    'profile.view', 'profile.update', 'profile.change_password',
    'monitoring.view',
    // Nouveaux modules pour superviseur
    'planning.view', 'planning.create', 'planning.update',
    'presences.view', 'presences.manage',
    'verification.view', 'verification.process', 'verification.approve',
    'pointage.view', 'pointage.manage', 'pointage.validate',
    'gps_tracking.view', 'gps_tracking.monitor', 'gps_tracking.history',
    'classification.view',
    'advanced_notifications.view', 'advanced_notifications.create',
    'audit_trail.view',
    // Zones
    'zones.view', 'zones.create', 'zones.update', 'zones.assign'
  ],
  agent: [
    'dashboard.view',
    'events.view',
    'assignments.view',
    'attendance.view_own', 'attendance.checkin',
    'incidents.view', 'incidents.create',
    'notifications.view',
    'messages.view', 'messages.send',
    'tracking.view',
    'sos.trigger',
    'badges.view',
    'documents.view', 'documents.upload',
    // Nouveaux modules pour agent
    'checkin.view', 'checkin.create',
    'agent_tracking.view',
    'attendance_verification.view',
    'profile.view', 'profile.update', 'profile.change_password',
    // Nouveaux modules pour agent
    'planning.view',
    'presences.view',
    'verification.view',
    'pointage.view',
    'gps_tracking.view',
    'classification.view',
    // Zones
    'zones.view'
  ],
  user: [
    // Utilisateur simple - permissions minimales par défaut
    'dashboard.view',
    'notifications.view',
    'messages.view', 'messages.send',
    'profile.view', 'profile.update', 'profile.change_password'
  ]
};

// Initialiser les permissions dans la base de données
exports.initializePermissions = async (req, res) => {
  try {
    // Créer toutes les permissions par défaut
    for (const perm of DEFAULT_PERMISSIONS) {
      await Permission.findOrCreate({
        where: { code: perm.code },
        defaults: perm
      });
    }

    // Créer les permissions par rôle
    for (const [role, permCodes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const code of permCodes) {
        const permission = await Permission.findOne({ where: { code } });
        if (permission) {
          await RolePermission.findOrCreate({
            where: { role, permissionId: permission.id },
            defaults: {
              role,
              permissionId: permission.id,
              isActive: true
            }
          });
        }
      }
    }

    res.json({
      success: true,
      message: 'Permissions initialisées avec succès',
      data: {
        permissionsCount: DEFAULT_PERMISSIONS.length,
        roles: Object.keys(DEFAULT_ROLE_PERMISSIONS)
      }
    });
  } catch (error) {
    console.error('Error initializing permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'initialisation des permissions',
      error: error.message
    });
  }
};

// Obtenir toutes les permissions
exports.getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.findAll({
      where: { isActive: true },
      order: [['module', 'ASC'], ['action', 'ASC']]
    });

    // Grouper par module
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = [];
      }
      acc[perm.module].push(perm);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        permissions,
        grouped,
        modules: Object.keys(grouped)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des permissions'
    });
  }
};

// Obtenir les permissions d'un rôle
exports.getRolePermissions = async (req, res) => {
  try {
    const { role } = req.params;

    const rolePermissions = await RolePermission.findAll({
      where: { role, isActive: true },
      include: [{
        model: Permission,
        as: 'permission',
        where: { isActive: true }
      }]
    });

    const permissionCodes = rolePermissions.map(rp => rp.permission.code);

    res.json({
      success: true,
      data: {
        role,
        permissions: rolePermissions.map(rp => rp.permission),
        permissionCodes
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des permissions du rôle'
    });
  }
};

// Mettre à jour les permissions d'un rôle
exports.updateRolePermissions = async (req, res) => {
  try {
    const { role } = req.params;
    const { permissionCodes } = req.body;

    if (!['agent', 'supervisor', 'admin', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide'
      });
    }

    // Désactiver toutes les permissions actuelles du rôle
    await RolePermission.update(
      { isActive: false },
      { where: { role } }
    );

    // Activer les nouvelles permissions
    for (const code of permissionCodes) {
      const permission = await Permission.findOne({ where: { code } });
      if (permission) {
        const [rolePermission, created] = await RolePermission.findOrCreate({
          where: { role, permissionId: permission.id },
          defaults: {
            role,
            permissionId: permission.id,
            grantedBy: req.user.id,
            isActive: true
          }
        });

        if (!created) {
          rolePermission.isActive = true;
          rolePermission.grantedBy = req.user.id;
          await rolePermission.save();
        }
      }
    }

    res.json({
      success: true,
      message: `Permissions du rôle ${role} mises à jour`,
      data: { role, permissionCodes }
    });
  } catch (error) {
    console.error('Error updating role permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des permissions'
    });
  }
};

// Obtenir les permissions d'un utilisateur
exports.getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Permissions du rôle
    const rolePermissions = await RolePermission.findAll({
      where: { role: user.role, isActive: true },
      include: [{
        model: Permission,
        as: 'permission',
        where: { isActive: true }
      }]
    });

    // Permissions personnalisées de l'utilisateur
    const userPermissions = await UserPermission.findAll({
      where: { userId },
      include: [{
        model: Permission,
        as: 'permission'
      }]
    });

    // Combiner les permissions
    const rolePermCodes = rolePermissions.map(rp => rp.permission.code);
    const grantedPerms = userPermissions.filter(up => up.granted).map(up => up.permission.code);
    const deniedPerms = userPermissions.filter(up => !up.granted).map(up => up.permission.code);

    // Permissions effectives = (role + granted) - denied
    const effectivePermissions = [
      ...new Set([...rolePermCodes, ...grantedPerms])
    ].filter(code => !deniedPerms.includes(code));

    res.json({
      success: true,
      data: {
        userId,
        role: user.role,
        rolePermissions: rolePermCodes,
        customPermissions: {
          granted: grantedPerms,
          denied: deniedPerms
        },
        effectivePermissions
      }
    });
  } catch (error) {
    console.error('Error getting user permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des permissions'
    });
  }
};

// Mettre à jour les permissions d'un utilisateur
exports.updateUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { grantedPermissions, deniedPermissions } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Supprimer toutes les permissions personnalisées existantes
    await UserPermission.destroy({ where: { userId } });

    // Ajouter les permissions accordées
    if (grantedPermissions && grantedPermissions.length > 0) {
      for (const code of grantedPermissions) {
        const permission = await Permission.findOne({ where: { code } });
        if (permission) {
          await UserPermission.create({
            userId,
            permissionId: permission.id,
            granted: true,
            grantedBy: req.user.id
          });
        }
      }
    }

    // Ajouter les permissions refusées
    if (deniedPermissions && deniedPermissions.length > 0) {
      for (const code of deniedPermissions) {
        const permission = await Permission.findOne({ where: { code } });
        if (permission) {
          await UserPermission.create({
            userId,
            permissionId: permission.id,
            granted: false,
            grantedBy: req.user.id
          });
        }
      }
    }

    res.json({
      success: true,
      message: 'Permissions utilisateur mises à jour',
      data: {
        userId,
        grantedPermissions,
        deniedPermissions
      }
    });
  } catch (error) {
    console.error('Error updating user permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des permissions'
    });
  }
};

// Vérifier si un utilisateur a une permission
exports.checkPermission = async (userId, permissionCode) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) return false;

    // Admin a toutes les permissions
    if (user.role === 'admin') return true;

    // Vérifier permission personnalisée refusée
    const deniedPerm = await UserPermission.findOne({
      where: { userId },
      include: [{
        model: Permission,
        as: 'permission',
        where: { code: permissionCode }
      }]
    });

    if (deniedPerm && !deniedPerm.granted) return false;

    // Vérifier permission personnalisée accordée
    if (deniedPerm && deniedPerm.granted) return true;

    // Vérifier permission du rôle
    const rolePermission = await RolePermission.findOne({
      where: { role: user.role, isActive: true },
      include: [{
        model: Permission,
        as: 'permission',
        where: { code: permissionCode, isActive: true }
      }]
    });

    return !!rolePermission;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
};

// Obtenir mes permissions (utilisateur connecté)
exports.getMyPermissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    // Permissions du rôle
    const rolePermissions = await RolePermission.findAll({
      where: { role: user.role, isActive: true },
      include: [{
        model: Permission,
        as: 'permission',
        where: { isActive: true }
      }]
    });

    // Permissions personnalisées
    const userPermissions = await UserPermission.findAll({
      where: { userId },
      include: [{
        model: Permission,
        as: 'permission'
      }]
    });

    const rolePermCodes = rolePermissions.map(rp => rp.permission.code);
    const grantedPerms = userPermissions.filter(up => up.granted).map(up => up.permission.code);
    const deniedPerms = userPermissions.filter(up => !up.granted).map(up => up.permission.code);

    const effectivePermissions = [
      ...new Set([...rolePermCodes, ...grantedPerms])
    ].filter(code => !deniedPerms.includes(code));

    res.json({
      success: true,
      data: {
        role: user.role,
        permissions: effectivePermissions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des permissions'
    });
  }
};

// Obtenir les permissions de tous les rôles
exports.getAllRolesPermissions = async (req, res) => {
  try {
    const roles = ['admin', 'supervisor', 'agent', 'user'];
    const result = {};

    for (const role of roles) {
      const rolePermissions = await RolePermission.findAll({
        where: { role, isActive: true },
        include: [{
          model: Permission,
          as: 'permission',
          where: { isActive: true }
        }]
      });

      result[role] = rolePermissions.map(rp => rp.permission.code);
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des permissions'
    });
  }
};
