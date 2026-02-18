/**
 * SettingsTabs — vertical sidebar (md+) / horizontal scroll pills (mobile).
 */
import { Link2, Package, CreditCard, User } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SettingsTabId = 'connections' | 'products' | 'billing' | 'profile';

interface TabDef {
  id: SettingsTabId;
  label: string;
  icon: typeof Link2;
}

const TABS: TabDef[] = [
  { id: 'connections', label: 'Подключения', icon: Link2 },
  { id: 'products', label: 'Товары', icon: Package },
  { id: 'billing', label: 'Тариф', icon: CreditCard },
  { id: 'profile', label: 'Профиль', icon: User },
];

interface SettingsTabsProps {
  activeTab: SettingsTabId;
  onChange: (tab: SettingsTabId) => void;
}

export function SettingsTabs({ activeTab, onChange }: SettingsTabsProps) {
  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav role="tablist" aria-label="Настройки" className="hidden md:flex flex-col gap-1 min-w-[180px]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-left',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Mobile: horizontal scroll pills */}
      <div role="tablist" aria-label="Настройки" className="md:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-full whitespace-nowrap transition-colors flex-shrink-0',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
