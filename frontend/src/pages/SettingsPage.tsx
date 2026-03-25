/**
 * SettingsPage — unified tab controller.
 * Tabs: Подключения | Товары | План продаж | Тариф | Профиль
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { syncApi } from '../services/api';
import { SettingsTabs } from '../components/Settings/SettingsTabs';
import { ConnectionsTab } from '../components/Settings/ConnectionsTab';
import { ProductsTab } from '../components/Settings/ProductsTab';
import { PlanTab } from '../components/Settings/PlanTab';
import { BillingTab } from '../components/Settings/BillingTab';
import { ProfileTab } from '../components/Settings/ProfileTab';
import { SyncingOverlay } from '../components/Settings/SyncingOverlay';
import type { SettingsTabId } from '../components/Settings/SettingsTabs';

const VALID_TABS: SettingsTabId[] = ['connections', 'products', 'plan', 'billing', 'profile'];

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isOnboarding = (location.state as { onboarding?: boolean } | null)?.onboarding === true;

  // Tab from URL or default
  const tabParam = searchParams.get('tab') as SettingsTabId | null;
  const activeTab: SettingsTabId = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'connections';

  // If ?payment= present, redirect to billing tab
  useEffect(() => {
    if (searchParams.get('payment') && activeTab !== 'billing') {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', 'billing');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, activeTab, setSearchParams]);

  const handleTabChange = (tab: SettingsTabId) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams, { replace: true });
  };

  // Syncing overlay state
  const [syncActive, setSyncActive] = useState(false);
  const [syncStartedAt, setSyncStartedAt] = useState(0);

  const handleStartSync = (startedAt: number) => {
    setSyncStartedAt(startedAt);
    setSyncActive(true);
  };

  const handleSyncDone = useCallback(() => {
    // overlay will show done screen
  }, []);

  const handleSyncNavigate = () => {
    setSyncActive(false);
    navigate('/', { replace: true });
  };

  // Check if sync is already running on mount (F5 during sync)
  useEffect(() => {
    let cancelled = false;
    async function checkInitialSync() {
      try {
        const syncStatus = await syncApi.getStatus();
        if (!cancelled && syncStatus.is_syncing) {
          setSyncStartedAt(Date.now());
          setSyncActive(true);
        }
      } catch {
        // ignore
      }
    }
    checkInitialSync();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <SyncingOverlay
        active={syncActive}
        startedAt={syncStartedAt}
        onDone={handleSyncDone}
        onNavigate={handleSyncNavigate}
      />

      <div className="max-w-[1600px] mx-auto px-4 py-6 sm:py-10 min-h-[calc(100vh-4rem)]">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Настройки</h1>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Tab navigation */}
          <SettingsTabs activeTab={activeTab} onChange={handleTabChange} />

          {/* Tab content */}
          <div className="flex-1 min-w-0" role="tabpanel" id={`panel-${activeTab}`}>
            {activeTab === 'connections' && (
              <ConnectionsTab isOnboarding={isOnboarding} onStartSync={handleStartSync} />
            )}
            {activeTab === 'products' && <ProductsTab />}
            {activeTab === 'plan' && <PlanTab />}
            {activeTab === 'billing' && <BillingTab />}
            {activeTab === 'profile' && <ProfileTab />}
          </div>
        </div>
      </div>
    </>
  );
}
