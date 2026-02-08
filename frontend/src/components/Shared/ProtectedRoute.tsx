import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useTokensStatus } from '../../hooks/useTokens';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  const location = useLocation();
  const { data: tokensStatus, isLoading: tokensLoading } = useTokensStatus();

  if (isLoading || (user && tokensLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Onboarding: если нет токенов — редирект на /settings (кроме самого /settings)
  const hasAnyTokens = tokensStatus?.has_wb || tokensStatus?.has_ozon_seller;
  if (!hasAnyTokens && location.pathname !== '/settings') {
    return <Navigate to="/settings" replace state={{ onboarding: true }} />;
  }

  return <>{children}</>;
}
