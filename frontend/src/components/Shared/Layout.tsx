/**
 * Основной Layout с навигацией
 */
import { Outlet, Link, useLocation } from 'react-router-dom';
import { BarChart3, Package, TrendingUp, RefreshCw, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

const navigation = [
  { name: 'Дашборд', href: '/', icon: BarChart3 },
  { name: 'Unit-экономика', href: '/unit-economics', icon: TrendingUp },
  { name: 'Реклама', href: '/ads', icon: Package },
  { name: 'Синхронизация', href: '/sync', icon: RefreshCw },
];

export const Layout = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header с навигацией */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <BarChart3 className="w-8 h-8 text-indigo-600" />
              <h1 className="ml-3 text-xl font-bold text-gray-900">
                Analytics Dashboard
              </h1>
            </div>

            {/* Navigation */}
            <nav className="flex space-x-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Settings */}
            <button className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
};
