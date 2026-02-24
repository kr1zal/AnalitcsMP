/**
 * ProfileTab — email, logout, delete account.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/useAuthStore';
import { accountApi } from '../../services/api';
import { TelegramSection } from './TelegramSection';

// ─── Delete account section ───

function DeleteAccountSection({ onDeleted }: { onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const canDelete = confirmText === 'УДАЛИТЬ';

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError('');
    try {
      await accountApi.deleteAccount();
      toast.success('Аккаунт удалён. Все данные стёрты.');
      onDeleted();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Ошибка удаления аккаунта');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border border-red-200 rounded-xl p-5 bg-red-50/50">
      <div className="flex items-center gap-2 mb-2">
        <Trash2 className="w-4 h-4 text-red-600" />
        <h3 className="text-sm font-semibold text-red-900">Удаление аккаунта</h3>
      </div>
      <p className="text-xs text-red-700 mb-3">
        Все ваши данные, токены, подписка и история синхронизации будут удалены безвозвратно.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-4 py-2 text-xs font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
        >
          Удалить аккаунт
        </button>
      ) : (
        <div className="space-y-3">
          <div className="bg-white border border-red-200 rounded-lg p-3">
            <p className="text-xs text-gray-700 mb-2">
              Для подтверждения введите <span className="font-mono font-bold text-red-600">УДАЛИТЬ</span>
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="УДАЛИТЬ"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setConfirmText(''); setError(''); }}
              className="flex-1 py-2 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete || deleting}
              className="flex-1 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              {deleting ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Удаляю...</>
              ) : (
                <><Trash2 className="w-3.5 h-3.5" /> Удалить навсегда</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Profile tab ───

export function ProfileTab() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Profile info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Профиль</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-900 font-medium">{user?.email}</p>
            <p className="text-xs text-gray-500 mt-0.5">Email аккаунта</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
        </div>
      </div>

      {/* Telegram */}
      <TelegramSection />

      {/* Delete account */}
      <DeleteAccountSection onDeleted={handleLogout} />
    </div>
  );
}
