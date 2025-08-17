// backend/src/modules/patch-generator/yaml-generator.js
const yaml = require('js-yaml');

/**
 * Genera YAML patch per una raccomandazione specifica
 */
async function generateYamlPatch(recommendation, strategy) {
  try {
    const patchData = buildResourcePatch(recommendation, strategy);
    
    if (!patchData) {
      throw new Error('Nessuna modifica necessaria per questa raccomandazione');
    }

    const yamlContent = yaml.dump(patchData, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });

    return {
      yaml: yamlContent,
      type: 'strategic-merge-patch',
      containers_updated: 1,
      strategy: strategy.name
    };
    
  } catch (error) {
    throw new Error(`Errore generazione YAML: ${error.message}`);
  }
}

/**
 * Costruisce la patch per una risorsa Kubernetes
 */
function buildResourcePatch(recommendation, strategy) {
  const containerPatch = buildContainerResourcePatch(recommendation, strategy);
  
  if (!containerPatch) {
    return null; // Nessuna modifica necessaria
  }

  const patch = {
    apiVersion: getApiVersionForResourceType(recommendation.resource_type),
    kind: recommendation.resource_type,
    metadata: {
      name: '${RESOURCE_NAME}', // Placeholder sostituito durante apply
      namespace: '${NAMESPACE}'
    },
    spec: {}
  };

  // Struttura spec diversa per diversi tipi di risorsa
  switch (recommendation.resource_type) {
    case 'Job':
      patch.spec.template = {
        spec: {
          containers: [containerPatch]
        }
      };
      break;
      
    case 'CronJob':
      patch.spec.jobTemplate = {
        spec: {
          template: {
            spec: {
              containers: [containerPatch]
            }
          }
        }
      };
      break;
      
    default: // Deployment, StatefulSet, DaemonSet
      patch.spec.template = {
        spec: {
          containers: [containerPatch]
        }
      };
  }

  return patch;
}

/**
 * Costruisce la patch per un singolo container
 */
function buildContainerResourcePatch(recommendation, strategy) {
  const resources = {
    requests: {},
    limits: {}
  };

  // Applica strategia per CPU Request
  if (recommendation.recommended_cpu_request !== null) {
    const finalCpuRequest = strategy.applyCpuStrategy(
      recommendation.current_cpu_request,
      recommendation.recommended_cpu_request
    );
    if (finalCpuRequest !== null) {
      resources.requests.cpu = formatCpuValue(finalCpuRequest);
    }
  }

  // Applica strategia per CPU Limit
  if (recommendation.recommended_cpu_limit !== null && strategy.preserveLimits) {
    const finalCpuLimit = strategy.applyCpuStrategy(
      recommendation.current_cpu_limit,
      recommendation.recommended_cpu_limit
    );
    if (finalCpuLimit !== null) {
      resources.limits.cpu = formatCpuValue(finalCpuLimit);
    }
  }

  // Applica strategia per Memory Request
  if (recommendation.recommended_memory_request !== null) {
    const finalMemoryRequest = strategy.applyMemoryStrategy(
      recommendation.current_memory_request,
      recommendation.recommended_memory_request
    );
    if (finalMemoryRequest !== null) {
      resources.requests.memory = formatMemoryValue(finalMemoryRequest);
    }
  }

  // Applica strategia per Memory Limit
  if (recommendation.recommended_memory_limit !== null && strategy.preserveLimits) {
    const finalMemoryLimit = strategy.applyMemoryStrategy(
      recommendation.current_memory_limit,
      recommendation.recommended_memory_limit
    );
    if (finalMemoryLimit !== null) {
      resources.limits.memory = formatMemoryValue(finalMemoryLimit);
    }
  }

  // Rimuove sezioni vuote
  if (Object.keys(resources.requests).length === 0) delete resources.requests;
  if (Object.keys(resources.limits).length === 0) delete resources.limits;

  if (Object.keys(resources).length === 0) {
    return null; // Nessuna modifica necessaria
  }

  return {
    name: recommendation.container_name,
    resources: resources
  };
}

/**
 * Ottiene la versione API corretta per il tipo di risorsa
 */
function getApiVersionForResourceType(resourceType) {
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
 * Formatta valore CPU per Kubernetes
 */
function formatCpuValue(milliCores) {
  if (milliCores >= 1000) {
    // Converte a CPU core (es: 1500m -> 1.5)
    return `${(milliCores / 1000).toString()}`;
  } else {
    // Mantiene in millicores (es: 500m)
    return `${milliCores}m`;
  }
}

/**
 * Formatta valore Memory per Kubernetes
 */
function formatMemoryValue(bytes) {
  const units = [
    { name: 'Gi', value: 1024 * 1024 * 1024 },
    { name: 'Mi', value: 1024 * 1024 },
    { name: 'Ki', value: 1024 }
  ];

  // Trova l'unità più appropriata
  for (const unit of units) {
    if (bytes >= unit.value) {
      const value = bytes / unit.value;
      // Se è un numero intero, non mostrare decimali
      if (value % 1 === 0) {
        return `${Math.floor(value)}${unit.name}`;
      } else {
        return `${value.toFixed(1)}${unit.name}`;
      }
    }
  }

  // Fallback per valori molto piccoli
  return `${bytes}`;
}

/**
 * Valida una patch YAML generata
 */
function validateGeneratedYaml(yamlContent) {
  try {
    const parsed = yaml.load(yamlContent);
    
    // Validazioni base
    if (!parsed.apiVersion || !parsed.kind || !parsed.metadata || !parsed.spec) {
      throw new Error('Patch YAML mancante di campi obbligatori');
    }

    if (!parsed.metadata.name || !parsed.metadata.namespace) {
      throw new Error('Metadata mancante di name o namespace');
    }

    // Validazione specifica per containers
    const containers = extractContainersFromPatch(parsed);
    if (!containers || containers.length === 0) {
      throw new Error('Nessun container trovato nella patch');
    }

    for (const container of containers) {
      if (!container.name) {
        throw new Error('Container senza nome nella patch');
      }
      
      if (!container.resources) {
        throw new Error(`Container ${container.name} senza sezione resources`);
      }
    }

    return { valid: true };
    
  } catch (error) {
    return { 
      valid: false, 
      error: `Validazione YAML fallita: ${error.message}` 
    };
  }
}

/**
 * Estrae la lista containers dalla patch
 */
function extractContainersFromPatch(patch) {
  // Gestisce diverse strutture basate sul tipo di risorsa
  if (patch.spec.jobTemplate) {
    // CronJob
    return patch.spec.jobTemplate.spec.template.spec.containers;
  } else if (patch.spec.template) {
    // Deployment, StatefulSet, DaemonSet, Job
    return patch.spec.template.spec.containers;
  } else {
    return null;
  }
}

/**
 * Genera patch di esempio per testing
 */
function generateSamplePatch(resourceType = 'Deployment') {
  return {
    apiVersion: getApiVersionForResourceType(resourceType),
    kind: resourceType,
    metadata: {
      name: 'sample-resource',
      namespace: 'default'
    },
    spec: {
      template: {
        spec: {
          containers: [{
            name: 'app-container',
            resources: {
              requests: {
                cpu: '200m',
                memory: '256Mi'
              },
              limits: {
                cpu: '500m',
                memory: '512Mi'
              }
            }
          }]
        }
      }
    }
  };
}

module.exports = {
  generateYamlPatch,
  buildResourcePatch,
  buildContainerResourcePatch,
  validateGeneratedYaml,
  generateSamplePatch,
  formatCpuValue,
  formatMemoryValue
};