// backend/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Import configurations
const Logger = require('./config/logger');
const sequelize = require('./config/database');
const k8sConfig = require('./config/kubernetes');
const AuditLogger = require('./config/audit');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/error');
const { requestLogger } = require('./middleware/audit');
const { optionalAuth } = require('./middleware/auth');

// Import routes
const scansRoutes = require('./routes/scans');
const recommendationsRoutes = require('./routes/recommendations');
const patchesRoutes = require('./routes/patches');
const healthRoutes = require('./routes/health');

// Import models to ensure they're loaded
const models = require('./models');

class App {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    this.logger = Logger.child({ component: 'app' });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    const corsOptions = {
      origin: process.env.CORS_ORIGIN ? 
        process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : 
        ['http://localhost:3000'],
      credentials: true,
      optionsSuccessStatus: 200
    };
    this.app.use(cors(corsOptions));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'development' ? 1000 : 100, // limit each IP
      message: {
        success: false,
        error: 'Too many requests from this IP, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression
    this.app.use(compression());

    // Request logging
    this.app.use(requestLogger);

    // Add logger and database to request object
    this.app.use((req, res, next) => {
      req.logger = this.logger;
      req.db = sequelize;
      req.auditLogger = AuditLogger;
      req.k8sConfig = k8sConfig;
      next();
    });

    // Optional authentication for all routes
    this.app.use(optionalAuth);

    this.logger.info('✅ Middleware setup completed');
  }

  setupRoutes() {
    // Health check route (no auth required)
    this.app.use('/api/health', healthRoutes);

    // API routes
    this.app.use('/api/scans', scansRoutes);
    this.app.use('/api/recommendations', recommendationsRoutes);
    this.app.use('/api/patches', patchesRoutes);

    // API documentation route
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'KRR Management System API',
        version: '1.0.0',
        description: 'API for managing Kubernetes Resource Recommendations',
        endpoints: {
          health: 'GET /api/health',
          scans: 'GET /api/scans',
          upload: 'POST /api/scans/upload',
          recommendations: 'GET /api/recommendations',
          patches: 'GET /api/patches',
          generate_patches: 'POST /api/patches/generate',
          apply_patches: 'POST /api/patches/apply'
        },
        documentation: '/api/docs'
      });
    });

    // Serve static files in production
    if (process.env.NODE_ENV === 'production') {
      const path = require('path');
      this.app.use(express.static(path.join(__dirname, '../../frontend/build')));
      
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
      });
    }

    this.logger.info('✅ Routes setup completed');
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);

    this.logger.info('✅ Error handling setup completed');
  }

  async initializeDatabase() {
    try {
      this.logger.info('🔄 Initializing database connection...');
      
      // Test database connection
      await sequelize.authenticate();
      this.logger.info('✅ Database connection established');

      // NON fare sync automatico in nessun ambiente
      // Lo schema è gestito tramite database/init.sql
      this.logger.info('📊 Using existing database schema (managed via init.sql)');

    } catch (error) {
      this.logger.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async testKubernetesConnection() {
    try {
      this.logger.info('🔄 Testing Kubernetes connection...');
      
      const connectionStatus = await k8sConfig.testConnection();
      
      if (connectionStatus.connected) {
        this.logger.info('✅ Kubernetes connection successful', {
          cluster: connectionStatus.cluster,
          namespaces: connectionStatus.namespaces
        });
      } else {
        this.logger.warn('⚠️  Kubernetes connection failed:', connectionStatus.error);
        this.logger.warn('📝 Some features may not be available');
      }

      return connectionStatus;
    } catch (error) {
      this.logger.error('❌ Kubernetes connection test failed:', error);
      return { connected: false, error: error.message };
    }
  }

  async start() {
    try {
      this.logger.info('🚀 Starting KRR Management System...');

      // Initialize database
      await this.initializeDatabase();

      // Test Kubernetes connection
      await this.testKubernetesConnection();

      // Start server
      const server = this.app.listen(this.port, () => {
        this.logger.info(`🎉 Server running on port ${this.port}`, {
          environment: process.env.NODE_ENV || 'development',
          port: this.port
        });
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown(server);

      return server;
    } catch (error) {
      this.logger.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  setupGracefulShutdown(server) {
    const shutdown = async (signal) => {
      this.logger.info(`📡 Received ${signal}, shutting down gracefully...`);
      
      // Close server
      server.close(async () => {
        this.logger.info('📴 HTTP server closed');
        
        try {
          // Close database connections
          await sequelize.close();
          this.logger.info('📴 Database connections closed');
          
          this.logger.info('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          this.logger.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        this.logger.error('⏰ Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Export for testing
module.exports = App;

// Start server if this file is run directly
if (require.main === module) {
  const app = new App();
  app.start();
}