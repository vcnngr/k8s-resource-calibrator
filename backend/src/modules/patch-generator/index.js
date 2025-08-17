// backend/src/modules/patch-generator/index.js
const yaml = require('js-yaml');
const { generateYamlPatch } = require('./yaml-generator');
const { validatePatchStrategy } = require('./strategies');

class PatchGenerator {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Genera patch per una singola raccomandazione
     */
    async generateSinglePatch(recommendation, strategy = 'conservative') {
        try {
            this.logger.info(`Generazione patch per ${recommendation.namespace}/${recommendation.resource_name}`);
            
            // Validazione strategia
            const validatedStrategy = validatePatchStrategy(strategy);
            
            // Generazione patch YAML
            const patchData = await generateYamlPatch(recommendation, validatedStrategy);
            
            return {
                recommendation_id: recommendation.id,
                cluster_id: recommendation.cluster_id,
                namespace: recommendation.namespace,
                resource_name: recommendation.resource_name,
                resource_type: recommendation.resource_type,
                container_name: recommendation.container_name,
                patch_data: patchData,
                is_cumulative: false,
                strategy: validatedStrategy
            };
            
        } catch (error) {
            this.logger.error('Errore generazione patch singola:', error);
            throw error;
        }
    }

    /**
     * Genera patch cumulative per più raccomandazioni
     */
    async generateCumulativePatches(recommendations, strategy = 'conservative') {
        try {
            this.logger.info(`Generazione patch cumulative per ${recommendations.length} raccomandazioni`);
            
            const batchId = require('uuid').v4();
            const patches = [];
            
            // Raggruppa per risorsa (namespace + resource_name + resource_type)
            const groupedByResource = this.groupRecommendationsByResource(recommendations);
            
            for (const [resourceKey, resourceRecommendations] of Object.entries(groupedByResource)) {
                const cumulativePatch = await this.generateCumulativePatchForResource(
                    resourceRecommendations, 
                    strategy, 
                    batchId
                );
                patches.push(cumulativePatch);
            }
            
            this.logger.info(`Generate ${patches.length} patch cumulative per batch ${batchId}`);
            return {
                batch_id: batchId,
                patches: patches,
                strategy: strategy,
                total_recommendations: recommendations.length
            };
            
        } catch (error) {
            this.logger.error('Errore generazione patch cumulative:', error);
            throw error;
        }
    }

