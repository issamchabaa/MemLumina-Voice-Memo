# MemLumina Voice Memo Cloud Run Deployment Retrospective

Date: 2026-05-13

## Purpose

This document records the full process that was required to deploy `MemLumina-Voice-Memo` into the `sheep-db1` Google Cloud project and expose it on Cloud Run.

It is both:

- a retrospective on what happened;
- a runbook for repeating the deployment with less friction next time.

## Final Outcome

The app was successfully deployed to Cloud Run in:

- Project: `sheep-db1`
- Region: `us-central1`
- Service name: `memlumina-voice-memo`
- Public URL: `https://memlumina-voice-memo-31297412046.us-central1.run.app`

The deployed service responded successfully with `HTTP 200`.

## What Had To Be Done

The deployment was not a single command. It required work in four separate areas:

1. Confirm the correct Google Cloud project identity.
2. Register the app properly in Firebase under that project.
3. Make the application buildable for Cloud Run.
4. Produce a Cloud Run-compatible container image and deploy it.

## Chronological Trace

### 1. Verify the target project

Initial checks showed that the user-facing Firebase project name was `SHEEP-DB1`, but the actual Google Cloud project ID was `sheep-db1`.

This distinction mattered because:

- Firebase UI often emphasizes the display name;
- `gcloud` commands require the real project ID;
- Cloud Run and other GCP services reject project names where project IDs are required.

Confirmed project details:

- Project name: `SHEEP-DB1`
- Project ID: `sheep-db1`
- Project number: `31297412046`

### 2. Confirm what was already deployed

Cloud Run services were listed in `sheep-db1` to verify whether `MemLumina-Voice-Memo` already existed.

Result:

- `MemLumina-Voice-Memo` was not present in Cloud Run.

This clarified that we were not updating an existing service. We were creating a new one.

### 3. Confirm the repo was already pointed at the right Firebase project

The repository already contained:

- [`.firebaserc`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/.firebaserc:1) with default project `sheep-db1`
- Firebase integration code in [`src/firebase.ts`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/firebase.ts:1)

This meant the project-level Firebase target was already correct.

What was missing was not the Firebase project mapping, but the specific Firebase app registration for this app.

### 4. Inspect the existing Firebase apps in `sheep-db1`

Listing Firebase apps showed multiple existing web apps, including:

- `Agent_Console_1`
- `Aura AI`
- `Lumina`
- `Inspector-V1`
- `TCK Vault`
- others

`MemLumina-Voice-Memo` was not among them.

### 5. Create a new Firebase Web App for this project

A new Firebase web app was created inside `sheep-db1`:

- Display name: `MemLumina-Voice-Memo`
- App ID: `1:31297412046:web:de3064f8c161aa8a07299f`

This step was necessary because a web app needs its own Firebase app registration and app ID for client initialization.

### 6. Pull the Firebase SDK config for the new app

After app creation, the Firebase SDK config was retrieved to get:

- `projectId`
- `appId`
- `storageBucket`
- `apiKey`
- `authDomain`
- `messagingSenderId`

This was necessary because the frontend uses Vite env vars for Firebase initialization.

### 7. Update local frontend config to use the new Firebase app

The local environment file [`.env.local`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/.env.local:1) was updated so the repo no longer pointed at the older `Lumina` app registration.

The key changes were:

- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_API_KEY`

This aligned the codebase with the newly created Firebase app registration for `MemLumina-Voice-Memo`.

### 8. Validate the deployment shape of the app

Before deployment, the repository was checked for containerization support:

- [`Dockerfile`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/Dockerfile:1)
- [`nginx.conf`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/nginx.conf:1)
- [`package.json`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/package.json:1)

This confirmed:

- the app is a Vite/React static frontend;
- it is served via Nginx;
- it listens on port `8080`, which is appropriate for Cloud Run.

### 9. Discover that the Docker build would not receive Firebase env vars by default

The `.dockerignore` file excluded `.env.local`.

That is usually good hygiene, but it created a deployment issue:

- the Docker build would not automatically receive the Firebase config;
- Vite needs those values during `npm run build`;
- without them, the Cloud Run image could build incorrectly or ship a broken frontend.

### 10. Patch the Dockerfile to support build-time Firebase env vars

[`Dockerfile`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/Dockerfile:1) was updated to accept build arguments and export them into the build stage:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

This made the image build deterministic and deployable without relying on `.env.local` being copied into the container context.

### 11. Discover that Node 18 was too old for the current toolchain

The first Cloud Build attempt failed inside the Docker build with:

- `ReferenceError: crypto is not defined`

The root cause was that the build image used `node:18-alpine`, while parts of the current frontend toolchain expect Node 20+.

This was visible in build warnings and confirmed by the failure in the Vite build path.

### 12. Upgrade the Docker build stage from Node 18 to Node 20

The build stage in [`Dockerfile`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/Dockerfile:1) was changed from:

- `node:18-alpine`

to:

- `node:20-alpine`

This resolved the toolchain/runtime mismatch and allowed the production build to complete successfully.

### 13. Attempt source-based Cloud Run deployment

An initial `gcloud run deploy --source .` path was attempted with build env vars passed in.

This surfaced two problems:

- Cloud Build output was harder to inspect in a useful way from the deployment wrapper;
- the overall process was more opaque than necessary for debugging.

This was useful diagnostically, but it was not the cleanest final deployment path.

### 14. Create an explicit Cloud Build config as an intermediate fallback

A helper file was added:

- [`cloudbuild.deploy.yaml`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/cloudbuild.deploy.yaml:1)

Its purpose was to support a more explicit container build flow with defined build args.

This gave better control over the build, even though the final successful deployment path ended up using local Docker plus Artifact Registry plus Cloud Run.

### 15. Build the image locally after sandbox limits blocked the first local attempt

The first local Docker build attempt failed because the sandbox could not write to Docker’s local state under `~/.docker`.

After rerunning with appropriate permissions, the local build succeeded.

This confirmed:

- the application could now build successfully with Node 20;
- the Firebase build-time variables were correctly wired into the image build.

### 16. Push the image to Artifact Registry

Docker was authenticated against:

- `us-central1-docker.pkg.dev`

The image was then pushed to:

- `us-central1-docker.pkg.dev/sheep-db1/cloud-run-source-deploy/memlumina-voice-memo:latest`

This made the container available for image-based Cloud Run deployment.

### 17. Discover the architecture mismatch with Cloud Run

The first image-based Cloud Run deploy failed with:

- `Container manifest type 'application/vnd.oci.image.index.v1+json' must support amd64/linux`

The root cause was:

- the local machine is Apple Silicon / ARM;
- the first locally built image did not provide the `linux/amd64` image that Cloud Run requires.

### 18. Rebuild and push the image explicitly for `linux/amd64`

The image was rebuilt using Docker Buildx with:

- platform: `linux/amd64`

and pushed again to the same Artifact Registry location.

This was the critical compatibility fix for Cloud Run.

### 19. Deploy the corrected image to Cloud Run

Once the `linux/amd64` image was available, Cloud Run accepted the service deployment.

The service came up as:

- Service: `memlumina-voice-memo`
- Region: `us-central1`
- URL: `https://memlumina-voice-memo-31297412046.us-central1.run.app`

### 20. Verify the deployed service

The public URL was tested and returned:

- `HTTP/2 200`

This confirmed that the deployment was not just registered in Cloud Run, but actually serving traffic.

## Files That Were Important

### Configuration and runtime

- [`.firebaserc`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/.firebaserc:1)
- [`.env.local`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/.env.local:1)
- [`src/firebase.ts`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/firebase.ts:1)

### Containerization

- [`.dockerignore`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/.dockerignore:1)
- [`Dockerfile`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/Dockerfile:1)
- [`nginx.conf`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/nginx.conf:1)
- [`cloudbuild.deploy.yaml`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/cloudbuild.deploy.yaml:1)

### App build

- [`package.json`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/package.json:1)

## Problems Encountered

### Project name vs project ID confusion

Problem:

- `SHEEP-DB1` is the display name;
- `sheep-db1` is the actual GCP project ID.

Impact:

- `gcloud` commands failed when the display name was used where a project ID was required.

Lesson:

- Always resolve and use the actual project ID first.

### Read-only local `gcloud` config under sandboxed execution

Problem:

- `gcloud` initially could not create or update credential files under `~/.config/gcloud`.

Impact:

- authenticated `gcloud` commands failed until run with the right permissions model.

Lesson:

- when using sandboxed automation, expect `gcloud` auth/config writes to fail unless the environment explicitly permits them.

### Firebase app registration was missing

Problem:

- the project existed, but the specific Firebase web app registration for `MemLumina-Voice-Memo` did not.

Impact:

- the frontend could not be correctly associated with its own Firebase app identity.

Lesson:

