const k8s = require('@kubernetes/client-node');
const yaml = require('js-yaml');
const { BackupManager } = require('./backup');
const { PatchApplier } = require('./apply');
const { RollbackManager } = require('./rollback');

class K8sManager {
    constructor(logger, auditLogger) {
        this.logger = logger;
        this.auditLogger = auditLogger;
        
        // Inizializzazione client K8s
        this.kc = new k8s.KubeConfig();
        this.kc.loadFromDefault();
        
        this.k8sApi = this.kc.makeApiClient(k8s.AppsV1Api);
        this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
        this.batchApi = this.kc.makeApiClient(k8s.BatchV1Api);
        
        // Moduli specializzati
        this.backupManager = new BackupManager(this.k8sApi, this.coreApi, this.batchApi, logger);
        this.patchApplier = new PatchApplier(this.k8sApi, this.coreApi, this.batchApi, logger);
        this.rollbackManager = new RollbackManager(this.k8sApi, this.coreApi, this.batchApi, logger);
    }

    /**
     * Verifica connessione al cluster K8s
     */
    async healthCheck() {
        try {
            const response = await this.coreApi.listNamespace();
            return {
                connected: true,
                cluster: this.kc.getCurrentCluster()?.name || 'unknown',
                namespaces: response.body.items.length,
                context: this.kc.getCurrentContext()
            };
        } catch (error) {
            this.logger.error('Health check K8s fallito:', error);
            return {
                connected: false,
                error: error.message
            };
        }
    }

    /**
     * Backup di una risorsa prima dell'applicazione della patch
     */
    async createBackup(namespace, resourceName, resourceType) {
        return await this.backupManager.createBackup(namespace, resourceName, resourceType);
    }

    /**
     * Applica una patch a una risorsa K8s
     */
    async applyPatch(patchData, dryRun = false) {
        return await this.patchApplier.applyPatch(patchData, dryRun);
    }

    /**
     * Applica patch cumulative (batch)
     */
    async applyCumulativePatches(patches, dryRun = false) {
        return await this.patchApplier.applyCumulativePatches(patches, dryRun);
    }

    /**
     * Rollback di una patch applicata
     */
    async rollbackPatch(patchId, backupData) {
        return await this.rollbackManager.rollbackPatch(patchId, backupData);
    }

    /**
     * Rollback di un batch di patch
     */
    async rollbackBatch(batchId, patches) {
        return await this.rollbackManager.rollbackBatch(batchId, patches);
    }

    /**
     * Ottiene lo stato attuale di una risorsa
     */
    async getResourceStatus(namespace, resourceName, resourceType) {
        try {
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
            
            return {
                exists: true,
                resource: response.body,
                status: this.extractResourceStatus(response.body, resourceType)
            };
            
        } catch (error) {
            if (error.response?.statusCode === 404) {
                return { exists: false, error: 'Risorsa non trovata' };
            }
            throw error;
        }
    }

    /**
     * Estrae informazioni di stato da una risorsa K8s
     */
    extractResourceStatus(resource, resourceType) {
        const status = {
            replicas: {
                desired: resource.spec?.replicas || 1,
                ready: resource.status?.readyReplicas || 0,
                available: resource.status?.availableReplicas || 0
            },
            conditions: resource.status?.conditions || [],
            containers: []
        };

        // Estrae informazioni sui container
        const containers = resource.spec?.template?.spec?.containers || [];
        containers.forEach(container => {
            status.containers.push({
                name: container.name,
                image: container.image,
                resources: {
                    requests: container.resources?.requests || {},
                    limits: container.resources?.limits || {}
                }
            });
        });

        return status;
    }

    /**
     * Lista tutte le risorse di un tipo in un namespace
     */
    async listResources(namespace, resourceType) {
        try {
            let response;
            
            switch (resourceType) {
                case 'Deployment':
                    response = await this.k8sApi.listNamespacedDeployment(namespace);
                    break;
                case 'StatefulSet':
                    response = await this.k8sApi.listNamespacedStatefulSet(namespace);
                    break;
                case 'DaemonSet':
                    response = await this.k8sApi.listNamespacedDaemonSet(namespace);
                    break;
                case 'Job':
                    response = await this.batchApi.listNamespacedJob(namespace);
                    break;
                case 'CronJob':
                    response = await this.batchApi.listNamespacedCronJob(namespace);
                    break;
                default:
                    throw new Error(`Tipo risorsa non supportato: ${resourceType}`);
            }
            
            return response.body.items.map(item => ({
                name: item.metadata.name,
                namespace: item.metadata.namespace,
                labels: item.metadata.labels || {},
                annotations: item.metadata.annotations || {},
                creationTimestamp: item.metadata.creationTimestamp,
                status: this.extractResourceStatus(item, resourceType)
            }));
            
        } catch (error) {
            this.logger.error(`Errore listing ${resourceType} in ${namespace}:`, error);
            throw error;
        }
    }

    /**
     * Verifica se una risorsa è pronta per l'applicazione di patch
     */
    async isResourceReady(namespace, resourceName, resourceType) {
        try {
            const resourceStatus = await this.getResourceStatus(namespace, resourceName, resourceType);
            
            if (!resourceStatus.exists) {
                return { ready: false, reason: 'Risorsa non trovata' };
            }
            
            const status = resourceStatus.status;
            
            // Controlla se tutti i pod sono pronti
            if (status.replicas.ready !== status.replicas.desired) {
                return {
                    ready: false,
                    reason: `Pod non pronti: ${status.replicas.ready}/${status.replicas.desired}`
                };
            }
            
            // Controlla condizioni negative
            const badConditions = status.conditions.filter(c => 
                c.status === 'False' && ['Available', 'Progressing'].includes(c.type)
            );
            
            if (badConditions.length > 0) {
                return {
                    ready: false,
                    reason: `Condizioni negative: ${badConditions.map(c => c.type).join(', ')}`
                };
            }
            
            return { ready: true };
            
        } catch (error) {
            return { ready: false, reason: `Errore verifica: ${error.message}` };
        }
    }

    /**
     * Monitora lo stato di un deployment dopo l'applicazione di una patch
     */
    async monitorPatchApplication(namespace, resourceName, resourceType, timeoutMs = 300000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = 5000; // 5 secondi
            
            const monitor = async () => {
                try {
                    const status = await this.getResourceStatus(namespace, resourceName, resourceType);
                    
                    if (!status.exists) {
                        reject(new Error('Risorsa scomparsa durante il monitoraggio'));
                        return;
                    }
                    
                    const ready = await this.isResourceReady(namespace, resourceName, resourceType);
                    
                    if (ready.ready) {
                        resolve({
                            success: true,
                            duration: Date.now() - startTime,
                            finalStatus: status.status
                        });
                        return;
                    }
                    
                    // Timeout check
                    if (Date.now() - startTime > timeoutMs) {
                        reject(new Error(`Timeout monitoring patch application: ${ready.reason}`));
                        return;
                    }
                    
                    // Continua monitoring
                    setTimeout(monitor, checkInterval);
                    
                } catch (error) {
                    reject(error);
                }
            };
            
            monitor();
        });
    }
}

module.exports = { K8sManager };