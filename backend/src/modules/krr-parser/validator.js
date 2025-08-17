// backend/src/modules/krr-parser/validator.js
const Joi = require('joi');

// Schema di validazione per l'output KRR basato sulla documentazione Robusta
const krrOutputSchema = Joi.object({
    cluster_id: Joi.string().required(),
    scan_id: Joi.string().required(),
    scan_date: Joi.string().isoDate().required(),
    scan_state: Joi.string().valid('success', 'failed', 'partial').required(),
    results: Joi.array().items(
        Joi.object({
            cluster_id: Joi.string().required(),
            namespace: Joi.string().required(),
            name: Joi.string().required(), // Nome della risorsa
            kind: Joi.string().valid('Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob').required(),
            container: Joi.string().required(),
            priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').required(),
            
            // CPU
            current_cpu_request: Joi.number().integer().min(0).allow(null),
            recommended_cpu_request: Joi.number().integer().min(0).allow(null),
            current_cpu_limit: Joi.number().integer().min(0).allow(null),
            recommended_cpu_limit: Joi.number().integer().min(0).allow(null),
            
            // Memory (in bytes)
            current_memory_request: Joi.number().integer().min(0).allow(null),
            recommended_memory_request: Joi.number().integer().min(0).allow(null),
            current_memory_limit: Joi.number().integer().min(0).allow(null),
            recommended_memory_limit: Joi.number().integer().min(0).allow(null),
            
            // Statistiche
            pods_count: Joi.number().integer().min(1).default(1),
            
            // Metadati opzionali
            labels: Joi.object().pattern(Joi.string(), Joi.string()).default({}),
            annotations: Joi.object().pattern(Joi.string(), Joi.string()).default({}),
            additional_data: Joi.object().default({})
        })
    ).required(),
    
    // Metadati opzionali del scan
    prometheus_url: Joi.string().uri().allow(null),
    strategy: Joi.string().default('simple'),
    duration_seconds: Joi.number().min(0),
    error_message: Joi.string().allow(null)
});

/**
 * Valida l'output JSON di KRR
 */
async function validateKrrOutput(rawJson) {
    try {
        // Parse del JSON se è stringa
        const jsonData = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
        
        // Validazione con Joi
        const { error, value } = krrOutputSchema.validate(jsonData, {
            abortEarly: false,
            allowUnknown: true // Permette campi aggiuntivi
        });
        
        if (error) {
            return {
                valid: false,
                errors: error.details.map(detail => detail.message),
                data: null
            };
        }
        
        return {
            valid: true,
            errors: [],
            data: value
        };
        
    } catch (parseError) {
        return {
            valid: false,
            errors: [`Errore parsing JSON: ${parseError.message}`],
            data: null
        };
    }
}

/**
 * Valida una singola raccomandazione
 */
function validateRecommendation(recommendation) {
    const schema = Joi.object({
        namespace: Joi.string().required(),
        name: Joi.string().required(),
        kind: Joi.string().required(),
        container: Joi.string().required(),
        priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').required(),
        current_cpu_request: Joi.number().integer().min(0).allow(null),
        recommended_cpu_request: Joi.number().integer().min(0).allow(null),
        current_memory_request: Joi.number().integer().min(0).allow(null),
        recommended_memory_request: Joi.number().integer().min(0).allow(null)
    });
    
    return schema.validate(recommendation);
}

module.exports = {
    validateKrrOutput,
    validateRecommendation,
    krrOutputSchema
};