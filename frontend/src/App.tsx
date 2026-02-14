/**
 * Главный компонент приложения с роутингом
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Shared/Layout';
import { ProtectedRoute } from './components/Shared/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { UnitEconomicsPage } from './pages/UnitEconomicsPage';
import { SyncPage } from './pages/SyncPage';
import { AdsPage } from './pages/AdsPage';
import { PrintPage } from './pages/PrintPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import { LandingPage } from './pages/LandingPage';
import { LegalPage, PolicyPage, PrivacyPage } from './pages/LegalPages';
import OrderMonitorPage from './pages/OrderMonitorPage';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/useAuthStore';

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
      {/* Login — без защиты */}
      <Route path="/login" element={<LoginPage />} />

      {/* Print page — без Layout, авторизация через ?token= */}
      <Route path="/print" element={<PrintPage />} />

      {/* Legal pages — доступны всем */}
      <Route path="/legal" element={<LegalPage />} />
      <Route path="/policy" element={<PolicyPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      {/* Root: Landing (unauth) / App (auth) */}
      <Route path="/" element={<RootLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="orders" element={<OrderMonitorPage />} />
        <Route path="unit-economics" element={<UnitEconomicsPage />} />
        <Route path="products" element={<Navigate to="/unit-economics" replace />} />
        <Route path="ads" element={<AdsPage />} />
        <Route path="sync" element={<SyncPage />} />
        <Route path="settings" element={<SettingsPage />} />
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
