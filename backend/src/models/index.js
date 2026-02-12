const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Function to create database if it doesn't exist (MySQL only)
const createDatabaseIfNotExists = async () => {
  // Skip database creation for PostgreSQL or production (database already exists)
  if (dbConfig.dialect === 'postgres' || process.env.DATABASE_URL || env === 'production') {
    console.log(`✅ Using existing database (${dbConfig.dialect || 'MySQL'}) - creation skipped in ${env} mode`);
    return;
  }

  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.username,
      password: dbConfig.password
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );

    console.log(`✅ MySQL Database '${dbConfig.database}' is ready.`);
    await connection.end();
  } catch (error) {
    console.error('Error creating database:', error.message);
  }
};

// Create database before initializing Sequelize (MySQL only)
const initPromise = createDatabaseIfNotExists();

// Initialize Sequelize with DATABASE_URL or individual credentials
let sequelize;

if (process.env.DATABASE_URL && dbConfig.use_env_variable) {
  // Use DATABASE_URL for PostgreSQL (Render's preferred method)
  console.log(`🔌 Connecting with DATABASE_URL (${dbConfig.dialect})`);
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    dialectOptions: dbConfig.dialectOptions,
    define: {
      underscored: true, // Use snake_case in database
      timestamps: true,
      paranoid: true
    }
  });
} else {
  // Use individual credentials (MySQL or PostgreSQL with separate env vars)
  console.log(`🔌 Connecting to ${dbConfig.dialect} at ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
      host: dbConfig.host,
      port: dbConfig.port,
      dialect: dbConfig.dialect,
      logging: dbConfig.logging,
      pool: dbConfig.pool,
      dialectOptions: dbConfig.dialectOptions,
      define: {
        underscored: true, // Use snake_case in database
        timestamps: true,
        paranoid: true
      }
    }
  );
}

const db = {};
db.initPromise = initPromise;

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import Models
db.User = require('./User')(sequelize, Sequelize);
db.Event = require('./Event')(sequelize, Sequelize);
db.Assignment = require('./Assignment')(sequelize, Sequelize);
db.Attendance = require('./Attendance')(sequelize, Sequelize);
db.Notification = require('./Notification')(sequelize, Sequelize);
db.ActivityLog = require('./ActivityLog')(sequelize, Sequelize);
db.Incident = require('./Incident')(sequelize, Sequelize);
db.Badge = require('./Badge')(sequelize, Sequelize);
db.UserDocument = require('./UserDocument')(sequelize, Sequelize);
const { UserBadgeModel } = require('./Badge');
db.UserBadge = UserBadgeModel(sequelize, Sequelize);

// V2 Models - Systeme Intelligent
db.GeoTracking = require('./GeoTracking')(sequelize, Sequelize);
db.Conversation = require('./Conversation')(sequelize, Sequelize);
db.Message = require('./Message')(sequelize, Sequelize);
db.LivenessLog = require('./LivenessLog')(sequelize, Sequelize);
db.FraudAttempt = require('./FraudAttempt')(sequelize, Sequelize);
db.SosAlert = require('./SosAlert')(sequelize, Sequelize);

// V3 Models - Permissions System
db.Permission = require('./Permission')(sequelize, Sequelize);
db.RolePermission = require('./RolePermission')(sequelize, Sequelize);
db.UserPermission = require('./UserPermission')(sequelize, Sequelize);

// V4 Models - Zone System
db.Zone = require('./Zone')(sequelize, Sequelize);

// V5 Models - Scheduled Backup System
db.ScheduledBackup = require('./ScheduledBackup')(sequelize, Sequelize);

// Define Associations
// User associations
db.User.hasMany(db.Assignment, { foreignKey: 'agentId', as: 'assignments' });
db.User.hasMany(db.Attendance, { foreignKey: 'agentId', as: 'attendances' });
db.User.hasMany(db.Notification, { foreignKey: 'userId', as: 'notifications' });
db.User.hasMany(db.ActivityLog, { foreignKey: 'userId', as: 'activityLogs' });
db.User.hasMany(db.Event, { foreignKey: 'createdBy', as: 'createdEvents' });

// Self-referencing association: Supervisor -> Agents
// Un superviseur peut avoir plusieurs agents
db.User.hasMany(db.User, { foreignKey: 'supervisorId', as: 'supervisedAgents' });
// Un agent appartient à un superviseur
db.User.belongsTo(db.User, { foreignKey: 'supervisorId', as: 'supervisor' });

// Creator association: Qui a créé l'utilisateur
db.User.belongsTo(db.User, { foreignKey: 'createdByUserId', as: 'creator' });
db.User.hasMany(db.User, { foreignKey: 'createdByUserId', as: 'createdUsers' });

// Validator association: Qui a validé l'utilisateur
db.User.belongsTo(db.User, { foreignKey: 'validatedBy', as: 'validator' });
db.User.hasMany(db.User, { foreignKey: 'validatedBy', as: 'validatedUsers' });

// Responsable association: Responsable/superviseur d'un agent
db.User.belongsTo(db.User, { foreignKey: 'supervisorId', as: 'responsable' });

// Event associations
db.Event.belongsTo(db.User, { foreignKey: 'createdBy', as: 'creator' });
db.Event.belongsTo(db.User, { foreignKey: 'supervisorId', as: 'supervisor' });
db.Event.hasMany(db.Assignment, { foreignKey: 'eventId', as: 'assignments' });
db.Event.hasMany(db.Attendance, { foreignKey: 'eventId', as: 'attendances' });

// Assignment associations
db.Assignment.belongsTo(db.User, { foreignKey: 'agentId', as: 'agent' });
db.Assignment.belongsTo(db.Event, { foreignKey: 'eventId', as: 'event' });
db.Assignment.belongsTo(db.User, { foreignKey: 'assignedBy', as: 'assignedByUser' });

// Attendance associations
db.Attendance.belongsTo(db.User, { foreignKey: 'agentId', as: 'agent' });
db.Attendance.belongsTo(db.Event, { foreignKey: 'eventId', as: 'event' });

// Notification associations
db.Notification.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });

// ActivityLog associations
db.ActivityLog.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });

// Incident associations - constraints disabled to avoid FK issues with sync
db.Incident.belongsTo(db.Event, { foreignKey: 'eventId', as: 'event', constraints: false });
db.Incident.belongsTo(db.User, { foreignKey: 'reportedBy', as: 'reporter', constraints: false });
db.Incident.belongsTo(db.User, { foreignKey: 'assignedTo', as: 'assignee', constraints: false });
db.Incident.belongsTo(db.User, { foreignKey: 'resolvedBy', as: 'resolver', constraints: false });
db.Event.hasMany(db.Incident, { foreignKey: 'eventId', as: 'incidents', constraints: false });
db.User.hasMany(db.Incident, { foreignKey: 'reportedBy', as: 'reportedIncidents', constraints: false });

// Badge associations - constraints disabled to avoid FK issues with sync
db.Badge.hasMany(db.UserBadge, { foreignKey: 'badgeId', as: 'userBadges', constraints: false });
db.UserBadge.belongsTo(db.Badge, { foreignKey: 'badgeId', as: 'badge', constraints: false });
db.UserBadge.belongsTo(db.User, { foreignKey: 'userId', as: 'user', constraints: false });
db.UserBadge.belongsTo(db.User, { foreignKey: 'awardedBy', as: 'awarder', constraints: false });
db.User.hasMany(db.UserBadge, { foreignKey: 'userId', as: 'userBadges', constraints: false });

// UserDocument associations
db.User.hasMany(db.UserDocument, { foreignKey: 'userId', as: 'documents' });
db.UserDocument.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
db.UserDocument.belongsTo(db.User, { foreignKey: 'uploadedBy', as: 'uploader', constraints: false });
db.UserDocument.belongsTo(db.User, { foreignKey: 'verifiedBy', as: 'verifier', constraints: false });

// V2 Associations - GeoTracking
db.User.hasMany(db.GeoTracking, { foreignKey: 'userId', as: 'geoTrackings' });
db.GeoTracking.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
db.Event.hasMany(db.GeoTracking, { foreignKey: 'eventId', as: 'geoTrackings', constraints: false });
db.GeoTracking.belongsTo(db.Event, { foreignKey: 'eventId', as: 'event', constraints: false });

// V2 Associations - Messaging
db.User.hasMany(db.Conversation, { foreignKey: 'createdBy', as: 'createdConversations' });
db.Conversation.belongsTo(db.User, { foreignKey: 'createdBy', as: 'creator' });
db.Conversation.belongsTo(db.Event, { foreignKey: 'eventId', as: 'event', constraints: false });
db.Event.hasMany(db.Conversation, { foreignKey: 'eventId', as: 'conversations', constraints: false });

db.Conversation.hasMany(db.Message, { foreignKey: 'conversationId', as: 'messages' });
db.Message.belongsTo(db.Conversation, { foreignKey: 'conversationId', as: 'conversation' });
db.Message.belongsTo(db.User, { foreignKey: 'senderId', as: 'sender' });
db.Message.belongsTo(db.User, { foreignKey: 'recipientId', as: 'recipient', constraints: false });
db.Message.belongsTo(db.Event, { foreignKey: 'eventId', as: 'event', constraints: false });
db.User.hasMany(db.Message, { foreignKey: 'senderId', as: 'sentMessages' });

// V2 Associations - Liveness & Fraud
db.User.hasMany(db.LivenessLog, { foreignKey: 'userId', as: 'livenessLogs' });
db.LivenessLog.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });

db.User.hasMany(db.FraudAttempt, { foreignKey: 'userId', as: 'fraudAttempts', constraints: false });
db.FraudAttempt.belongsTo(db.User, { foreignKey: 'userId', as: 'user', constraints: false });
db.Event.hasMany(db.FraudAttempt, { foreignKey: 'eventId', as: 'fraudAttempts', constraints: false });
db.FraudAttempt.belongsTo(db.Event, { foreignKey: 'eventId', as: 'event', constraints: false });

// V2 Associations - SOS Alerts
db.User.hasMany(db.SosAlert, { foreignKey: 'userId', as: 'sosAlerts' });
db.SosAlert.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
db.Event.hasMany(db.SosAlert, { foreignKey: 'eventId', as: 'sosAlerts', constraints: false });
db.SosAlert.belongsTo(db.Event, { foreignKey: 'eventId', as: 'event', constraints: false });

// V3 Associations - Permissions
db.Permission.hasMany(db.RolePermission, { foreignKey: 'permissionId', as: 'rolePermissions' });
db.RolePermission.belongsTo(db.Permission, { foreignKey: 'permissionId', as: 'permission' });
db.RolePermission.belongsTo(db.User, { foreignKey: 'grantedBy', as: 'granter', constraints: false });

db.Permission.hasMany(db.UserPermission, { foreignKey: 'permissionId', as: 'userPermissions' });
db.UserPermission.belongsTo(db.Permission, { foreignKey: 'permissionId', as: 'permission' });
db.User.hasMany(db.UserPermission, { foreignKey: 'userId', as: 'permissions' });
db.UserPermission.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });
db.UserPermission.belongsTo(db.User, { foreignKey: 'grantedBy', as: 'granter', constraints: false });

// V4 Associations - Zone System
db.Event.hasMany(db.Zone, { foreignKey: 'eventId', as: 'zones' });
db.Zone.belongsTo(db.Event, { foreignKey: 'eventId', as: 'event' });

db.Zone.hasMany(db.Assignment, { foreignKey: 'zoneId', as: 'assignments' });
db.Assignment.belongsTo(db.Zone, { foreignKey: 'zoneId', as: 'zone' });

// V5 Associations - Scheduled Backup System
db.ScheduledBackup.belongsTo(db.User, { foreignKey: 'createdBy', as: 'creator' });
db.User.hasMany(db.ScheduledBackup, { foreignKey: 'createdBy', as: 'scheduledBackups' });

module.exports = db;
