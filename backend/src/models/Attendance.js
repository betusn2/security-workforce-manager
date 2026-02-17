module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define('Attendance', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    agentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id'
      }
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    checkInTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    checkOutTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    checkInLatitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    checkInLongitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    checkOutLatitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    checkOutLongitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    checkInPhoto: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      comment: 'Base64 or URL of check-in photo - LONGTEXT'
    },
    checkOutPhoto: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      comment: 'Base64 or URL of check-out photo - LONGTEXT'
    },
    checkInMethod: {
      type: DataTypes.ENUM('facial', 'manual', 'qrcode'),
      defaultValue: 'facial'
    },
    checkOutMethod: {
      type: DataTypes.ENUM('facial', 'manual', 'qrcode'),
      allowNull: true
    },
    checkInDeviceName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Nom de l\'appareil lors du check-in'
    },
    checkInDeviceIP: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'Adresse IP lors du check-in'
    },
    checkInDeviceMAC: {
      type: DataTypes.STRING(17),
      allowNull: true,
      comment: 'Adresse MAC lors du check-in'
    },
    checkedInBy: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      comment: 'Admin/Supervisor who performed the check-in on behalf of the agent'
    },
    checkOutDeviceName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Nom de l\'appareil lors du check-out'
    },
    checkOutDeviceIP: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'Adresse IP lors du check-out'
    },
    checkOutDeviceMAC: {
      type: DataTypes.STRING(17),
      allowNull: true,
      comment: 'Adresse MAC lors du check-out'
    },
    facialMatchScore: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
      comment: 'Confidence score from facial recognition (0-1)'
    },
    facialVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether facial verification was successful'
    },
    facialVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp of facial verification'
    },
    status: {
      type: DataTypes.ENUM('present', 'late', 'absent', 'excused', 'early_departure'),
      defaultValue: 'present'
    },
    isWithinGeofence: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    distanceFromLocation: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Distance in meters from event location'
    },
    totalHours: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Total hours worked'
    },
    overtimeHours: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    verifiedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'attendance',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['agentId', 'eventId', 'date']
      },
      {
        fields: ['date']
      },
      {
        fields: ['status']
      }
    ],
    hooks: {
      beforeSave: (attendance) => {
        // Calculate total hours if both check-in and check-out are present
        if (attendance.checkInTime && attendance.checkOutTime) {
          const checkIn = new Date(attendance.checkInTime);
          const checkOut = new Date(attendance.checkOutTime);
          const hours = (checkOut - checkIn) / (1000 * 60 * 60);
          attendance.totalHours = Math.round(hours * 100) / 100;
        }
      }
    }
  });

  return Attendance;
};
