const crypto = require('crypto');
const yaml = require('js-yaml');

class BackupManager {
    constructor(k8sApi, coreApi, batchApi, logger) {
        this.k8sApi = k8sApi;
        this.coreApi = coreApi;
        this.batchApi = batchApi;
        this.logger = logger;
    }

    /**
     * Crea backup di una risorsa K8s
     */
    async createBackup(namespace, resourceName, resourceType) {
        try {
            this.logger.info(`Creazione backup per ${resourceType}/${namespace}/${resourceName}`);
            
            // Ottiene la risorsa corrente
            const currentResource = await this.getResource(namespace, resourceName, resourceType);
            
            if (!currentResource) {
                throw new Error(`Risorsa ${resourceType}/${namespace}/${resourceName} non trovata`);
            }
            
            // Rimuove metadati non necessari per il backup
            const cleanedResource = this.cleanResourceForBackup(currentResource);
            
            // Calcola checksum per verifica integrità
            const checksum = this.calculateChecksum(cleanedResource);
            
            const backupData = {
                cluster_id: process.env.CLUSTER_ID || 'default',
                namespace: namespace,
                resource_name: resourceName,
                resource_type: resourceType,
                backup_data: cleanedResource,
                checksum: checksum,
                created_at: new Date()
            };
            
            this.logger.info(`Backup creato con checksum: ${checksum}`);
            return backupData;
            
        } catch (error) {
            this.logger.error('Errore creazione backup:', error);
            throw error;
        }
    }

    /**
     * Ottiene una risorsa K8s specifica
     */
    async getResource(namespace, resourceName, resourceType) {
        let response;
        
        switch (resourceType) {
            case 'Deployment':
                response = await this.k8sApi.readNamespacedDeployment(resourceName, namespace);
                break;
            case 'StatefulSet':
                response = await this.k8sApi.readNamespacedStatefulSet(resourceName, namespace);
                break;
            case 'DaemonSet':
                response = await this.k8sApi.readNamespacedDaemonSet(resourceName, namespace);
                break;
            case 'Job':
                response = await this.batchApi.readNamespacedJob(resourceName, namespace);
                break;
            case 'CronJob':
                response = await this.batchApi.readNamespacedCronJob(resourceName, namespace);
                break;
            default:
                throw new Error(`Tipo risorsa non supportato: ${resourceType}`);
        }
        
        return response.body;
    }

    /**
     * Pulisce la risorsa rimuovendo metadati non necessari
     */
    cleanResourceForBackup(resource) {
        const cleaned = JSON.parse(JSON.stringify(resource));
        
        // Rimuove metadati runtime
        if (cleaned.metadata) {
            delete cleaned.metadata.uid;
            delete cleaned.metadata.resourceVersion;
            delete cleaned.metadata.generation;
            delete cleaned.metadata.creationTimestamp;
            delete cleaned.metadata.managedFields;
            delete cleaned.metadata.selfLink;
        }
        
        // Rimuove status (sarà rigenerato)
        delete cleaned.status;
        
        return cleaned;
    }

    /**
     * Calcola checksum per verifica integrità
     */
    calculateChecksum(data) {
        const dataString = JSON.stringify(data, Object.keys(data).sort());
        return crypto.createHash('sha256').update(dataString).digest('hex');
    }

    /**
     * Verifica integrità di un backup
     */
    verifyBackupIntegrity(backupData) {
        const calculatedChecksum = this.calculateChecksum(backupData.backup_data);
        return calculatedChecksum === backupData.checksum;
    }

    /**
     * Ripristina una risorsa da backup
     */
    async restoreFromBackup(backupData) {
        try {
            // Verifica integrità
            if (!this.verifyBackupIntegrity(backupData)) {
                throw new Error('Backup corrotto: checksum non valido');
            }
            
            const resource = backupData.backup_data;
            const namespace = backupData.namespace;
            const resourceType = backupData.resource_type;
            
            this.logger.info(`Ripristino da backup: ${resourceType}/${namespace}/${resource.metadata.name}`);
            
            // Applica la risorsa ripristinata
            return await this.applyResource(resource, resourceType);
            
        } catch (error) {
            this.logger.error('Errore ripristino backup:', error);
            throw error;
        }
    }

    /**
     * Applica una risorsa K8s
     */
    async applyResource(resource, resourceType) {
        const namespace = resource.metadata.namespace;
        const name = resource.metadata.name;
        
        switch (resourceType) {
            case 'Deployment':
                return await this.k8sApi.replaceNamespacedDeployment(name, namespace, resource);
            case 'StatefulSet':
                return await this.k8sApi.replaceNamespacedStatefulSet(name, namespace, resource);
            case 'DaemonSet':
                return await this.k8sApi.replaceNamespacedDaemonSet(name, namespace, resource);
            case 'Job':
                return await this.batchApi.replaceNamespacedJob(name, namespace, resource);
            case 'CronJob':
                return await this.batchApi.replaceNamespacedCronJob(name, namespace, resource);
            default:
                throw new Error(`Tipo risorsa non supportato: ${resourceType}`);
        }
    }
}

module.exports = { BackupManager };