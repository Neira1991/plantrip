import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function corporateLandingPlugin() {
  return {
    name: 'corporate-landing',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/' || req.url === '/index.html') {
          const filePath = path.resolve(__dirname, 'corporate/index.html')
          const html = fs.readFileSync(filePath, 'utf-8')
          res.setHeader('Content-Type', 'text/html')
          res.end(html)
          return
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [corporateLandingPlugin(), react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
