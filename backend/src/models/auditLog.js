module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    resource_type: DataTypes.STRING(50),
    resource_id: DataTypes.UUID,
    user_id: DataTypes.STRING,
    cluster_id: DataTypes.STRING,
    namespace: DataTypes.STRING,
    
    // Action data
    action_data: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    error_message: DataTypes.TEXT,
    
    // Timing
    started_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    completed_at: DataTypes.DATE,
    duration_ms: DataTypes.INTEGER,
    
    // Context
    ip_address: DataTypes.INET,
    user_agent: DataTypes.TEXT
  }, {
    tableName: 'audit_logs',
    underscored: true,
    indexes: [
      {
        fields: ['action', 'created_at']
      },
      {
        fields: ['resource_type', 'resource_id']
      }
    ]
  });

  return AuditLog;
};