#!/bin/bash
set -e

# Load env vars
export $(grep -v '^#' .env.local | xargs)

echo "Building docker image..."
docker buildx build --platform linux/amd64 \
  --build-arg VITE_FIREBASE_API_KEY="$VITE_FIREBASE_API_KEY" \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="$VITE_FIREBASE_AUTH_DOMAIN" \
  --build-arg VITE_FIREBASE_PROJECT_ID="$VITE_FIREBASE_PROJECT_ID" \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET="$VITE_FIREBASE_STORAGE_BUCKET" \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="$VITE_FIREBASE_MESSAGING_SENDER_ID" \
  --build-arg VITE_FIREBASE_APP_ID="$VITE_FIREBASE_APP_ID" \
  -t us-central1-docker.pkg.dev/sheep-db1/cloud-run-source-deploy/memlumina-voice-memo:latest \
  --push .

echo "Deploying to Cloud Run..."
gcloud run deploy memlumina-voice-memo \
  --image=us-central1-docker.pkg.dev/sheep-db1/cloud-run-source-deploy/memlumina-voice-memo:latest \
  --project=sheep-db1 \
  --region=us-central1 \
  --allow-unauthenticated

echo "Deployment complete."
