// backend/src/routes/recommendations.js
const express = require('express');
const { Recommendation, Scan, Patch } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

/**
 * GET /api/recommendations - Lista raccomandazioni con filtri
 */
router.get('/', async (req, res) => {
    try {
        const {
            cluster_id,
            namespace,
            priority,
            resource_type,
            scan_id,
            limit = 50,
            offset = 0,
            sort_by = 'created_at',
            sort_order = 'DESC'
        } = req.query;
        
        const whereClause = {};
        if (cluster_id) whereClause.cluster_id = cluster_id;
        if (namespace) whereClause.namespace = namespace;
        if (priority) whereClause.priority = priority;
        if (resource_type) whereClause.resource_type = resource_type;
        if (scan_id) whereClause.scan_id = scan_id;
        
        const recommendations = await Recommendation.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [[sort_by, sort_order.toUpperCase()]],
            include: [
                {
                    model: Scan,
                    attributes: ['scan_id', 'cluster_id', 'scan_date', 'scan_status']
                },
                {
                    model: Patch,
                    attributes: ['id', 'status', 'applied_at'],
                    required: false
                }
            ]
        });
        
        res.json({
            success: true,
            data: recommendations.rows,
            pagination: {
                total: recommendations.count,
                limit: parseInt(limit),
                offset: parseInt(offset),
                pages: Math.ceil(recommendations.count / limit)
            }
        });
        
    } catch (error) {
        req.logger.error('Errore recupero raccomandazioni:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server'
        });
    }
});

/**
 * GET /api/recommendations/:id - Dettagli raccomandazione specifica
 */
router.get('/:id', async (req, res) => {
    try {
        const recommendation = await Recommendation.findByPk(req.params.id, {
            include: [
                {
                    model: Scan,
                    attributes: ['scan_id', 'cluster_id', 'scan_date', 'scan_status', 'prometheus_url']
                },
                {
                    model: Patch,
                    required: false
                }
            ]
        });
        
        if (!recommendation) {
            return res.status(404).json({
                success: false,
                error: 'Raccomandazione non trovata'
            });
        }
        
        // Calcola statistiche aggiuntive
        const stats = {
            cpu_reduction_percentage: recommendation.cpu_savings_percentage || 0,
            memory_reduction_percentage: recommendation.memory_savings_percentage || 0,
            is_significant: (recommendation.cpu_savings_percentage > 20 || recommendation.memory_savings_percentage > 20),
            has_patch: recommendation.Patches && recommendation.Patches.length > 0
        };
        
        res.json({
            success: true,
            data: {
                ...recommendation.toJSON(),
                stats
            }
        });
        
    } catch (error) {
        req.logger.error('Errore recupero raccomandazione:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server'
        });
    }
});

/**
 * GET /api/recommendations/stats/overview - Statistiche generali raccomandazioni
 */
router.get('/stats/overview', async (req, res) => {
    try {
        const { cluster_id, namespace, days = 30 } = req.query;
        
        const dateFilter = {
            created_at: {
                [Op.gte]: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            }
        };
        
        const whereClause = { ...dateFilter };
        if (cluster_id) whereClause.cluster_id = cluster_id;
        if (namespace) whereClause.namespace = namespace;
        
        const stats = await Promise.all([
            // Conteggi totali
            Recommendation.count({ where: whereClause }),
            
            // Per priorità
            Recommendation.findAll({
                where: whereClause,
                attributes: [
                    'priority',
                    [req.db.fn('COUNT', '*'), 'count']
                ],
                group: ['priority']
            }),
            
            // Per namespace
            Recommendation.findAll({
                where: whereClause,
                attributes: [
                    'namespace',
                    [req.db.fn('COUNT', '*'), 'count']
                ],
                group: ['namespace'],
                limit: 10
            }),
            
            // Risparmi potenziali
            Recommendation.findAll({
                where: whereClause,
                attributes: [
                    [req.db.fn('SUM', req.db.literal('GREATEST(current_cpu_request - recommended_cpu_request, 0)')), 'cpu_savings'],
                    [req.db.fn('SUM', req.db.literal('GREATEST(current_memory_request - recommended_memory_request, 0)')), 'memory_savings'],
                    [req.db.fn('COUNT', '*'), 'total_containers']
                ]
            })
        ]);
        
        const overview = {
            total_recommendations: stats[0],
            by_priority: stats[1].reduce((acc, item) => {
                acc[item.priority] = parseInt(item.dataValues.count);
                return acc;
            }, {}),
            top_namespaces: stats[2].map(item => ({
                namespace: item.namespace,
                count: parseInt(item.dataValues.count)
            })),
            potential_savings: stats[3][0].dataValues
        };
        
        res.json({
            success: true,
            data: overview
        });
        
    } catch (error) {
        req.logger.error('Errore generazione overview:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server'
        });
    }
});

/**
 * POST /api/recommendations/bulk-select - Selezione multipla per operazioni batch
 */
router.post('/bulk-select', async (req, res) => {
    try {
        const { filters, operation } = req.body;
        
        const whereClause = {};
        if (filters.cluster_id) whereClause.cluster_id = filters.cluster_id;
        if (filters.namespace) whereClause.namespace = filters.namespace;
        if (filters.priority) whereClause.priority = { [Op.in]: filters.priority };
        if (filters.resource_type) whereClause.resource_type = { [Op.in]: filters.resource_type };
        if (filters.min_cpu_savings) {
            whereClause.cpu_savings_percentage = { [Op.gte]: filters.min_cpu_savings };
        }
        if (filters.min_memory_savings) {
            whereClause.memory_savings_percentage = { [Op.gte]: filters.min_memory_savings };
        }
        
        const recommendations = await Recommendation.findAll({
            where: whereClause,
            attributes: ['id', 'namespace', 'resource_name', 'resource_type', 'container_name', 'priority'],
            limit: 1000 // Limite di sicurezza
        });
        
        res.json({
            success: true,
            data: {
                selected_count: recommendations.length,
                recommendations: recommendations,
                operation: operation
            }
        });
        
    } catch (error) {
        req.logger.error('Errore selezione bulk:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server'
        });
    }
});

module.exports = router;