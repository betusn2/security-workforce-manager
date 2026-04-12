module.exports = (sequelize, DataTypes) => {
  const Zone = sequelize.define('Zone', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id'
      },
      comment: 'Événement auquel appartient cette zone'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Nom de la zone (ex: Tribune Nord, VIP, Parking)'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description de la zone'
    },
    color: {
      type: DataTypes.STRING(20),
      defaultValue: '#3B82F6',
      comment: 'Couleur pour identification visuelle'
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Capacité maximale de la zone'
    },
    requiredAgents: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: 'Nombre d\'agents requis pour cette zone'
    },
    requiredSupervisors: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Nombre de superviseurs requis pour cette zone'
    },
    supervisors: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Liste des IDs des responsables qui gèrent cette zone (JSON array)'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'medium',
      comment: 'Niveau de priorité de la zone'
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
      defaultValue: 50,
      comment: 'Rayon en mètres pour le geofencing de la zone'
    },
    instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Instructions spécifiques pour cette zone'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Ordre d\'affichage'
    },
    // ── Zone mise en place – confirmation ───────────────────────
    setupConfirmed:   { type: DataTypes.BOOLEAN, defaultValue: false },
    setupConfirmedAt: { type: DataTypes.DATE,    allowNull: true },
    setupConfirmedBy: { type: DataTypes.UUID,    allowNull: true },
  }, {
    tableName: 'zones',
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        fields: ['eventId']
      },
      {
        fields: ['eventId', 'name'],
        unique: true,
        where: {
          deletedAt: null
        }
      }
    ]
  });

  return Zone;
};
