const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// Import models
const Scan = require('./scan')(sequelize, DataTypes);
const Recommendation = require('./recommendation')(sequelize, DataTypes);
const Patch = require('./patch')(sequelize, DataTypes);
const ResourceBackup = require('./backup')(sequelize, DataTypes);
const AuditLog = require('./auditLog')(sequelize, DataTypes);

// Define associations
const models = {
  Scan,
  Recommendation,
  Patch,
  ResourceBackup,
  AuditLog
};

// Setup associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = require('sequelize');

module.exports = models;