    /**
     * Raggruppa raccomandazioni per risorsa K8s
     */
    groupRecommendationsByResource(recommendations) {
        const grouped = {};
        
        recommendations.forEach(rec => {
            const key = `${rec.cluster_id}/${rec.namespace}/${rec.resource_name}/${rec.resource_type}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(rec);
        });
        
        return grouped;
    }

    /**
     * Genera patch cumulativa per una singola risorsa con più container
     */
    async generateCumulativePatchForResource(recommendations, strategy, batchId) {
        const firstRec = recommendations[0];
        
        // Crea un'unica patch che modifica tutti i container della risorsa
        const containerUpdates = {};
        
        recommendations.forEach(rec => {
            containerUpdates[rec.container_name] = {
                current: {
                    cpu_request: rec.current_cpu_request,
                    cpu_limit: rec.current_cpu_limit,
                    memory_request: rec.current_memory_request,
                    memory_limit: rec.current_memory_limit
                },
                recommended: {
                    cpu_request: rec.recommended_cpu_request,
                    cpu_limit: rec.recommended_cpu_limit,
                    memory_request: rec.recommended_memory_request,
                    memory_limit: rec.recommended_memory_limit
                }
            };
        });
        
        const patchData = await this.generateMultiContainerPatch(
            firstRec.resource_type,
            containerUpdates,
            strategy
        );
        
        return {
            recommendation_ids: recommendations.map(r => r.id),
            cluster_id: firstRec.cluster_id,
            namespace: firstRec.namespace,
            resource_name: firstRec.resource_name,
            resource_type: firstRec.resource_type,
            patch_data: patchData,
            is_cumulative: true,
            batch_id: batchId,
            container_count: recommendations.length,
            strategy: strategy
        };
    }

    /**
     * Genera patch per più container nella stessa risorsa
     */
    async generateMultiContainerPatch(resourceType, containerUpdates, strategy) {
        const validatedStrategy = validatePatchStrategy(strategy);
        
        // Costruisce la patch per tutti i container
        const containerPatches = [];
        
        for (const [containerName, updates] of Object.entries(containerUpdates)) {
            const containerPatch = this.buildContainerResourcePatch(
                containerName, 
                updates, 
                validatedStrategy
            );
            if (containerPatch) {
                containerPatches.push(containerPatch);
            }
        }
        
        // Crea la patch finale per la risorsa
        const patch = {
            apiVersion: this.getApiVersionForResourceType(resourceType),
            kind: resourceType,
            metadata: {
                name: '${RESOURCE_NAME}', // Placeholder sostituito durante apply
                namespace: '${NAMESPACE}'
            },
            spec: {
                template: {
                    spec: {
                        containers: containerPatches
                    }
                }
            }
        };
        
        return {
            yaml: yaml.dump(patch),
            type: 'strategic-merge-patch',
            containers_updated: Object.keys(containerUpdates).length,
            strategy: validatedStrategy.name
        };
    }

    /**
     * Costruisce la patch per un singolo container
     */
    buildContainerResourcePatch(containerName, updates, strategy) {
        const resources = {
            requests: {},
            limits: {}
        };
        
        // Applica strategia per CPU
        if (updates.recommended.cpu_request !== null) {
            const finalCpuRequest = strategy.applyCpuStrategy(
                updates.current.cpu_request,
                updates.recommended.cpu_request
            );
            if (finalCpuRequest !== null) {
                resources.requests.cpu = `${finalCpuRequest}m`;
            }
        }
        
        if (updates.recommended.cpu_limit !== null && strategy.preserveLimits) {
            const finalCpuLimit = strategy.applyCpuStrategy(
                updates.current.cpu_limit,
                updates.recommended.cpu_limit
            );
            if (finalCpuLimit !== null) {
                resources.limits.cpu = `${finalCpuLimit}m`;
            }
        }
        
        // Applica strategia per Memory
        if (updates.recommended.memory_request !== null) {
            const finalMemoryRequest = strategy.applyMemoryStrategy(
                updates.current.memory_request,
                updates.recommended.memory_request
            );
            if (finalMemoryRequest !== null) {
                resources.requests.memory = `${finalMemoryRequest}`;
            }
        }
        
        if (updates.recommended.memory_limit !== null && strategy.preserveLimits) {
            const finalMemoryLimit = strategy.applyMemoryStrategy(
                updates.current.memory_limit,
                updates.recommended.memory_limit
            );
            if (finalMemoryLimit !== null) {
                resources.limits.memory = `${finalMemoryLimit}`;
            }
        }
        
        // Rimuove sezioni vuote
        if (Object.keys(resources.requests).length === 0) delete resources.requests;
        if (Object.keys(resources.limits).length === 0) delete resources.limits;
        
        if (Object.keys(resources).length === 0) {
            return null; // Nessuna modifica necessaria
        }
        
        return {
            name: containerName,
            resources: resources
        };
    }

    /**
     * Ottiene la versione API corretta per il tipo di risorsa
     */
    getApiVersionForResourceType(resourceType) {
        const apiVersions = {
            'Deployment': 'apps/v1',
            'StatefulSet': 'apps/v1',
            'DaemonSet': 'apps/v1',
            'Job': 'batch/v1',
            'CronJob': 'batch/v1'
        };
        return apiVersions[resourceType] || 'apps/v1';
    }

    /**
     * Valida una patch generata
     */
    async validatePatch(patchData) {
        try {
            // Validazione sintassi YAML
            yaml.load(patchData.yaml);
            
            // Validazioni logiche
            const validations = [
                this.validateResourceValues(patchData),
                this.validatePatchStructure(patchData)
            ];
            
            const results = await Promise.all(validations);
            const errors = results.filter(r => !r.valid).map(r => r.error);
            
            return {
                valid: errors.length === 0,
                errors: errors
            };
            
        } catch (error) {
            return {
                valid: false,
                errors: [`Errore validazione patch: ${error.message}`]
            };
        }
    }

    /**
     * Valida i valori delle risorse nella patch
     */
    validateResourceValues(patchData) {
        try {
            const patch = yaml.load(patchData.yaml);
            const containers = patch?.spec?.template?.spec?.containers || [];
            
            for (const container of containers) {
                const resources = container.resources || {};
                
                // Validazione CPU
                if (resources.requests?.cpu) {
                    const cpuValue = this.parseCpuValue(resources.requests.cpu);
                    if (cpuValue <= 0 || cpuValue > 100000) { // Max 100 CPU cores
                        return { valid: false, error: `Valore CPU request non valido: ${resources.requests.cpu}` };
                    }
                }
                
                // Validazione Memory
                if (resources.requests?.memory) {
                    const memoryValue = this.parseMemoryValue(resources.requests.memory);
                    if (memoryValue <= 0 || memoryValue > 1000 * 1024 * 1024 * 1024) { // Max 1TB
                        return { valid: false, error: `Valore Memory request non valido: ${resources.requests.memory}` };
                    }
                }
            }
            
            return { valid: true };
            
        } catch (error) {
            return { valid: false, error: `Errore validazione valori: ${error.message}` };
        }
    }

    /**
     * Valida la struttura della patch
     */
    validatePatchStructure(patchData) {
        try {
            const patch = yaml.load(patchData.yaml);
            
            if (!patch.kind || !patch.apiVersion) {
                return { valid: false, error: 'Patch mancante di kind o apiVersion' };
            }
            
            if (!patch.spec?.template?.spec?.containers) {
                return { valid: false, error: 'Patch mancante di containers specification' };
            }
            
            return { valid: true };
            
        } catch (error) {
            return { valid: false, error: `Errore struttura patch: ${error.message}` };
        }
    }

    /**
     * Parsers per valori delle risorse
     */
    parseCpuValue(cpuStr) {
        if (cpuStr.endsWith('m')) {
            return parseInt(cpuStr.slice(0, -1));
        }
        return parseFloat(cpuStr) * 1000;
    }

    parseMemoryValue(memoryStr) {
        const units = {
            'Ki': 1024,
            'Mi': 1024 * 1024,
            'Gi': 1024 * 1024 * 1024,
            'Ti': 1024 * 1024 * 1024 * 1024
        };
        
        const match = memoryStr.match(/^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti)?$/);
        if (!match) return 0;
        
        const value = parseFloat(match[1]);
        const unit = match[2] || '';
        
        return value * (units[unit] || 1);
    }
}

module.exports = { PatchGenerator };