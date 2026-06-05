import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth.tsx'
import { ReactQueryProvider } from './lib/queryClient.ts'
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ReactQueryProvider>
        <ErrorBoundary>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ErrorBoundary>
      </ReactQueryProvider>
    </BrowserRouter>
  </StrictMode>,
)
