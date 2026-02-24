/**
 * TelegramSection — Telegram bot binding & notification settings.
 * Displayed inside ProfileTab.
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Unlink, Loader2, Bell, Clock, Package } from 'lucide-react';
import { toast } from 'sonner';
import { telegramApi } from '../../services/api';
import type { TelegramSettings } from '../../types';

// ─── Not linked state ───

function TelegramConnect() {
  const [linkData, setLinkData] = useState<{ link: string; expires_in: number } | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const result = await telegramApi.generateToken();
      setLinkData({ link: result.link, expires_in: result.expires_in });
    } catch {
      toast.error('Не удалось создать ссылку');
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleCopy = useCallback(() => {
    if (linkData?.link) {
      navigator.clipboard.writeText(linkData.link);
      toast.success('Ссылка скопирована');
    }
  }, [linkData]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Подключите Telegram, чтобы получать ежедневные сводки продаж и алерты остатков.
      </p>

      {!linkData ? (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#2AABEE] rounded-lg hover:bg-[#229ED9] disabled:opacity-50 transition-colors"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Подключить Telegram
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <a
              href={linkData.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#2AABEE] rounded-lg hover:bg-[#229ED9] transition-colors"
            >
              <Send className="w-4 h-4" />
              Открыть в Telegram
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Копировать
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Ссылка действительна 5 минут. Нажмите и привяжите аккаунт в боте.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Time picker (simple select) ───

interface TimeSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function TimeSelect({ value, onChange, disabled }: TimeSelectProps) {
  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100"
    >
      {hours.map((h) => (
        <option key={h} value={h}>{h} МСК</option>
      ))}
    </select>
  );
}

// ─── Linked state with settings ───

interface TelegramLinkedProps {
  username: string | null;
  settings: TelegramSettings;
  linkedAt: string | null;
}

function TelegramLinked({ username, settings, linkedAt }: TelegramLinkedProps) {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<TelegramSettings>(settings);
  const [saving, setSaving] = useState(false);

  const unlinkMutation = useMutation({
    mutationFn: telegramApi.unlink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-link-status'] });
      toast.success('Telegram отключен');
    },
    onError: () => {
      toast.error('Ошибка отключения');
    },
  });

  const handleSaveSettings = useCallback(async (newSettings: TelegramSettings) => {
    setLocalSettings(newSettings);
    setSaving(true);
    try {
      await telegramApi.updateSettings(newSettings);
      queryClient.invalidateQueries({ queryKey: ['telegram-link-status'] });
    } catch {
      toast.error('Ошибка сохранения настроек');
      setLocalSettings(settings); // revert
    } finally {
      setSaving(false);
    }
  }, [settings, queryClient]);

  const toggleField = useCallback((field: keyof TelegramSettings) => {
    const newSettings = { ...localSettings, [field]: !localSettings[field] };
    handleSaveSettings(newSettings);
  }, [localSettings, handleSaveSettings]);

  const updateTime = useCallback((field: 'morning_time' | 'evening_time', value: string) => {
    const newSettings = { ...localSettings, [field]: value };
    handleSaveSettings(newSettings);
  }, [localSettings, handleSaveSettings]);

  const linkedDate = linkedAt ? new Date(linkedAt).toLocaleDateString('ru-RU') : null;

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm text-gray-900 font-medium">
            Подключен {username ? `@${username}` : ''}
          </span>
          {linkedDate && (
            <span className="text-xs text-gray-400">с {linkedDate}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => unlinkMutation.mutate()}
          disabled={unlinkMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {unlinkMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Unlink className="w-3 h-3" />
          )}
          Отключить
        </button>
      </div>

      {/* Notification settings */}
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
        {/* Morning summary */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-900">Утренняя сводка</p>
              <p className="text-xs text-gray-500">Итоги предыдущего дня</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TimeSelect
              value={localSettings.morning_time}
              onChange={(v) => updateTime('morning_time', v)}
              disabled={!localSettings.daily_summary || saving}
            />
            <button
              type="button"
              onClick={() => toggleField('daily_summary')}
              disabled={saving}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                localSettings.daily_summary ? 'bg-indigo-600' : 'bg-gray-200'
              } ${saving ? 'opacity-50' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 mt-0.5 ${
                  localSettings.daily_summary ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Evening summary */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-900">Вечерняя сводка</p>
              <p className="text-xs text-gray-500">Итоги текущего дня</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TimeSelect
              value={localSettings.evening_time}
              onChange={(v) => updateTime('evening_time', v)}
              disabled={!localSettings.evening_enabled || saving}
            />
            <button
              type="button"
              onClick={() => toggleField('evening_enabled')}
              disabled={saving}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                localSettings.evening_enabled ? 'bg-indigo-600' : 'bg-gray-200'
              } ${saving ? 'opacity-50' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 mt-0.5 ${
                  localSettings.evening_enabled ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Stock alerts */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Package className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-900">Алерты остатков</p>
              <p className="text-xs text-gray-500">Когда остатков менее 7 дней</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleField('stock_alerts')}
            disabled={saving}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
              localSettings.stock_alerts ? 'bg-indigo-600' : 'bg-gray-200'
            } ${saving ? 'opacity-50' : ''}`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 mt-0.5 ${
                localSettings.stock_alerts ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {saving && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Сохранение...
        </p>
      )}
    </div>
  );
}

// ─── Main export ───

export function TelegramSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['telegram-link-status'],
    queryFn: telegramApi.getLinkStatus,
    refetchInterval: 10_000, // Poll every 10s while user might be linking
    staleTime: 5_000,
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Send className="w-4 h-4 text-[#2AABEE]" />
        <h3 className="text-sm font-semibold text-gray-900">Telegram</h3>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500">Загрузка...</span>
        </div>
      )}

      {error && !isLoading && (
        <p className="text-xs text-red-500">Ошибка загрузки статуса Telegram</p>
      )}

      {data && !data.linked && <TelegramConnect />}

      {data?.linked && (
        <TelegramLinked
          username={data.telegram_username}
          settings={data.settings}
          linkedAt={data.linked_at}
        />
      )}
    </div>
  );
}
