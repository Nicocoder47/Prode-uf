import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught error', error, info)
  }

  reset() {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-400/20 bg-red-500/10 p-10 text-center text-white">
          <p className="text-lg font-semibold">Se produjo un error inesperado.</p>
          <p className="mt-3 text-sm text-slate-200">Recarga la página para continuar o revisa la consola para más detalles.</p>
        </div>
      )
    }

    return this.props.children
  }
}
