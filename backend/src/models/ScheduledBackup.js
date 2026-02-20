const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ScheduledBackup = sequelize.define('ScheduledBackup', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    intervalDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 7, // 7 jours par défaut
      validate: {
        min: 1,
        max: 365
      }
    },
    backupType: {
      type: DataTypes.ENUM('full', 'structure'),
      defaultValue: 'full',
      allowNull: false
    },
    retentionCount: {
      type: DataTypes.INTEGER,
      defaultValue: 3, // Garder les 3 dernières sauvegardes
      allowNull: false,
      validate: {
        min: 1,
        max: 100
      }
    },
    lastRunAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    nextRunAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'scheduled_backups',
    timestamps: true,
    underscored: true,
    paranoid: true,
    indexes: [
      {
        fields: ['enabled']
      },
      {
        fields: ['nextRunAt']
      }
    ]
  });

  ScheduledBackup.associate = (models) => {
    ScheduledBackup.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'creator'
    });
  };

  return ScheduledBackup;
};
