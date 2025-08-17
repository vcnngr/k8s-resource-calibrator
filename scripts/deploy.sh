#!/bin/bash
set -e

NAMESPACE="krr-management"
KUBECONFIG=${KUBECONFIG:-~/.kube/config}

echo "🚀 Deploying KRR Management System to Kubernetes..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Check cluster connection
echo "🔍 Checking cluster connection..."
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster. Check your kubeconfig."
    exit 1
fi

# Create namespace
echo "📁 Creating namespace..."
kubectl apply -f kubernetes/namespace.yaml

# Apply RBAC
echo "🔐 Setting up RBAC..."
kubectl apply -f kubernetes/rbac.yaml

# Apply ConfigMap
echo "⚙️  Applying configuration..."
kubectl apply -f kubernetes/configmap.yaml

# Deploy PostgreSQL
echo "🐘 Deploying PostgreSQL..."
kubectl apply -f kubernetes/postgres.yaml

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=database -n $NAMESPACE --timeout=300s

# Deploy backend
echo "🔧 Deploying backend..."
kubectl apply -f kubernetes/backend.yaml

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=backend -n $NAMESPACE --timeout=300s

# Deploy frontend
echo "🌐 Deploying frontend..."
kubectl apply -f kubernetes/frontend.yaml

# Wait for frontend to be ready
echo "⏳ Waiting for frontend to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=frontend -n $NAMESPACE --timeout=300s

# Deploy ingress
echo "🔗 Setting up ingress..."
kubectl apply -f kubernetes/ingress.yaml

echo "✅ Deployment completed successfully!"
echo ""
echo "📊 Deployment status:"
kubectl get pods -n $NAMESPACE
echo ""
echo "🔗 Services:"
kubectl get services -n $NAMESPACE
echo ""
echo "🌐 Ingress:"
kubectl get ingress -n $NAMESPACE

# Optional: Port forward for local access
if [ "$1" = "--port-forward" ]; then
    echo ""
    echo "🔌 Setting up port forwarding for local access..."
    echo "Frontend will be available at: http://localhost:8080"
    echo "Backend API will be available at: http://localhost:8081"
    echo "Press Ctrl+C to stop port forwarding..."
    
    kubectl port-forward -n $NAMESPACE service/krr-management-frontend 8080:80 &
    kubectl port-forward -n $NAMESPACE service/krr-management-backend 8081:3001 &
    
    wait
fi