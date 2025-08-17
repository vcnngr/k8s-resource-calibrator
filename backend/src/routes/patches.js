// backend/src/routes/patches.js
const express = require('express');
const { PatchGenerator } = require('../modules/patch-generator');
const { K8sManager } = require('../modules/k8s-manager');
const { Patch, Recommendation, ResourceBackup } = require('../models');
const { validatePatchRequest } = require('../middleware/validation');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

/**
 * GET /api/patches - Lista patch con filtri
 */
router.get('/', async (req, res) => {
    try {
        const {
            cluster_id,
            namespace,
            status,
            batch_id,
            limit = 50,
            offset = 0
        } = req.query;
        
        const whereClause = {};
        if (cluster_id) whereClause.cluster_id = cluster_id;
        if (namespace) whereClause.namespace = namespace;
        if (status) whereClause.status = status;
        if (batch_id) whereClause.batch_id = batch_id;
        
        const patches = await Patch.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']],
            include: [
                {
                    model: Recommendation,
                    attributes: ['id', 'priority', 'cpu_savings_percentage', 'memory_savings_percentage']
                },
                {
                    model: ResourceBackup,
                    attributes: ['id', 'created_at', 'checksum']
                }
            ]
        });
        
        res.json({
            success: true,
            data: patches.rows,
            pagination: {
                total: patches.count,
                limit: parseInt(limit),
                offset: parseInt(offset),
                pages: Math.ceil(patches.count / limit)
            }
        });
        
    } catch (error) {
        req.logger.error('Errore recupero patch:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server'
        });
    }
});

/**
 * POST /api/patches/generate - Genera patch per raccomandazioni
 */
router.post('/generate', 
    validatePatchRequest,
    auditLog('patch_generate'),
    async (req, res) => {
        try {
            const { recommendation_ids, strategy = 'conservative', is_cumulative = false } = req.body;
            
            // Recupera raccomandazioni
            const recommendations = await Recommendation.findAll({
                where: { id: recommendation_ids }
            });
            
            if (recommendations.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Nessuna raccomandazione trovata'
                });
            }
            
            const patchGenerator = new PatchGenerator(req.logger);
            let result;
            
            if (is_cumulative) {
                result = await patchGenerator.generateCumulativePatches(recommendations, strategy);
            } else {
                // Genera patch singole
                const patches = await Promise.all(
                    recommendations.map(rec => patchGenerator.generateSinglePatch(rec, strategy))
                );
                result = { patches, strategy };
            }
            
            req.logger.info(`Generate ${result.patches.length} patch con strategia ${strategy}`);
            
            res.json({
                success: true,
                data: result
            });
            
        } catch (error) {
            req.logger.error('Errore generazione patch:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * POST /api/patches/apply - Applica patch generate
 */
router.post('/apply',
    auditLog('patch_apply'),
    async (req, res) => {
        try {
            const { patches, dry_run = false, create_backup = true } = req.body;
            
            const k8sManager = new K8sManager(req.logger, req.auditLogger);
            const results = [];
            
            // Verifica connessione K8s
            const healthCheck = await k8sManager.healthCheck();
            if (!healthCheck.connected) {
                return res.status(503).json({
                    success: false,
                    error: 'Cluster Kubernetes non raggiungibile',
                    details: healthCheck.error
                });
            }
            
            for (const patchData of patches) {
                try {
                    let backupId = null;
                    
                    // Crea backup se richiesto e non è dry run
                    if (create_backup && !dry_run) {
                        const backup = await k8sManager.createBackup(
                            patchData.namespace,
                            patchData.resource_name,
                            patchData.resource_type
                        );
                        
                        const backupRecord = await ResourceBackup.create(backup);
                        backupId = backupRecord.id;
                    }
                    
                    // Applica patch
                    const applyResult = await k8sManager.applyPatch(patchData, dry_run);
                    
                    // Salva risultato nel database se non è dry run
                    if (!dry_run) {
                        await Patch.create({
                            recommendation_id: patchData.recommendation_id,
                            backup_id: backupId,
                            cluster_id: patchData.cluster_id,
                            namespace: patchData.namespace,
                            resource_name: patchData.resource_name,
                            resource_type: patchData.resource_type,
                            container_name: patchData.container_name,
                            patch_data: patchData.patch_data,
                            status: applyResult.success ? 'applied' : 'failed',
                            is_cumulative: patchData.is_cumulative || false,
                            batch_id: patchData.batch_id || null,
                            applied_at: applyResult.applied_at,
                            applied_by: req.user?.id || 'system',
                            success: applyResult.success,
                            error_message: applyResult.error_message,
                            k8s_response: applyResult.k8s_response
                        });
                    }
                    
                    results.push({
                        patch_id: patchData.id || `temp-${results.length}`,
                        ...applyResult
                    });
                    
                } catch (patchError) {
                    results.push({
                        patch_id: patchData.id || `temp-${results.length}`,
                        success: false,
                        error_message: patchError.message,
                        applied_at: new Date(),
                        dry_run: dry_run
                    });
                }
            }
            
            const successCount = results.filter(r => r.success).length;
            const totalCount = results.length;
            
            req.logger.info(`Applicazione patch completata: ${successCount}/${totalCount} successi`);
            
            res.json({
                success: successCount === totalCount,
                data: {
                    total_patches: totalCount,
                    successful_patches: successCount,
                    failed_patches: totalCount - successCount,
                    results: results,
                    dry_run: dry_run
                }
            });
            
        } catch (error) {
            req.logger.error('Errore applicazione patch:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * POST /api/patches/:id/rollback - Rollback di una patch specifica
 */
router.post('/:id/rollback',
    auditLog('patch_rollback'),
    async (req, res) => {
        try {
            const patch = await Patch.findByPk(req.params.id, {
                include: [
                    {
                        model: ResourceBackup,
                        required: true
                    }
                ]
            });
            
            if (!patch) {
                return res.status(404).json({
                    success: false,
                    error: 'Patch non trovata'
                });
            }
            
            if (patch.status !== 'applied') {
                return res.status(400).json({
                    success: false,
                    error: 'Solo patch applicate possono essere annullate'
                });
            }
            
            const k8sManager = new K8sManager(req.logger, req.auditLogger);
            const result = await k8sManager.rollbackPatch(patch.id, patch.ResourceBackup);
            
            // Aggiorna stato patch
            await patch.update({
                status: result.success ? 'rolled_back' : 'failed',
                rollback_data: result,
                error_message: result.error_message
            });
            
            req.logger.info(`Rollback patch ${patch.id}: ${result.success ? 'successo' : 'fallito'}`);
            
            res.json({
                success: result.success,
                data: result
            });
            
        } catch (error) {
            req.logger.error('Errore rollback patch:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * GET /api/patches/strategies - Lista strategie disponibili
 */
router.get('/strategies', (req, res) => {
    const { getAvailableStrategies } = require('../modules/patch-generator/strategies');
    
    res.json({
        success: true,
        data: getAvailableStrategies()
    });
});

module.exports = router;