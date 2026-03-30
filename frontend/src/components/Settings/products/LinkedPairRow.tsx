import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Lock } from 'lucide-react';
import type { Product } from '../../../types';
import type { LinkedPair } from './types';
import { ROW_H } from './constants';

function InlineProduct({
  product,
  shakeIds,
  onPriceChange,
}: {
  product: Product;
  shakeIds: Set<string>;
  onPriceChange: (productId: string, price: number) => void;
}) {
  const [localPrice, setLocalPrice] = useState(String(product.purchase_price || ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalPrice(String(product.purchase_price || ''));
  }, [product.purchase_price]);

  const handleBlur = useCallback(() => {
    const trimmed = localPrice.trim();
    const num = trimmed === '' ? 0 : parseFloat(trimmed);
    if (!isNaN(num) && num >= 0 && num !== product.purchase_price) {
      onPriceChange(product.id, num);
      setLocalPrice(num === 0 ? '' : String(num));
    } else {
      setLocalPrice(String(product.purchase_price || ''));
    }
  }, [localPrice, product.purchase_price, product.id, onPriceChange]);

  const isShaking = shakeIds.has(product.id);

  return (
    <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
      <span
        className="text-[11px] sm:text-sm text-gray-800 flex-1 min-w-0 leading-tight line-clamp-2 sm:truncate sm:line-clamp-none"
        title={product.name}
      >
        {product.name}
      </span>
      <input
        ref={inputRef}
        type="number"
        value={localPrice}
        onChange={(e) => setLocalPrice(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') inputRef.current?.blur();
        }}
        className={`w-12 sm:w-20 px-1 sm:px-1.5 py-0.5 text-xs sm:text-sm text-right border rounded transition-colors flex-shrink-0 ${
          isShaking
            ? 'border-red-500 bg-red-50 pm-shake'
            : 'border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200'
        }`}
        min={0}
        step={1}
      />
    </div>
  );
}

interface LinkedPairRowProps {
  pair: LinkedPair;
  shakeIds: Set<string>;
  onPriceChange: (productId: string, price: number) => void;
  onUnlink: (groupId: string) => void;
}

export const LinkedPairRow = memo(function LinkedPairRow({
  pair,
  shakeIds,
  onPriceChange,
  onUnlink,
}: LinkedPairRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pair.pairId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const handleUnlink = useCallback(() => {
    if (pair.isAutoLinked) return;
    onUnlink(pair.wb.product_group_id ?? '');
  }, [pair.isAutoLinked, pair.wb.product_group_id, onUnlink]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg hover:bg-gray-50 ${isDragging ? 'bg-indigo-50 shadow-md' : ''}`}
    >
      {/* Single row layout — same on mobile and desktop */}
      <div className={`flex ${ROW_H} items-center gap-1 sm:gap-2 px-0.5 sm:px-2`}>
        <button
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
          aria-label="Перетащить пару"
        >
          <GripVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <InlineProduct product={pair.wb} shakeIds={shakeIds} onPriceChange={onPriceChange} />
        </div>

        <div className="w-6 sm:w-10 flex items-center justify-center flex-shrink-0">
          <button
            onClick={handleUnlink}
            disabled={pair.isAutoLinked}
            className={`p-0.5 sm:p-1 rounded transition-colors ${
              pair.isAutoLinked
                ? 'text-indigo-400 cursor-default'
                : 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800'
            }`}
            title={pair.isAutoLinked ? 'Авто-связь (один штрихкод)' : 'Разорвать связь'}
          >
            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <InlineProduct product={pair.ozon} shakeIds={shakeIds} onPriceChange={onPriceChange} />
        </div>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.pair.pairId === next.pair.pairId &&
  prev.pair.wb.purchase_price === next.pair.wb.purchase_price &&
  prev.pair.ozon.purchase_price === next.pair.ozon.purchase_price &&
  prev.shakeIds.has(prev.pair.wb.id) === next.shakeIds.has(next.pair.wb.id) &&
  prev.shakeIds.has(prev.pair.ozon.id) === next.shakeIds.has(next.pair.ozon.id)
);
