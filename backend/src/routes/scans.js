// backend/src/routes/scans.js
const express = require('express');
const multer = require('multer');
const { KrrParser } = require('../modules/krr-parser');
const { Scan, Recommendation } = require('../models');
const { validateKrrUpload } = require('../middleware/validation');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });
const fs = require('fs').promises;

/**
 * GET /api/scans - Lista tutte le scansioni
 */
router.get('/', async (req, res) => {
    try {
        const { cluster_id, status, limit = 50, offset = 0 } = req.query;
        
        const whereClause = {};
        if (cluster_id) whereClause.cluster_id = cluster_id;
        if (status) whereClause.scan_status = status;
        
        const scans = await Scan.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['scan_date', 'DESC']],
            include: [
                {
                    model: Recommendation,
                    attributes: ['id', 'priority'],
                    required: false
                }
            ]
        });
        
        res.json({
            success: true,
            data: scans.rows,
            pagination: {
                total: scans.count,
                limit: parseInt(limit),
                offset: parseInt(offset),
                pages: Math.ceil(scans.count / limit)
            }
        });
        
    } catch (error) {
        req.logger.error('Errore recupero scansioni:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server'
        });
    }
});

/**
 * GET /api/scans/:id - Dettagli scansione specifica
 */
router.get('/:id', async (req, res) => {
    try {
        const scan = await Scan.findByPk(req.params.id, {
            include: [
                {
                    model: Recommendation,
                    required: false
                }
            ]
        });
        
        if (!scan) {
            return res.status(404).json({
                success: false,
                error: 'Scansione non trovata'
            });
        }
        
        res.json({
            success: true,
            data: scan
        });
        
    } catch (error) {
        req.logger.error('Errore recupero scansione:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server'
        });
    }
});

/**
 * POST /api/scans/upload - Upload di un nuovo file KRR JSON
 */
router.post('/upload', 
    upload.single('krrFile'),
    validateKrrUpload,
    auditLog('scan_upload'),
    async (req, res) => {
        let uploadedFile = null;
        
        try {
            uploadedFile = req.file.path;
            const { cluster_id, prometheus_url, description } = req.body;
            
            // Legge il file JSON
            const fileContent = await fs.readFile(uploadedFile, 'utf8');
            
            // Parse e validazione
            const krrParser = new KrrParser(req.logger);
            const parsedData = await krrParser.parseKrrOutput(fileContent, {
                uploaded_by: req.user?.id || 'system',
                upload_source: 'web_interface',
                description: description,
                prometheus_url: prometheus_url
            });
            
            // Salva nel database con transazione
            const result = await req.db.transaction(async (t) => {
                // Crea record scansione
                const scan = await Scan.create({
                    ...parsedData.scan,
                    cluster_id: cluster_id || parsedData.scan.cluster_id
                }, { transaction: t });
                
                // Crea raccomandazioni
                const recommendations = await Promise.all(
                    parsedData.recommendations.map(rec => 
                        Recommendation.create({
                            ...rec,
                            scan_id: scan.id
                        }, { transaction: t })
                    )
                );
                
                return { scan, recommendations };
            });
            
            req.logger.info(`Scansione ${result.scan.scan_id} caricata con successo: ${result.recommendations.length} raccomandazioni`);
            
            res.status(201).json({
                success: true,
                data: {
                    scan: result.scan,
                    recommendations_count: result.recommendations.length,
                    summary: parsedData.summary
                }
            });
            
        } catch (error) {
            req.logger.error('Errore upload scansione:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        } finally {
            // Cleanup del file temporaneo
            if (uploadedFile) {
                try {
                    await fs.unlink(uploadedFile);
                } catch (cleanupError) {
                    req.logger.warn('Errore cleanup file:', cleanupError);
                }
            }
        }
    }
);

/**
 * DELETE /api/scans/:id - Elimina scansione e raccomandazioni correlate
 */
router.delete('/:id', auditLog('scan_delete'), async (req, res) => {
    try {
        const scan = await Scan.findByPk(req.params.id);
        
        if (!scan) {
            return res.status(404).json({
                success: false,
                error: 'Scansione non trovata'
            });
        }
        
        await scan.destroy();
        
        req.logger.info(`Scansione ${scan.scan_id} eliminata`);
        
        res.json({
            success: true,
            message: 'Scansione eliminata con successo'
        });
        
    } catch (error) {
        req.logger.error('Errore eliminazione scansione:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server'
        });
    }
});

/**
 * GET /api/scans/:id/summary - Riassunto statistiche scansione
 */
router.get('/:id/summary', async (req, res) => {
    try {
        const scan = await Scan.findByPk(req.params.id);
        
        if (!scan) {
            return res.status(404).json({
                success: false,
                error: 'Scansione non trovata'
            });
        }
        
        const recommendations = await Recommendation.findAll({
            where: { scan_id: req.params.id }
        });
        
        const summary = {
            scan_info: {
                scan_id: scan.scan_id,
                cluster_id: scan.cluster_id,
                scan_date: scan.scan_date,
                total_recommendations: recommendations.length
            },
            by_priority: {},
            by_namespace: {},
            by_resource_type: {},
            potential_savings: {
                total_cpu_millicores: 0,
                total_memory_bytes: 0,
                containers_affected: recommendations.length
            }
        };
        
        recommendations.forEach(rec => {
            // Conteggi per priorità
            summary.by_priority[rec.priority] = (summary.by_priority[rec.priority] || 0) + 1;
            
            // Conteggi per namespace
            summary.by_namespace[rec.namespace] = (summary.by_namespace[rec.namespace] || 0) + 1;
            
            // Conteggi per tipo risorsa
            summary.by_resource_type[rec.resource_type] = (summary.by_resource_type[rec.resource_type] || 0) + 1;
            
            // Calcolo risparmi
            if (rec.current_cpu_request && rec.recommended_cpu_request) {
                summary.potential_savings.total_cpu_millicores += Math.max(0, 
                    rec.current_cpu_request - rec.recommended_cpu_request
                );
            }
            
            if (rec.current_memory_request && rec.recommended_memory_request) {
                summary.potential_savings.total_memory_bytes += Math.max(0,
                    rec.current_memory_request - rec.recommended_memory_request
                );
            }
        });
        
        res.json({
            success: true,
            data: summary
        });
        
    } catch (error) {
        req.logger.error('Errore generazione summary:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server'
        });
    }
});

module.exports = router;