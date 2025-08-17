// backend/src/routes/health.js
const express = require('express');
const { asyncHandler
} = require('../middleware/error');

const router = express.Router();

/**
 * GET /api/health - Basic health check
 */
router.get('/', asyncHandler(async (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  };

  res.status(200).json(healthCheck);
}));

/**
 * GET /api/health/detailed - Detailed health check with dependencies
 */
router.get('/detailed', asyncHandler(async (req, res) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // Database health check
  try {
    await req.db.authenticate();
    checks.checks.database = {
      status: 'healthy',
      message: 'Database connection successful'
    };
  } catch (error) {
    checks.status = 'unhealthy';
    checks.checks.database = {
      status: 'unhealthy',
      message: error.message
    };
  }
  // Kubernetes health check
  try {
    const k8sStatus = await req.k8sConfig.testConnection();
    checks.checks.kubernetes = {
      status: k8sStatus.connected ? 'healthy' : 'unhealthy',
      message: k8sStatus.connected ? 
        `Connected to cluster: ${k8sStatus.cluster
      }` : 
        k8sStatus.error,
      cluster: k8sStatus.cluster,
      namespaces: k8sStatus.namespaces
    };
    
    if (!k8sStatus.connected) {
      checks.status = 'degraded';
    }
  } catch (error) {
    checks.status = 'degraded';
    checks.checks.kubernetes = {
      status: 'unhealthy',
      message: error.message
    };
  }
  // Memory usage check
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    external: Math.round(memoryUsage.external / 1024 / 1024)
  };

  checks.checks.memory = {
    status: memoryUsageMB.heapUsed < 1000 ? 'healthy' : 'warning',
    usage: memoryUsageMB,
    message: `Heap used: ${memoryUsageMB.heapUsed
    }MB`
  };

  // Determine overall status
  const statusCode = checks.status === 'healthy' ? 200 : 
                    checks.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(checks);
}));

/**
 * GET /api/health/readiness - Kubernetes readiness probe
 */
router.get('/readiness', asyncHandler(async (req, res) => {
  try {
    // Check database connection
    await req.db.authenticate();
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/health/liveness - Kubernetes liveness probe
 */
router.get('/liveness', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;