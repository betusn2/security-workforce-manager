module.exports = (sequelize, DataTypes) => {
  const RolePermission = sequelize.define('RolePermission', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: 'Rôle auquel la permission est attribuée'
    },
    permissionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'permissions',
        key: 'id'
      }
    },
    grantedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Admin qui a accordé cette permission'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'role_permissions',
    timestamps: true,
    indexes: [
      { fields: ['role'] },
      { fields: ['permissionId'] },
      { fields: ['role', 'permissionId'], unique: true }
    ]
  });

  return RolePermission;
};
