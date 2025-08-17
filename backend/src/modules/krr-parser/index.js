// backend/src/modules/krr-parser/index.js
const { validateKrrOutput } = require('./validator');
const { transformKrrData } = require('./transformer');
const { v4: uuidv4 } = require('uuid');

class KrrParser {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Processa l'output JSON di KRR e lo trasforma in dati strutturati per il DB
     */
    async parseKrrOutput(rawJson, metadata = {}) {
        try {
            this.logger.info('Avvio parsing output KRR');
            
            // 1. Validazione del JSON
            const validationResult = await validateKrrOutput(rawJson);
            if (!validationResult.valid) {
                throw new Error(`JSON KRR non valido: ${validationResult.errors.join(', ')}`);
            }

            // 2. Trasformazione dati
            const parsedData = await transformKrrData(rawJson, metadata);
            
            this.logger.info(`Parsing completato: ${parsedData.recommendations.length} raccomandazioni processate`);
            return parsedData;
            
        } catch (error) {
            this.logger.error('Errore durante il parsing KRR:', error);
            throw error;
        }
    }

    /**
     * Estrae metadati dal JSON KRR
     */
    extractMetadata(krrJson) {
        return {
            cluster_id: krrJson.cluster_id || 'unknown',
            scan_id: krrJson.scan_id || uuidv4(),
            scan_date: krrJson.scan_date || new Date().toISOString(),
            scan_state: krrJson.scan_state || 'unknown',
            total_results: krrJson.results ? krrJson.results.length : 0,
            prometheus_url: krrJson.prometheus_url || null
        };
    }
}

module.exports = { KrrParser };