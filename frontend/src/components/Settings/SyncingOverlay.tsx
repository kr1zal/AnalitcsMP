import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, ArrowRight, Database, Loader2 } from 'lucide-react';
import { syncApi } from '../../services/api';
import { useQueryClient } from '@tanstack/react-query';

// ─── Animated progress bar (logarithmic curve) ───

function SyncProgressBar({ startedAt }: { startedAt: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const p = Math.min(92, 15 * Math.log(elapsed / 10 + 1) + elapsed * 0.15);
      setProgress(Math.max(0, p));
    }, 500);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-500 transition-all duration-500 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ─── Syncing screen ───

function SyncingScreen({ startedAt }: { startedAt: number }) {
  const [dots, setDots] = useState('');
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 600);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="mb-8">
        <div className="w-16 h-16 mx-auto mb-6 bg-indigo-100 rounded-2xl flex items-center justify-center">
          <Database className="w-8 h-8 text-indigo-600 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Загружаем ваши данные{dots}
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          Собираем продажи, заказы, издержки и рекламу<br />
          с Wildberries и Ozon за последние 30 дней.
        </p>
      </div>
      <div className="mb-4">
        <SyncProgressBar startedAt={startedAt} />
      </div>
      <p className="text-xs text-gray-400">
        Прошло: {minutes > 0 ? `${minutes} мин ` : ''}{String(seconds).padStart(2, '0')} сек
      </p>
      <p className="mt-8 text-xs text-gray-400">
        Не закрывайте страницу — мы сообщим, когда всё будет готово
      </p>
    </div>
  );
}

// ─── Done screen ───

interface SyncStats {
  productsCount: number;
  syncTypes: number;
}

function SyncDoneScreen({ onNavigate }: { onNavigate: () => void }) {
  const [stats, setStats] = useState<SyncStats | null>(null);

  useEffect(() => {
    syncApi.getLogs(20).then((res) => {
      if (!res.logs?.length) return;
      const productsLog = res.logs.find(
        (l) => l.sync_type === 'products' && l.status === 'success'
      );
      const successTypes = new Set(
        res.logs.filter((l) => l.status === 'success').map((l) => l.sync_type)
      );
      setStats({
        productsCount: productsLog?.records_count ?? 0,
        syncTypes: successTypes.size,
      });
    }).catch(() => { /* ignore */ });
  }, []);

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="mb-8">
        <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-2xl flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Данные готовы!
        </h2>
        {stats && stats.productsCount > 0 ? (
          <p className="text-sm text-gray-500 leading-relaxed">
            Загружено товаров: <span className="font-medium text-gray-700">{stats.productsCount}</span>
            {stats.syncTypes > 1 && (
              <> &middot; Синхронизировано {stats.syncTypes} типов данных</>
            )}
          </p>
        ) : (
          <p className="text-sm text-gray-500 leading-relaxed">
            Мы загрузили ваши данные с маркетплейсов.<br />
            Дашборд, юнит-экономика и отчёты уже доступны.
          </p>
        )}
      </div>
      <button
        onClick={onNavigate}
        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
      >
        Перейти к отчётам
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Main overlay controller ───

type SyncPhase = 'idle' | 'syncing' | 'done';

interface SyncingOverlayProps {
  active: boolean;
  startedAt: number;
  onDone: () => void;
  onNavigate: () => void;
}

export function SyncingOverlay({ active, startedAt, onDone, onNavigate }: SyncingOverlayProps) {
  const queryClient = useQueryClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [phase, setPhase] = useState<SyncPhase>('idle');

  // Reset phase when active transitions from false to true
  useEffect(() => {
    if (active) {
      setPhase('syncing');
    } else {
      setPhase('idle');
    }
  }, [active]);

  // Start polling when active
  const checkSyncStatus = useCallback(async () => {
    try {
      const syncStatus = await syncApi.getStatus();
      if (!syncStatus.is_syncing) {
        setPhase('done');
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        queryClient.invalidateQueries({ queryKey: ['tokens'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['sync'] });
        onDone();
      }
    } catch {
      // continue polling
    }
  }, [queryClient, onDone]);

  useEffect(() => {
    if (phase === 'syncing') {
      const timeout = setTimeout(() => {
        checkSyncStatus();
        pollRef.current = setInterval(checkSyncStatus, 5000);
      }, 5000);
      return () => {
        clearTimeout(timeout);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }
  }, [phase, checkSyncStatus]);

  if (!active && phase === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
      {phase === 'syncing' && <SyncingScreen startedAt={startedAt} />}
      {phase === 'done' && <SyncDoneScreen onNavigate={onNavigate} />}
      {phase === 'idle' && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
        </div>
      )}
    </div>
  );
}
