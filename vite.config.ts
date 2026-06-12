import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined

  if (id.includes('framer-motion')) return 'framer-motion'
  if (id.includes('@supabase')) return 'supabase'
  if (id.includes('@tanstack/react-query') || id.includes('@tanstack/query-core')) return 'react-query'
  if (id.includes('react-router') || id.includes('@remix-run/router')) return 'react-router'
  if (id.includes('lucide-react')) return 'lucide'
  if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('scheduler')) {
    return 'react-vendor'
  }

  return undefined
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001'

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            return vendorChunk(id)
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5174,
      strictPort: true,
      proxy:
        mode === 'development'
          ? {
              '/api': {
                target: apiProxyTarget,
                changeOrigin: true,
              },
            }
          : undefined,
    },
  }
})
