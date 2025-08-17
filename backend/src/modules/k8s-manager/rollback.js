const { BackupManager } = require('./backup');

class RollbackManager {
    constructor(k8sApi, coreApi, batchApi, logger) {
        this.k8sApi = k8sApi;
        this.coreApi = coreApi;
        this.batchApi = batchApi;
        this.logger = logger;
        this.backupManager = new BackupManager(k8sApi, coreApi, batchApi, logger);
    }

    /**
     * Rollback di una singola patch
     */
    async rollbackPatch(patchId, backupData) {
        try {
            this.logger.info(`Avvio rollback patch ${patchId}`);
            
            // Verifica integrità backup
            if (!this.backupManager.verifyBackupIntegrity(backupData)) {
                throw new Error('Backup corrotto: impossibile eseguire rollback');
            }
            
            // Ripristina da backup
            const result = await this.backupManager.restoreFromBackup(backupData);
            
            this.logger.info(`Rollback patch ${patchId} completato con successo`);
            
            return {
                success: true,
                rolled_back_at: new Date(),
                k8s_response: result
            };
            
        } catch (error) {
            this.logger.error(`Errore rollback patch ${patchId}:`, error);
            return {
                success: false,
                error_message: error.message,
                rolled_back_at: new Date()
            };
        }
    }

    /**
     * Rollback di un batch di patch
     */
    async rollbackBatch(batchId, patches) {
        const results = [];
        
        this.logger.info(`Avvio rollback batch ${batchId} con ${patches.length} patch`);
        
        // Rollback in ordine inverso
        const reversedPatches = [...patches].reverse();
        
        for (const patch of reversedPatches) {
            try {
                const result = await this.rollbackPatch(patch.id, patch.backup_data);
                results.push({
                    patch_id: patch.id,
                    ...result
                });
                
                // Pausa tra rollback
                await this.sleep(2000);
                
            } catch (error) {
                results.push({
                    patch_id: patch.id,
                    success: false,
                    error_message: error.message,
                    rolled_back_at: new Date()
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        
        this.logger.info(`Rollback batch ${batchId} completato: ${successCount} successi, ${failureCount} fallimenti`);
        
        return {
            batch_success: failureCount === 0,
            total_rollbacks: results.length,
            successful_rollbacks: successCount,
            failed_rollbacks: failureCount,
            results: results
        };
    }

    /**
     * Crea un punto di rollback automatico
     */
    async createRollbackPoint(namespace, resourceName, resourceType, reason = 'Auto backup') {
        try {
            const backup = await this.backupManager.createBackup(namespace, resourceName, resourceType);
            
            return {
                ...backup,
                rollback_reason: reason,
                auto_created: true
            };
            
        } catch (error) {
            this.logger.error('Errore creazione punto di rollback:', error);
            throw error;
        }
    }

    /**
     * Utility per pausa
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { RollbackManager };