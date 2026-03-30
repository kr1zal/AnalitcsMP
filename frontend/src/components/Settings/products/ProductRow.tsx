import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { Product } from '../../../types';
import { ROW_H } from './constants';

interface ProductRowProps {
  product: Product;
  isShaking: boolean;
  onPriceChange: (productId: string, price: number) => void;
  isDndActive: boolean;
  onActivateDnd: () => void;
}

function StaticProductRowInner({
  product,
  isShaking,
  onPriceChange,
  onActivateDnd,
}: Omit<ProductRowProps, 'isDndActive'>) {
  const [localPrice, setLocalPrice] = useState(String(product.purchase_price || ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalPrice(String(product.purchase_price || ''));
  }, [product.purchase_price]);

  const handleBlur = useCallback(() => {
    const num = parseFloat(localPrice);
    if (!isNaN(num) && num >= 0 && num !== product.purchase_price) {
      onPriceChange(product.id, num);
    } else {
      setLocalPrice(String(product.purchase_price || ''));
    }
  }, [localPrice, product.purchase_price, product.id, onPriceChange]);

  return (
    <div
      className={`${ROW_H} flex items-center gap-1 sm:gap-2 px-0.5 sm:px-2 rounded-lg hover:bg-gray-50`}
    >
      <button
        onMouseDown={onActivateDnd}
        onTouchStart={onActivateDnd}
        className="touch-none cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
        aria-label="Перетащить"
      >
        <GripVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
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

function SortableProductRowInner({
  product,
  isShaking,
  onPriceChange,
}: Omit<ProductRowProps, 'isDndActive' | 'onActivateDnd'>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const [localPrice, setLocalPrice] = useState(String(product.purchase_price || ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalPrice(String(product.purchase_price || ''));
  }, [product.purchase_price]);

  const handleBlur = useCallback(() => {
    const num = parseFloat(localPrice);
    if (!isNaN(num) && num >= 0 && num !== product.purchase_price) {
      onPriceChange(product.id, num);
    } else {
      setLocalPrice(String(product.purchase_price || ''));
    }
  }, [localPrice, product.purchase_price, product.id, onPriceChange]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${ROW_H} flex items-center gap-1 sm:gap-2 px-0.5 sm:px-2 rounded-lg hover:bg-gray-50 ${
        isDragging ? 'bg-indigo-50 shadow-md' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
        aria-label="Перетащить"
      >
        <GripVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
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

function productRowComparator(prev: ProductRowProps, next: ProductRowProps): boolean {
  return (
    prev.product.id === next.product.id &&
    prev.product.purchase_price === next.product.purchase_price &&
    prev.isDndActive === next.isDndActive &&
    prev.isShaking === next.isShaking
  );
}

export const ProductRow = memo(function ProductRow(props: ProductRowProps) {
  if (props.isDndActive) {
    return (
      <SortableProductRowInner
        product={props.product}
        isShaking={props.isShaking}
        onPriceChange={props.onPriceChange}
      />
    );
  }
  return (
    <StaticProductRowInner
      product={props.product}
      isShaking={props.isShaking}
      onPriceChange={props.onPriceChange}
      onActivateDnd={props.onActivateDnd}
    />
  );
}, productRowComparator);
