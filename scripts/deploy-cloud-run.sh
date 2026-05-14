#!/bin/bash
set -euo pipefail

# Load env vars
if [[ -f .env.local ]]; then
  set -a
  source .env.local
  set +a
fi

IMAGE_REPO="${IMAGE_REPO:-us-central1-docker.pkg.dev/sheep-db1/cloud-run-source-deploy/memlumina-voice-memo}"
APP_VERSION="${APP_VERSION:-$(node -p "require('./package.json').version")}"
BUILD_SHA="${BUILD_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
SHORT_SHA="${BUILD_SHA:0:12}"
BUILD_TIMESTAMP="${BUILD_TIMESTAMP:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
BUILD_ID="${BUILD_ID:-local}"
IMAGE_TAG="${IMAGE_TAG:-v${APP_VERSION}-${SHORT_SHA}}"
IMAGE="${IMAGE_REPO}:${IMAGE_TAG}"
LABEL_APP_VERSION="${APP_VERSION//./-}"
LABEL_IMAGE_TAG="${IMAGE_TAG//./-}"

echo "Building docker image ${IMAGE}..."
docker buildx build --platform linux/amd64 \
  --build-arg VITE_FIREBASE_API_KEY="$VITE_FIREBASE_API_KEY" \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="$VITE_FIREBASE_AUTH_DOMAIN" \
  --build-arg VITE_FIREBASE_PROJECT_ID="$VITE_FIREBASE_PROJECT_ID" \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET="$VITE_FIREBASE_STORAGE_BUCKET" \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="$VITE_FIREBASE_MESSAGING_SENDER_ID" \
  --build-arg VITE_FIREBASE_APP_ID="$VITE_FIREBASE_APP_ID" \
  --build-arg VITE_APP_VERSION="$APP_VERSION" \
  --build-arg VITE_BUILD_SHA="$BUILD_SHA" \
  --build-arg VITE_BUILD_TIMESTAMP="$BUILD_TIMESTAMP" \
  --build-arg VITE_BUILD_ID="$BUILD_ID" \
  --build-arg VITE_IMAGE_TAG="$IMAGE_TAG" \
  -t "$IMAGE" \
  -t "$IMAGE_REPO:latest" \
  --push .

echo "Deploying to Cloud Run..."
gcloud run deploy memlumina-voice-memo \
  --image="$IMAGE" \
  --project=sheep-db1 \
  --region=us-central1 \
  --labels="app-version=${LABEL_APP_VERSION},commit-sha=${SHORT_SHA},image-tag=${LABEL_IMAGE_TAG}" \
  --allow-unauthenticated

echo "Deployment complete: ${IMAGE}"
