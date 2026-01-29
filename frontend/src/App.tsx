/**
 * Главный компонент приложения с роутингом
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Shared/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { UnitEconomicsPage } from './pages/UnitEconomicsPage';
import { SyncPage } from './pages/SyncPage';
import { AdsPage } from './pages/AdsPage';

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="unit-economics" element={<UnitEconomicsPage />} />
            <Route path="products" element={<Navigate to="/unit-economics" replace />} />
            <Route path="ads" element={<AdsPage />} />
            <Route path="sync" element={<SyncPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

export default App;
