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
import { useAuth } from './hooks/useAuth';

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

function AppRoutes() {
  // Инициализируем auth listener
  useAuth();

  return (
    <Routes>
      {/* Login — без защиты */}
      <Route path="/login" element={<LoginPage />} />

      {/* Print page — без Layout, авторизация через ?token= */}
      <Route path="/print" element={<PrintPage />} />

      {/* Защищённые маршруты */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="unit-economics" element={<UnitEconomicsPage />} />
        <Route path="products" element={<Navigate to="/unit-economics" replace />} />
        <Route path="ads" element={<AdsPage />} />
        <Route path="sync" element={<SyncPage />} />
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
