// backend/src/middleware/validation.js
const Joi = require('joi');
const multer = require('multer');

/**
 * Generic validation middleware factory
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: errorMessage
      });
    }

    req[property] = value;
    next();
  };
};

/**
 * Schema for KRR file upload
 */
const krrUploadSchema = Joi.object({
  cluster_id: Joi.string().min(1).max(255).required(),
  prometheus_url: Joi.string().uri().allow('').optional(),
  description: Joi.string().max(1000).allow('').optional()
});

/**
 * Schema for patch request
 */
const patchRequestSchema = Joi.object({
  recommendation_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
  strategy: Joi.string().valid('conservative', 'balanced', 'aggressive', 'custom').default('conservative'),
  is_cumulative: Joi.boolean().default(false),
  custom_config: Joi.object().when('strategy', {
    is: 'custom',
    then: Joi.object({
      minReductionPercentage: Joi.number().min(0).max(100),
      maxIncreasePercentage: Joi.number().min(0).max(100),
      preserveLimits: Joi.boolean()
    }).required(),
    otherwise: Joi.forbidden()
  })
});

/**
 * Schema for patch application
 */
const patchApplySchema = Joi.object({
  patches: Joi.array().items(Joi.object({
    recommendation_id: Joi.string().uuid(),
    cluster_id: Joi.string().required(),
    namespace: Joi.string().required(),
    resource_name: Joi.string().required(),
    resource_type: Joi.string().valid('Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob').required(),
    container_name: Joi.string().required(),
    patch_data: Joi.object().required(),
    is_cumulative: Joi.boolean().default(false),
    batch_id: Joi.string().uuid().optional()
  })).min(1).required(),
  dry_run: Joi.boolean().default(false),
  create_backup: Joi.boolean().default(true)
});

/**
 * Schema for query parameters
 */
const queryParamsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(1000).default(50),
  offset: Joi.number().integer().min(0).default(0),
  sort_by: Joi.string().default('created_at'),
  sort_order: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC')
});

/**
 * File upload validation for KRR files
 */
const validateKrrUpload = [
  // Multer file validation
  (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    if (req.file.mimetype !== 'application/json') {
      return res.status(400).json({
        success: false,
        error: 'File must be a JSON file'
      });
    }

    if (req.file.size > 50 * 1024 * 1024) { // 50MB limit
      return res.status(400).json({
        success: false,
        error: 'File size too large (max 50MB)'
      });
    }

    next();
  },
  
  // Body validation
  validate(krrUploadSchema, 'body')
];

/**
 * Validate patch request
 */
const validatePatchRequest = validate(patchRequestSchema, 'body');

/**
 * Validate patch application
 */
const validatePatchApply = validate(patchApplySchema, 'body');

/**
 * Validate query parameters
 */
const validateQueryParams = validate(queryParamsSchema, 'query');

module.exports = {
  validate,
  validateKrrUpload,
  validatePatchRequest,
  validatePatchApply,
  validateQueryParams
};