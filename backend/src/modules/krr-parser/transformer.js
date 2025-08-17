// backend/src/modules/krr-parser/transformer.js
const { v4: uuidv4 } = require('uuid');

/**
 * Trasforma i dati KRR in formato adatto al database
 */
async function transformKrrData(krrJson, metadata = {}) {
    const jsonData = typeof krrJson === 'string' ? JSON.parse(krrJson) : krrJson;
    
    // Dati scan
    const scanData = {
        cluster_id: jsonData.cluster_id,
        scan_id: jsonData.scan_id,
        scan_date: new Date(jsonData.scan_date),
        scan_status: mapScanState(jsonData.scan_state),
        prometheus_url: jsonData.prometheus_url || metadata.prometheus_url,
        raw_data: jsonData,
        metadata: {
            strategy: jsonData.strategy || 'simple',
            duration_seconds: jsonData.duration_seconds,
            total_results: jsonData.results.length,
            ...metadata
        }
    };
    
    // Trasformazione raccomandazioni
    const recommendations = jsonData.results.map(result => ({
        cluster_id: result.cluster_id,
        namespace: result.namespace,
        resource_name: result.name,
        resource_type: mapResourceType(result.kind),
        container_name: result.container,
        priority: result.priority,
        
        // CPU
        current_cpu_request: result.current_cpu_request,
        recommended_cpu_request: result.recommended_cpu_request,
        current_cpu_limit: result.current_cpu_limit,
        recommended_cpu_limit: result.recommended_cpu_limit,
        
        // Memory
        current_memory_request: result.current_memory_request,
        recommended_memory_request: result.recommended_memory_request,
        current_memory_limit: result.current_memory_limit,
        recommended_memory_limit: result.recommended_memory_limit,
        
        // Statistiche
        pods_count: result.pods_count || 1,
        
        // Metadati
        labels: result.labels || {},
        annotations: result.annotations || {},
        additional_data: {
            ...result.additional_data,
            original_index: jsonData.results.indexOf(result)
        }
    }));
    
    return {
        scan: scanData,
        recommendations: recommendations,
        summary: generateSummary(recommendations)
    };
}

/**
 * Mappa gli stati di scan KRR agli stati del DB
 */
function mapScanState(krrState) {
    const stateMap = {
        'success': 'completed',
        'failed': 'failed',
        'partial': 'completed'
    };
    return stateMap[krrState] || 'failed';
}

/**
 * Mappa i tipi di risorsa K8s
 */
function mapResourceType(kind) {
    const validTypes = ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'];
    return validTypes.includes(kind) ? kind : 'Deployment';
}

/**
 * Genera un riassunto delle raccomandazioni
 */
function generateSummary(recommendations) {
    const summary = {
        total_recommendations: recommendations.length,
        by_priority: {},
        by_namespace: {},
        by_resource_type: {},
        potential_savings: {
            cpu: 0,
            memory: 0,
            total_containers: 0
        }
    };
    
    recommendations.forEach(rec => {
        // Conteggi per priorità
        summary.by_priority[rec.priority] = (summary.by_priority[rec.priority] || 0) + 1;
        
        // Conteggi per namespace
        summary.by_namespace[rec.namespace] = (summary.by_namespace[rec.namespace] || 0) + 1;
        
        // Conteggi per tipo risorsa
        summary.by_resource_type[rec.resource_type] = (summary.by_resource_type[rec.resource_type] || 0) + 1;
        
        // Calcolo risparmi potenziali
        if (rec.current_cpu_request && rec.recommended_cpu_request) {
            summary.potential_savings.cpu += Math.max(0, rec.current_cpu_request - rec.recommended_cpu_request);
        }
        
        if (rec.current_memory_request && rec.recommended_memory_request) {
            summary.potential_savings.memory += Math.max(0, rec.current_memory_request - rec.recommended_memory_request);
        }
        
        summary.potential_savings.total_containers += rec.pods_count;
    });
    
    return summary;
}

/**
 * Converte unità di memoria da stringa a bytes
 */
function parseMemoryToBytes(memoryStr) {
    if (!memoryStr || typeof memoryStr === 'number') return memoryStr;
    
    const units = {
        'Ki': 1024,
        'Mi': 1024 * 1024,
        'Gi': 1024 * 1024 * 1024,
        'Ti': 1024 * 1024 * 1024 * 1024,
        'K': 1000,
        'M': 1000 * 1000,
        'G': 1000 * 1000 * 1000,
        'T': 1000 * 1000 * 1000 * 1000
    };
    
    const match = memoryStr.match(/^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|K|M|G|T)?$/);
    if (!match) return null;
    
    const value = parseFloat(match[1]);
    const unit = match[2] || '';
    
    return Math.floor(value * (units[unit] || 1));
}

/**
 * Converte CPU da stringa a millicores
 */
function parseCpuToMillicores(cpuStr) {
    if (!cpuStr || typeof cpuStr === 'number') return cpuStr;
    
    if (cpuStr.endsWith('m')) {
        return parseInt(cpuStr.slice(0, -1));
    }
    
    return Math.floor(parseFloat(cpuStr) * 1000);
}

module.exports = {
    transformKrrData,
    mapScanState,
    mapResourceType,
    generateSummary,
    parseMemoryToBytes,
    parseCpuToMillicores
};