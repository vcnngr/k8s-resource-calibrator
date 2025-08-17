const { AuditLog } = require('../models');
const Logger = require('./logger');

class AuditLogger {
  constructor() {
    this.logger = Logger.child({ component: 'audit' });
  }

  /**
   * Log an audit event
   */
  async log(action, {
    resourceType = null,
    resourceId = null,
    userId = null,
    clusterId = null,
    namespace = null,
    actionData = {},
    success = true,
    errorMessage = null,
    startedAt = new Date(),
    completedAt = new Date(),
    ipAddress = null,
    userAgent = null
  }) {
    try {
      const durationMs = completedAt.getTime() - startedAt.getTime();
      
      const auditEntry = await AuditLog.create({
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        user_id: userId,
        cluster_id: clusterId,
        namespace,
        action_data: actionData,
        success,
        error_message: errorMessage,
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: durationMs,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      this.logger.info(`Audit log created: ${action}`, {
        auditId: auditEntry.id,
        success,
        duration: durationMs
      });

      return auditEntry;
      
    } catch (error) {
      this.logger.error('Failed to create audit log:', error);
      throw error;
    }
  }

  /**
   * Log scan upload
   */
  async logScanUpload(scanId, clusterId, userId, success, error = null, metadata = {}) {
    return this.log('scan_upload', {
      resourceType: 'scan',
      resourceId: scanId,
      userId,
      clusterId,
      actionData: metadata,
      success,
      errorMessage: error?.message
    });
  }

  /**
   * Log patch generation
   */
  async logPatchGeneration(recommendationIds, strategy, userId, success, error = null) {
    return this.log('patch_generate', {
      resourceType: 'patch',
      userId,
      actionData: {
        recommendation_ids: recommendationIds,
        strategy,
        count: recommendationIds.length
      },
      success,
      errorMessage: error?.message
    });
  }

  /**
   * Log patch application
   */
  async logPatchApplication(patchId, clusterId, namespace, userId, success, error = null, metadata = {}) {
    return this.log('patch_apply', {
      resourceType: 'patch',
      resourceId: patchId,
      userId,
      clusterId,
      namespace,
      actionData: metadata,
      success,
      errorMessage: error?.message
    });
  }

  /**
   * Log rollback
   */
  async logRollback(patchId, clusterId, namespace, userId, success, error = null, metadata = {}) {
    return this.log('patch_rollback', {
      resourceType: 'patch',
      resourceId: patchId,
      userId,
      clusterId,
      namespace,
      actionData: metadata,
      success,
      errorMessage: error?.message
    });
  }

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(filters = {}) {
    const {
      action,
      resourceType,
      userId,
      clusterId,
      success,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = filters;

    const where = {};
    
    if (action) where.action = action;
    if (resourceType) where.resource_type = resourceType;
    if (userId) where.user_id = userId;
    if (clusterId) where.cluster_id = clusterId;
    if (success !== undefined) where.success = success;
    
    if (startDate && endDate) {
      where.created_at = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      where.created_at = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      where.created_at = {
        [Op.lte]: endDate
      };
    }

    return AuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
  }
}

module.exports = new AuditLogger();