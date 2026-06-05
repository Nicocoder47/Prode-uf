import type { ReactNode } from 'react';
import { AlertCircle, Loader2, Inbox } from 'lucide-react';
import { emptyStateMessage } from '../../utils/emptyState';

type DataStateProps = {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  loadingMessage?: string;
  errorMessage?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  children?: ReactNode;
  className?: string;
};

export function DataState({
  isLoading,
  isError,
  isEmpty,
  loadingMessage = 'Cargando...',
  errorMessage = 'No pudimos cargar los datos. Intentá de nuevo.',
  emptyMessage = 'No hay datos disponibles.',
  onRetry,
  children,
  className = '',
}: DataStateProps) {
  if (isLoading) {
    return (
      <div className={`wc26-card flex items-center justify-center gap-2 p-8 text-sm text-wc26-text/55 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-wc26-green" />
        {loadingMessage}
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`wc26-card p-8 text-center ${className}`}>
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-wc26-red" />
        <p className="text-sm font-semibold text-wc26-text/70">{errorMessage}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="wc26-btn-primary mt-4 px-5 py-2 text-sm">
            Reintentar
          </button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={`wc26-card flex flex-col items-center gap-2 p-8 text-center ${className}`}>
        <Inbox className="h-8 w-8 text-wc26-text/30" />
        <p className="text-sm text-wc26-text/55">{emptyStateMessage(emptyMessage)}</p>
      </div>
    );
  }

  return <>{children}</>;
}
