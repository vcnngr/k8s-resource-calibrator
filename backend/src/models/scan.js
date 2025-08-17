module.exports = (sequelize, DataTypes) => {
  const Scan = sequelize.define('Scan', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    cluster_id: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    scan_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    scan_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    scan_status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      defaultValue: 'pending'
    },
    prometheus_url: {
      type: DataTypes.TEXT,
      validate: {
        isUrl: true
      }
    },
    raw_data: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    error_message: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'scans',
    underscored: true,
    indexes: [
      {
        fields: ['cluster_id', 'scan_status']
      },
      {
        fields: ['scan_date']
      }
    ]
  });

  Scan.associate = function(models) {
    Scan.hasMany(models.Recommendation, {
      foreignKey: 'scan_id',
      onDelete: 'CASCADE'
    });
  };

  return Scan;
};