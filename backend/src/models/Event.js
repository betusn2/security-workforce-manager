module.exports = (sequelize, DataTypes) => {
  const Event = sequelize.define('Event', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('regular', 'special', 'emergency'),
      defaultValue: 'regular'
    },
    location: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    geoRadius: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
      comment: 'Radius in meters for geofencing'
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    checkInTime: {
      type: DataTypes.TIME,
      allowNull: false
    },
    checkOutTime: {
      type: DataTypes.TIME,
      allowNull: false
    },
    lateThreshold: {
      type: DataTypes.INTEGER,
      defaultValue: 15,
      comment: 'Minutes after check-in time to be marked late'
    },
    agentCreationBuffer: {
      type: DataTypes.INTEGER,
      defaultValue: 120,
      comment: 'Minutes before event start when agent creation is allowed (30, 60, 90, or 120)'
    },
    requiredAgents: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    status: {
      type: DataTypes.ENUM('draft', 'scheduled', 'active', 'completed', 'cancelled'),
      defaultValue: 'draft'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'medium'
    },
    color: {
      type: DataTypes.STRING(7),
      defaultValue: '#3B82F6',
      comment: 'Couleur de l\'événement (hex)'
    },
    recurrenceType: {
      type: DataTypes.ENUM('none', 'daily', 'weekly', 'biweekly', 'monthly'),
      defaultValue: 'none'
    },
    recurrenceEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date de fin de la récurrence'
    },
    contactName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Nom du contact sur site'
    },
    contactPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Téléphone du contact sur site'
    },
    recurrence: {
      type: DataTypes.JSON,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    supervisorId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Responsable/Superviseur principal de l\'événement',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    // ── Phase 1 : Préparation ──────────────────────────────────────────────
    preparationStartDate: { type: DataTypes.DATEONLY, allowNull: true },
    preparationEndDate:   { type: DataTypes.DATEONLY, allowNull: true },
    preparationStartTime: { type: DataTypes.TIME,     allowNull: true },
    preparationEndTime:   { type: DataTypes.TIME,     allowNull: true },
    preparationTolerance: { type: DataTypes.INTEGER,  defaultValue: 15 },
    preparationAgentsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    preparationResponsableId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    preparationObservations: { type: DataTypes.TEXT, allowNull: true },

    // ── Phase 2 : Mise en place ───────────────────────────────────────────
    setupStartDate: { type: DataTypes.DATEONLY, allowNull: true },
    setupEndDate:   { type: DataTypes.DATEONLY, allowNull: true },
    setupStartTime: { type: DataTypes.TIME,     allowNull: true },
    setupEndTime:   { type: DataTypes.TIME,     allowNull: true },
    setupTolerance: { type: DataTypes.INTEGER,  defaultValue: 15 },
    setupAgentsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    setupResponsableId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    setupObservations: { type: DataTypes.TEXT, allowNull: true },

    // ── Agent creation buffer – unit ─────────────────────────────────────
    agentCreationUnit: {
      type: DataTypes.ENUM('minutes', 'hours', 'days', 'weeks'),
      defaultValue: 'hours',
      comment: 'Unit for agentCreationBuffer (minutes/hours/days/weeks)'
    }
  }, {
    tableName: 'events',
    timestamps: true,
    paranoid: true,
    hooks: {
      // Hook avant sauvegarde pour calculer automatiquement le statut
      beforeSave: async (event, options) => {
        try {
          // Ne pas modifier les événements annulés ou terminés manuellement
          if (!['cancelled', 'terminated'].includes(event.status)) {
            // Ne calculer que si les dates sont disponibles
            if (event.startDate && event.endDate && event.checkInTime && event.checkOutTime) {
              const { computeEventStatus } = require('../utils/eventHelpers');
              const computedStatus = computeEventStatus(event);
              
              // Mettre à jour le statut si différent et valide
              if (computedStatus && computedStatus !== event.status) {
                event.status = computedStatus;
              }
            }
          }
        } catch (hookError) {
          // Ne pas faire planter la création/mise à jour si le hook échoue
          console.warn('⚠️ beforeSave hook error (ignoré):', hookError.message);
        }
      }
    }
  });

  return Event;
};
