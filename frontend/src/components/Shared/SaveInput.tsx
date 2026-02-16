/**
 * Reusable inline blur-save input — extracted from SalesPlanEditor.
 * Saves on blur or Enter, shows spinner + checkmark.
 * `compact` mode for table cells (smaller padding, text-xs).
 */
import { useState, useRef } from 'react';
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

export interface SaveInputProps {
  value: number;
  onSave: (value: number) => Promise<void>;
  placeholder?: string;
  className?: string;
  /** Compact mode for inline table cells */
  compact?: boolean;
}

export function SaveInput({ value, onSave, placeholder = '0', className = '', compact }: SaveInputProps) {
  const [localValue, setLocalValue] = useState(value > 0 ? String(value) : '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync with server value when it changes
  const prevValue = useRef(value);
  if (prevValue.current !== value && !saving) {
    prevValue.current = value;
    setLocalValue(value > 0 ? String(value) : '');
  }

  const handleBlur = async () => {
    const newValue = parseFloat(localValue) || 0;
    if (newValue === value) return;

    setSaving(true);
    try {
      await onSave(newValue);
      setSaved(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const iconSize = compact ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <div className={cn('relative', className)}>
      <input
        type="number"
        min="0"
        step="1000"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder={placeholder}
        className={cn(
          'w-full pr-7 text-right border border-gray-200 rounded-lg tabular-nums',
          'focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400',
          compact
            ? 'px-1.5 py-1 text-xs'
            : 'px-3 py-1.5 text-sm',
        )}
        disabled={saving}
      />
      {saving && (
        <Loader2 className={cn('absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin', iconSize)} />
      )}
      {saved && !saving && (
        <Check className={cn('absolute right-2 top-1/2 -translate-y-1/2 text-green-500', iconSize)} />
      )}
    </div>
  );
}
