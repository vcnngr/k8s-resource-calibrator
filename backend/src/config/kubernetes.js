const k8s = require('@kubernetes/client-node');
const path = require('path');

class KubernetesConfig {
  constructor() {
    this.kc = new k8s.KubeConfig();
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (process.env.NODE_ENV === 'development') {
        // Load from default kubeconfig location
        this.kc.loadFromDefault();
      } else if (process.env.KUBECONFIG) {
        // Load from specified kubeconfig file
        this.kc.loadFromFile(process.env.KUBECONFIG);
      } else {
        // Load from in-cluster config (when running in pod)
        this.kc.loadFromCluster();
      }
      
      console.log('✅ Kubernetes config loaded successfully');
      console.log(`📍 Current context: ${this.kc.getCurrentContext()}`);
      console.log(`🔗 Current cluster: ${this.kc.getCurrentCluster()?.name || 'unknown'}`);
      
    } catch (error) {
      console.error('❌ Failed to load Kubernetes config:', error.message);
      throw new Error(`Kubernetes configuration error: ${error.message}`);
    }
  }

  getApiClient(apiClass) {
    return this.kc.makeApiClient(apiClass);
  }

  getCurrentContext() {
    return this.kc.getCurrentContext();
  }

  getCurrentCluster() {
    return this.kc.getCurrentCluster();
  }

  async testConnection() {
    try {
      const coreApi = this.getApiClient(k8s.CoreV1Api);
      const response = await coreApi.listNamespace();
      
      return {
        connected: true,
        namespaces: response.body.items.length,
        cluster: this.getCurrentCluster()?.name || 'unknown',
        context: this.getCurrentContext()
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }
}

module.exports = new KubernetesConfig();