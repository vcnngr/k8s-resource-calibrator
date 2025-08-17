#!/bin/bash
set -e

echo "🔨 Building KRR Management System..."

# Build backend image
echo "📦 Building backend image..."
docker build -t krr-management/backend:latest ./backend

# Build frontend image
echo "📦 Building frontend image..."
docker build -t krr-management/frontend:latest ./frontend

echo "✅ Build completed successfully!"

# Optional: Push to registry
if [ "$1" = "--push" ]; then
    echo "📤 Pushing images to registry..."
    docker push krr-management/backend:latest
    docker push krr-management/frontend:latest
    echo "✅ Images pushed successfully!"
fi