- distinguish between:
  - Firebase project membership
  - Firebase app registration
  - Cloud Run deployment

These are separate layers.

### Build-time env vars were not automatically reaching the container build

Problem:

- `.env.local` was excluded from Docker build context.

Impact:

- Vite build inputs could be missing inside the container build.

Lesson:

- for frontend builds in Docker, explicitly decide how build-time env vars will be injected.

### Node version mismatch

Problem:

- Docker build used Node 18;
- frontend toolchain expected Node 20+ behavior.

Impact:

- build failure during production compile.

Lesson:

- pin a build image version that matches the actual toolchain requirements.

### Cloud Run architecture mismatch

Problem:

- the first pushed image did not support `linux/amd64`.

Impact:

- Cloud Run refused to serve the revision.

Lesson:

- when building on Apple Silicon, always be deliberate about target platform for Cloud Run.

## What Actually Worked Best

The most reliable working path was:

1. Create the Firebase web app.
2. Update local Firebase env vars to the new app.
3. Build the container with Node 20.
4. Inject Firebase values at Docker build time.
5. Build and push an explicit `linux/amd64` image.
6. Deploy that image to Cloud Run.
7. Verify the public URL with an HTTP check.

This was more reliable than relying only on `gcloud run deploy --source .`.

## Recommended Standard Procedure For Next Time

### Prerequisites

- Confirm the target GCP project ID.
- Confirm the target Firebase web app already exists.
- Confirm the repo’s env vars point to the intended Firebase app.
- Confirm Docker build stage uses a supported Node version.
- Confirm the target platform is `linux/amd64`.

### Recommended sequence

1. Register the Firebase web app if it does not already exist.
2. Retrieve the Firebase SDK config for that app.
3. Update env var wiring used by the frontend build.
4. Build the image with explicit build args.
5. Build for `linux/amd64`.
6. Push to Artifact Registry.
7. Deploy to Cloud Run using `--image`.
8. Verify with both:
   - `gcloud run services describe`
   - `curl -I <service-url>`

### Prefer image-based deploys over source-based deploys for this app

For this project, image-based deployment is the better default because:

- the build-time env vars are important;
- architecture matters;
- Docker build behavior needs to be predictable;
- debugging is much easier when build and deploy are separate steps.

## Suggested Runbook Commands

These are the command categories that proved useful:

- `firebase apps:list --project sheep-db1`
- `firebase apps:create WEB MemLumina-Voice-Memo --project sheep-db1`
- `firebase apps:sdkconfig WEB <APP_ID> --project sheep-db1`
- `docker buildx build --platform linux/amd64 ... --push`
- `gcloud run deploy memlumina-voice-memo --image=... --project=sheep-db1 --region=us-central1 --allow-unauthenticated`
- `gcloud run services describe memlumina-voice-memo --project=sheep-db1 --region=us-central1`
- `curl -I https://memlumina-voice-memo-31297412046.us-central1.run.app`

## Recommended Follow-Up Improvements

### 1. Commit the deployment assets intentionally

The following files should be reviewed and committed if they are meant to remain part of the deployment workflow:

- [`.dockerignore`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/.dockerignore:1)
- [`Dockerfile`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/Dockerfile:1)
- [`nginx.conf`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/nginx.conf:1)
- [`cloudbuild.deploy.yaml`](/Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/cloudbuild.deploy.yaml:1)

### 2. Decide how secrets and public config should be handled

Firebase web config is usually public-facing configuration rather than a secret in the strict sense, but the build process should still be standardized.

Options:

- keep using build args;
- move to a checked-in non-secret environment template for public Firebase config;
- or generate config via CI/CD.

### 3. Add a first-class deployment script

A script such as `scripts/deploy-cloud-run.sh` would reduce manual error and document the intended path in executable form.

### 4. Add a deployment checklist to the repo

A short checklist would help future deployments verify:

- project ID
- Firebase app ID
- target region
- Node version
- target platform
- Artifact Registry path
- final URL verification

## Bottom Line

This deployment succeeded, but only after separating three concerns that were easy to conflate:

- Firebase project and app registration
- frontend build correctness
- Cloud Run container compatibility

The key technical lessons were:

- always use the real project ID, not the project display name;
- treat Firebase app creation as a separate required step;
- pass Vite config into the Docker build explicitly;
- use Node 20 for this project’s production build;
- build for `linux/amd64` when targeting Cloud Run from Apple Silicon.

If we follow that sequence from the start next time, this should be a much shorter deployment.
