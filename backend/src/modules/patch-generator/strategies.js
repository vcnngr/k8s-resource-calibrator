// backend/src/modules/patch-generator/strategies.js
/**
 * Definisce le strategie per l'applicazione delle patch
 */

const strategies = {
    conservative: {
        name: 'conservative',
        description: 'Applica solo riduzioni significative (>20%) per ridurre il rischio',
        preserveLimits: true,
        minReductionPercentage: 20,
        maxIncreasePercentage: 10,
        applyCpuStrategy: function(current, recommended) {
            if (!current || !recommended) return null;
            
            const reduction = ((current - recommended) / current) * 100;
            
            // Solo riduzioni significative
            if (reduction >= this.minReductionPercentage) {
                return recommended;
            }
            
            // Piccoli aumenti permessi
            if (reduction < 0 && Math.abs(reduction) <= this.maxIncreasePercentage) {
                return recommended;
            }
            
            return null; // Non applica la modifica
        },
        applyMemoryStrategy: function(current, recommended) {
            if (!current || !recommended) return null;
            
            const reduction = ((current - recommended) / current) * 100;
            
            if (reduction >= this.minReductionPercentage) {
                return recommended;
            }
            
            if (reduction < 0 && Math.abs(reduction) <= this.maxIncreasePercentage) {
                return recommended;
            }
            
            return null;
        }
    },

    aggressive: {
        name: 'aggressive',
        description: 'Applica tutte le raccomandazioni per massimizzare i risparmi',
        preserveLimits: false,
        minReductionPercentage: 0,
        maxIncreasePercentage: 50,
        applyCpuStrategy: function(current, recommended) {
            return recommended; // Applica sempre
        },
        applyMemoryStrategy: function(current, recommended) {
            return recommended; // Applica sempre
        }
    },

    balanced: {
        name: 'balanced',
        description: 'Bilancia risparmi e stabilità',
        preserveLimits: true,
        minReductionPercentage: 10,
        maxIncreasePercentage: 25,
        applyCpuStrategy: function(current, recommended) {
            if (!current || !recommended) return null;
            
            const reduction = ((current - recommended) / current) * 100;
            
            if (reduction >= this.minReductionPercentage) {
                return recommended;
            }
            
            if (reduction < 0 && Math.abs(reduction) <= this.maxIncreasePercentage) {
                return recommended;
            }
            
            return null;
        },
        applyMemoryStrategy: function(current, recommended) {
            if (!current || !recommended) return null;
            
            const reduction = ((current - recommended) / current) * 100;
            
            // Più permissivo per la memoria
            if (reduction >= this.minReductionPercentage * 0.5) {
                return recommended;
            }
            
            if (reduction < 0 && Math.abs(reduction) <= this.maxIncreasePercentage) {
                return recommended;
            }
            
            return null;
        }
    },

    custom: {
        name: 'custom',
        description: 'Strategia personalizzabile',
        preserveLimits: true,
        minReductionPercentage: 15,
        maxIncreasePercentage: 20,
        customRules: {},
        applyCpuStrategy: function(current, recommended) {
            // Implementazione personalizzabile
            return this.applyCustomLogic('cpu', current, recommended);
        },
        applyMemoryStrategy: function(current, recommended) {
            return this.applyCustomLogic('memory', current, recommended);
        },
        applyCustomLogic: function(resourceType, current, recommended) {
            if (!current || !recommended) return null;
            
            const reduction = ((current - recommended) / current) * 100;
            const rules = this.customRules[resourceType] || {};
            
            const minReduction = rules.minReductionPercentage || this.minReductionPercentage;
            const maxIncrease = rules.maxIncreasePercentage || this.maxIncreasePercentage;
            
            if (reduction >= minReduction) {
                return recommended;
            }
            
            if (reduction < 0 && Math.abs(reduction) <= maxIncrease) {
                return recommended;
            }
            
            return null;
        }
    }
};

/**
 * Valida e restituisce una strategia
 */
function validatePatchStrategy(strategyName, customConfig = {}) {
    const strategy = strategies[strategyName];
    
    if (!strategy) {
        throw new Error(`Strategia non valida: ${strategyName}. Disponibili: ${Object.keys(strategies).join(', ')}`);
    }
    
    // Clone della strategia per evitare modifiche globali
    const clonedStrategy = JSON.parse(JSON.stringify(strategy));
    
    // Applica configurazione personalizzata se fornita
    if (strategyName === 'custom' && customConfig) {
        Object.assign(clonedStrategy, customConfig);
    }
    
    // Rebind delle funzioni (perse durante JSON.parse/stringify)
    Object.setPrototypeOf(clonedStrategy, strategy);
    
    return clonedStrategy;
}

/**
 * Ottiene tutte le strategie disponibili
 */
function getAvailableStrategies() {
    return Object.keys(strategies).map(name => ({
        name,
        description: strategies[name].description,
        preserveLimits: strategies[name].preserveLimits,
        minReductionPercentage: strategies[name].minReductionPercentage,
        maxIncreasePercentage: strategies[name].maxIncreasePercentage
    }));
}

module.exports = {
    strategies,
    validatePatchStrategy,
    getAvailableStrategies
};