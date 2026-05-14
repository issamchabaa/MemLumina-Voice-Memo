export const buildInfo = {
  version: __APP_VERSION__,
  gitSha: __BUILD_SHA__,
  shortSha: __BUILD_SHA__ === 'unknown' ? 'unknown' : __BUILD_SHA__.slice(0, 12),
  builtAt: __BUILD_TIMESTAMP__,
  buildId: __BUILD_ID__,
  imageTag: __IMAGE_TAG__,
}

