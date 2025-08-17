module.exports = (sequelize, DataTypes) => {
  const ResourceBackup = sequelize.define('ResourceBackup', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
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
    backup_data: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    checksum: {
      type: DataTypes.STRING(64),
      allowNull: false
    }
  }, {
    tableName: 'resource_backups',
    underscored: true,
    indexes: [
      {
        fields: ['cluster_id', 'namespace', 'resource_name']
      },
      {
        unique: true,
        fields: ['cluster_id', 'namespace', 'resource_name', 'resource_type', 'created_at']
      }
    ]
  });

  ResourceBackup.associate = function(models) {
    ResourceBackup.hasMany(models.Patch, {
      foreignKey: 'backup_id'
    });
  };

  return ResourceBackup;
};