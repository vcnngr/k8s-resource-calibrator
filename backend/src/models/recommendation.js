module.exports = (sequelize, DataTypes) => {
  const Recommendation = sequelize.define('Recommendation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    scan_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'scans',
        key: 'id'
      }
    },
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
    priority: {
      type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
      allowNull: false
    },
    
    // CPU values in millicores
    current_cpu_request: DataTypes.INTEGER,
    recommended_cpu_request: DataTypes.INTEGER,
    current_cpu_limit: DataTypes.INTEGER,
    recommended_cpu_limit: DataTypes.INTEGER,
    
    // Memory values in bytes
    current_memory_request: DataTypes.BIGINT,
    recommended_memory_request: DataTypes.BIGINT,
    current_memory_limit: DataTypes.BIGINT,
    recommended_memory_limit: DataTypes.BIGINT,
    
    // Statistics
    pods_count: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    cpu_savings_percentage: DataTypes.DECIMAL(5, 2),
    memory_savings_percentage: DataTypes.DECIMAL(5, 2),
    estimated_cost_savings: DataTypes.DECIMAL(10, 2),
    
    // Metadata
    labels: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    annotations: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    additional_data: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'recommendations',
    underscored: true,
    indexes: [
      {
        fields: ['cluster_id', 'namespace']
      },
      {
        fields: ['priority']
      },
      {
        fields: ['scan_id']
      },
      {
        unique: true,
        fields: ['scan_id', 'namespace', 'resource_name', 'container_name']
      }
    ],
    hooks: {
      beforeSave: (recommendation) => {
        // Calculate savings percentages
        if (recommendation.current_cpu_request && recommendation.recommended_cpu_request) {
          const savings = recommendation.current_cpu_request - recommendation.recommended_cpu_request;
          recommendation.cpu_savings_percentage = (savings / recommendation.current_cpu_request) * 100;
        }
        
        if (recommendation.current_memory_request && recommendation.recommended_memory_request) {
          const savings = recommendation.current_memory_request - recommendation.recommended_memory_request;
          recommendation.memory_savings_percentage = (savings / recommendation.current_memory_request) * 100;
        }
      }
    }
  });

  Recommendation.associate = function(models) {
    Recommendation.belongsTo(models.Scan, {
      foreignKey: 'scan_id'
    });
    
    Recommendation.hasMany(models.Patch, {
      foreignKey: 'recommendation_id',
      onDelete: 'CASCADE'
    });
  };

  return Recommendation;
};
