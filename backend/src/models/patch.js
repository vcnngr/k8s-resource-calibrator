module.exports = (sequelize, DataTypes) => {
  const Patch = sequelize.define('Patch', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    recommendation_id: {
      type: DataTypes.UUID,
      references: {
        model: 'recommendations',
        key: 'id'
      }
    },
    backup_id: {
      type: DataTypes.UUID,
      references: {
        model: 'resource_backups',
        key: 'id'
      }
    },
    
    // Resource identification
    cluster_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    namespace: {
      type: DataTypes.STRING,
      allowNull: false
    },
    resource_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    resource_type: {
      type: DataTypes.ENUM('Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'),
      allowNull: false
    },
    container_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    
    // Patch data
    patch_data: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'applied', 'failed', 'rolled_back'),
      defaultValue: 'pending'
    },
    is_cumulative: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    batch_id: DataTypes.UUID,
    
    // Tracking
    applied_at: DataTypes.DATE,
    applied_by: DataTypes.STRING,
    rollback_data: DataTypes.JSONB,
    
    // Results
    success: DataTypes.BOOLEAN,
    error_message: DataTypes.TEXT,
    k8s_response: DataTypes.JSONB
  }, {
    tableName: 'patches',
    underscored: true,
    indexes: [
      {
        fields: ['status']
      },
      {
        fields: ['cluster_id', 'namespace', 'resource_name']
      },
      {
        fields: ['batch_id']
      }
    ]
  });

  Patch.associate = function(models) {
    Patch.belongsTo(models.Recommendation, {
      foreignKey: 'recommendation_id'
    });
    
    Patch.belongsTo(models.ResourceBackup, {
      foreignKey: 'backup_id'
    });
  };

  return Patch;
};