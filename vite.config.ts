import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string }

const getGitSha = () => {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

const appVersion = process.env.VITE_APP_VERSION || packageJson.version
const buildSha = process.env.VITE_BUILD_SHA || getGitSha()
const buildTimestamp = process.env.VITE_BUILD_TIMESTAMP || new Date().toISOString()
const buildId = process.env.VITE_BUILD_ID || 'local'
const imageTag = process.env.VITE_IMAGE_TAG || `v${appVersion}-${buildSha.slice(0, 12)}`

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_SHA__: JSON.stringify(buildSha),
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
    __BUILD_ID__: JSON.stringify(buildId),
    __IMAGE_TAG__: JSON.stringify(imageTag),
  },
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'MemLumina Voice Memo',
        short_name: 'MemLumina',
        description: 'Capture thoughts instantly for your Cognitive Ledger',
        theme_color: '#0B0B0C',
        background_color: '#0B0B0C',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
