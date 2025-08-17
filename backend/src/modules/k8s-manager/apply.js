const yaml = require('js-yaml');

class PatchApplier {
    constructor(k8sApi, coreApi, batchApi, logger) {
        this.k8sApi = k8sApi;
        this.coreApi = coreApi;
        this.batchApi = batchApi;
        this.logger = logger;
    }

    /**
     * Applica una singola patch
     */
    async applyPatch(patchData, dryRun = false) {
        try {
            const { namespace, resource_name, resource_type, patch_data } = patchData;
            
            this.logger.info(`${dryRun ? 'Simulazione' : 'Applicazione'} patch per ${resource_type}/${namespace}/${resource_name}`);
            
            // Parse della patch YAML
            const patchYaml = yaml.load(patch_data.yaml);
            
            // Sostituisce i placeholder
            this.replacePlaceholders(patchYaml, namespace, resource_name);
            
            // Applica la patch
            const result = await this.applyResourcePatch(
                namespace, 
                resource_name, 
                resource_type, 
                patchYaml, 
                dryRun
            );
            
            return {
                success: true,
                applied_at: new Date(),
                k8s_response: result,
                dry_run: dryRun
            };
            
        } catch (error) {
            this.logger.error('Errore applicazione patch:', error);
            return {
                success: false,
                error_message: error.message,
                applied_at: new Date(),
                dry_run: dryRun
            };
        }
    }

    /**
     * Applica patch cumulative in batch
     */
    async applyCumulativePatches(patches, dryRun = false) {
        const results = [];
        
        this.logger.info(`${dryRun ? 'Simulazione' : 'Applicazione'} batch di ${patches.length} patch`);
        
        for (const patch of patches) {
            try {
                const result = await this.applyPatch(patch, dryRun);
                results.push({
                    patch_id: patch.id,
                    ...result
                });
                
                // Pausa tra applicazioni per evitare sovraccarico
                if (!dryRun) {
                    await this.sleep(2000);
                }
                
            } catch (error) {
                results.push({
                    patch_id: patch.id,
                    success: false,
                    error_message: error.message,
                    applied_at: new Date(),
                    dry_run: dryRun
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        
        this.logger.info(`Batch completato: ${successCount} successi, ${failureCount} fallimenti`);
        
        return {
            batch_success: failureCount === 0,
            total_patches: results.length,
            successful_patches: successCount,
            failed_patches: failureCount,
            results: results
        };
    }

    /**
     * Sostituisce i placeholder nella patch
     */
    replacePlaceholders(patchYaml, namespace, resourceName) {
        const jsonStr = JSON.stringify(patchYaml);
        const replaced = jsonStr
            .replace(/\$\{NAMESPACE\}/g, namespace)
            .replace(/\$\{RESOURCE_NAME\}/g, resourceName);
        
        const replacedObj = JSON.parse(replaced);
        Object.assign(patchYaml, replacedObj);
    }

    /**
     * Applica patch a una risorsa specifica
     */
    async applyResourcePatch(namespace, resourceName, resourceType, patchYaml, dryRun) {
        const options = {
            headers: {
                'Content-Type': 'application/strategic-merge-patch+json'
            }
        };
        
        if (dryRun) {
            options.dryRun = ['All'];
        }
        
        switch (resourceType) {
            case 'Deployment':
                return await this.k8sApi.patchNamespacedDeployment(
                    resourceName, namespace, patchYaml, undefined, undefined, undefined, undefined, options
                );
            case 'StatefulSet':
                return await this.k8sApi.patchNamespacedStatefulSet(
                    resourceName, namespace, patchYaml, undefined, undefined, undefined, undefined, options
                );
            case 'DaemonSet':
                return await this.k8sApi.patchNamespacedDaemonSet(
                    resourceName, namespace, patchYaml, undefined, undefined, undefined, undefined, options
                );
            case 'Job':
                return await this.batchApi.patchNamespacedJob(
                    resourceName, namespace, patchYaml, undefined, undefined, undefined, undefined, options
                );
            case 'CronJob':
                return await this.batchApi.patchNamespacedCronJob(
                    resourceName, namespace, patchYaml, undefined, undefined, undefined, undefined, options
                );
            default:
                throw new Error(`Tipo risorsa non supportato: ${resourceType}`);
        }
    }

    /**
     * Utility per pausa
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { PatchApplier };