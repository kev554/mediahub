import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const certificateDirectory = fileURLToPath(new URL('./.devcerts/', import.meta.url))
const certificatePath = join(certificateDirectory, 'lan.pem')
const privateKeyPath = join(certificateDirectory, 'lan-key.pem')

const httpsOptions =
  existsSync(certificatePath) && existsSync(privateKeyPath)
    ? {
        cert: readFileSync(certificatePath),
        key: readFileSync(privateKeyPath),
      }
    : undefined

export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',
    ...(httpsOptions ? { https: httpsOptions } : {}),

    allowedHosts: [
      'owmpc-205-237-110-234.free.pinggy.net',
    ],

    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
