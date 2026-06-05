import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

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
    server: {
      host: '0.0.0.0',
      port: 5174,
      strictPort: true,
      // Proxy solo en desarrollo local — producción usa VITE_API_BASE_URL (Vercel → Oracle)
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
