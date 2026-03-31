/**
 * Главный компонент приложения с роутингом
 * Code splitting: тяжёлые страницы загружаются лениво
 */
import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Shared/Layout';
import { ProtectedRoute } from './components/Shared/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { LandingPage } from './pages/landing/LandingPage';
import { LegalPage, PolicyPage, PrivacyPage } from './pages/LegalPages';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/useAuthStore';

// Lazy-loaded pages (code splitting)
const UnitEconomicsPage = lazy(() => import('./pages/UnitEconomicsPage').then(m => ({ default: m.UnitEconomicsPage })));
const AdsPage = lazy(() => import('./pages/AdsPage').then(m => ({ default: m.AdsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PrintPage = lazy(() => import('./pages/PrintPage').then(m => ({ default: m.PrintPage })));
const OrderMonitorPage = lazy(() => import('./pages/OrderMonitorPage'));
const DashboardV3PreviewPage = lazy(() => import('./pages/DashboardV3PreviewPage').then(m => ({ default: m.DashboardV3PreviewPage })));

function LazyFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
    </div>
  );
}

// Создаём QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 минут
    },
  },
});

/**
 * Root layout: landing for unauthenticated, protected app for authenticated.
 * Child routes (Outlet) only render when authenticated (Layout has Outlet).
 */
function RootLayout() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  );
}

function AppRoutes() {
  // Инициализируем auth listener
  useAuth();

  return (
    <Routes>
      {/* Login / Reset password — без защиты */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Print page — без Layout, авторизация через ?token= */}
      <Route path="/print" element={<Suspense fallback={<LazyFallback />}><PrintPage /></Suspense>} />

      {/* Legal pages — доступны всем */}
      <Route path="/legal" element={<LegalPage />} />
      <Route path="/policy" element={<PolicyPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      {/* Root: Landing (unauth) / App (auth) */}
      <Route path="/" element={<RootLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="dashboard-v3" element={<Suspense fallback={<LazyFallback />}><DashboardV3PreviewPage /></Suspense>} />
        <Route path="orders" element={<Suspense fallback={<LazyFallback />}><OrderMonitorPage /></Suspense>} />
        <Route path="unit-economics" element={<Suspense fallback={<LazyFallback />}><UnitEconomicsPage /></Suspense>} />
        <Route path="products" element={<Navigate to="/unit-economics" replace />} />
        <Route path="ads" element={<Suspense fallback={<LazyFallback />}><AdsPage /></Suspense>} />
        <Route path="sync" element={<Navigate to="/settings?tab=connections" replace />} />
        <Route path="settings" element={<Suspense fallback={<LazyFallback />}><SettingsPage /></Suspense>} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

export default App;
