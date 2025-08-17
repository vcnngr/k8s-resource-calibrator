// backend/src/middleware/audit.js
const AuditLogger = require('../config/audit');

/**
 * Audit logging middleware factory
 */
const auditLog = (action, options = {}) => {
  return async (req, res, next) => {
    const startTime = new Date();
    
    // Store original res.json to intercept response
    const originalJson = res.json;
    let responseData = null;
    let success = true;

    res.json = function(data) {
      responseData = data;
      success = data?.success !== false;
      return originalJson.call(this, data);
    };

    // Store original res.status to capture error status codes
    const originalStatus = res.status;
    let statusCode = 200;

    res.status = function(code) {
      statusCode = code;
      if (code >= 400) {
        success = false;
      }
      return originalStatus.call(this, code);
    };

    // Continue to next middleware
    next();

    // Log after response is sent
    res.on('finish', async () => {
      try {
        const endTime = new Date();
        
        await AuditLogger.log(action, {
          resourceType: options.resourceType || req.body?.resource_type,
          resourceId: options.getResourceId ? options.getResourceId(req, res) : req.params.id,
          userId: req.user?.id,
          clusterId: req.body?.cluster_id || req.query?.cluster_id,
          namespace: req.body?.namespace || req.query?.namespace,
          actionData: {
            method: req.method,
            url: req.originalUrl,
            params: req.params,
            query: req.query,
            body: req.body,
            statusCode,
            ...options.additionalData
          },
          success,
          errorMessage: !success ? responseData?.error : null,
          startedAt: startTime,
          completedAt: endTime,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (error) {
        console.error('Failed to log audit entry:', error);
      }
    });
  };
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Add request ID for tracking
  req.id = require('crypto').randomUUID();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logger = require('../config/logger');
    
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    });
  });

  next();
};

module.exports = {
  auditLog,
  requestLogger
};