import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { Lock, Unlock, HelpCircle } from 'lucide-react';
import type { Product } from '../../../types';
import { ProductRow } from './ProductRow';
import { ProductSearch } from './ProductSearch';
import { ROW_H, HEADER_H } from './constants';

const PAGE_SIZE = 30;

// ─── Unlinked Link Column ───

function UnlinkedLinkColumn({
  wbProducts,
  ozonProducts,
  onLink,
  onHelp,
  searchActive,
  visibleWb,
  visibleOzon,
}: {
  wbProducts: Product[];
  ozonProducts: Product[];
  onLink: (wb: Product, ozon: Product) => void;
  onHelp: () => void;
  searchActive: boolean;
  visibleWb: number;
  visibleOzon: number;
}) {
  // Показываем замочки только для видимых строк (после пагинации)
  const maxRows = Math.min(
    Math.max(Math.min(wbProducts.length, visibleWb), Math.min(ozonProducts.length, visibleOzon)),
    Math.max(wbProducts.length, ozonProducts.length),
  );

  return (
    <div className="flex flex-col items-center w-6 sm:w-10 flex-shrink-0">
      {/* Spacer matching ProductSearch height (py-1 text-xs ~26px + mb-1.5=6px) */}
      <div className="h-[26px] mb-1.5" />
      <div className={`${HEADER_H} flex items-end justify-center pb-0.5`}>
        <button onClick={onHelp} className="text-gray-300 hover:text-gray-500 transition-colors">
          <HelpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
      </div>
      {Array.from({ length: maxRows }).map((_, i) => {
        const wb = wbProducts[i];
        const ozon = ozonProducts[i];

        if (!wb || !ozon) {
          return <div key={i} className={ROW_H} />;
        }

        return (
          <div key={i} className={`${ROW_H} flex items-center justify-center`}>
            <button
              onClick={() => onLink(wb, ozon)}
              disabled={searchActive}
              className={`p-0.5 sm:p-1 rounded transition-colors ${
                searchActive
                  ? 'text-gray-200 cursor-not-allowed'
                  : 'text-gray-300 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
              title={searchActive ? 'Сбросьте поиск для связывания' : 'Связать товары'}
            >
              <Unlock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Ozon Pro Lock Overlay ───

function OzonProOverlay() {
  return (
    <div className="flex-1 min-w-0 relative">
      <h3 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
        Ozon
      </h3>
      <div className="border border-dashed border-gray-300 rounded-xl bg-gray-50/50 flex flex-col items-center justify-center py-8 px-4 text-center">
        <Lock className="w-6 h-6 text-gray-400 mb-2" />
        <p className="text-sm font-medium text-gray-700 mb-1">Доступно на Pro</p>
        <p className="text-xs text-gray-500 mb-3">
          Подключите Pro подписку для работы с Ozon
        </p>
        <button
          onClick={() => document.getElementById('subscription')?.scrollIntoView({ behavior: 'smooth' })}
          className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Подключить Pro — 1490₽/мес
        </button>
      </div>
    </div>
  );
}

// ─── Product Column with lazy DnD ───

function ProductColumn({
  title,
  products,
  shakeIds,
  onPriceChange,
  onReorder,
  disabled,
  visibleCount,
  onLoadMore,
}: {
  title: string;
  products: Product[];
  shakeIds: Set<string>;
  onPriceChange: (productId: string, price: number) => void;
  onReorder: (products: Product[]) => void;
  disabled?: boolean;
  visibleCount: number;
  onLoadMore: () => void;
}) {
  const [isDndActive, setIsDndActive] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setIsDndActive(false);
    if (!over || active.id === over.id) return;
    const oldIndex = products.findIndex((p) => p.id === active.id);
    const newIndex = products.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(products, oldIndex, newIndex));
  }, [products, onReorder]);

  const activateDnd = useCallback(() => setIsDndActive(true), []);

  const visibleProducts = useMemo(
    () => products.slice(0, visibleCount),
    [products, visibleCount],
  );


  const content = (
    <>
      {visibleProducts.map((product) => (
        <ProductRow
          key={product.id}
          product={product}
          isShaking={shakeIds.has(product.id)}
          onPriceChange={onPriceChange}
          isDndActive={isDndActive}
          onActivateDnd={activateDnd}
        />
      ))}
      {products.length > visibleCount && (
        <button
          onClick={onLoadMore}
          className="w-full py-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          Показать ещё {Math.min(PAGE_SIZE, products.length - visibleCount)}
        </button>
      )}
    </>
  );

  return (
    <div className={`flex-1 min-w-0 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className={`${HEADER_H} flex items-end px-1 pb-1`}>
        <h3 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      {products.length === 0 ? (
        <p className="text-xs text-gray-400 px-1 py-4 text-center">Нет товаров</p>
      ) : isDndActive ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleProducts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {content}
          </SortableContext>
        </DndContext>
      ) : (
        content
      )}
    </div>
  );
}

// ─── Unlinked Section ───

interface UnlinkedSectionProps {
  unlinkedWb: Product[];
  unlinkedOzon: Product[];
  shakeIds: Set<string>;
  isOzonDisabled: boolean;
  onPriceChange: (productId: string, price: number) => void;
  onReorderWb: (products: Product[]) => void;
  onReorderOzon: (products: Product[]) => void;
  onLink: (wb: Product, ozon: Product) => void;
  onHelpClick: () => void;
}

export function UnlinkedSection({
  unlinkedWb,
  unlinkedOzon,
  shakeIds,
  isOzonDisabled,
  onPriceChange,
  onReorderWb,
  onReorderOzon,
  onLink,
  onHelpClick,
}: UnlinkedSectionProps) {
  const [searchWb, setSearchWb] = useState('');
  const [searchOzon, setSearchOzon] = useState('');
  const [visibleWbCount, setVisibleWbCount] = useState(PAGE_SIZE);
  const [visibleOzonCount, setVisibleOzonCount] = useState(PAGE_SIZE);


  const filteredWb = useMemo(() => {
    if (!searchWb.trim()) return unlinkedWb;
    const q = searchWb.toLowerCase();
    return unlinkedWb.filter(p =>
      p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)
    );
  }, [unlinkedWb, searchWb]);

  const filteredOzon = useMemo(() => {
    if (!searchOzon.trim()) return unlinkedOzon;
    const q = searchOzon.toLowerCase();
    return unlinkedOzon.filter(p =>
      p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)
    );
  }, [unlinkedOzon, searchOzon]);

  const hasUnlinked = unlinkedWb.length > 0 || unlinkedOzon.length > 0;
  if (!hasUnlinked && !isOzonDisabled) return null;

  if (!hasUnlinked && isOzonDisabled) {
    return (
      <div className="flex gap-1">
        <div className="flex-1 hidden sm:block" />
        <OzonProOverlay />
      </div>
    );
  }

  return (
    <div className="flex gap-0 sm:gap-1">
      <div className="flex-1 min-w-0">
        <ProductSearch value={searchWb} onChange={setSearchWb} placeholder="Поиск WB..." />
        <ProductColumn
          title="WB"
          products={filteredWb}
          shakeIds={shakeIds}
          onPriceChange={onPriceChange}
          onReorder={onReorderWb}
          visibleCount={visibleWbCount}
          onLoadMore={() => setVisibleWbCount(c => c + PAGE_SIZE)}
        />
      </div>

      {isOzonDisabled ? (
        <OzonProOverlay />
      ) : (
        <>
          <UnlinkedLinkColumn
            wbProducts={filteredWb}
            ozonProducts={filteredOzon}
            onLink={onLink}
            onHelp={onHelpClick}
            searchActive={!!searchWb.trim() || !!searchOzon.trim()}
            visibleWb={visibleWbCount}
            visibleOzon={visibleOzonCount}
          />
          <div className="flex-1 min-w-0">
            <ProductSearch value={searchOzon} onChange={setSearchOzon} placeholder="Поиск Ozon..." />
            <ProductColumn
              title="Ozon"
              products={filteredOzon}
              visibleCount={visibleOzonCount}
              onLoadMore={() => setVisibleOzonCount(c => c + PAGE_SIZE)}
              shakeIds={shakeIds}
              onPriceChange={onPriceChange}
              onReorder={onReorderOzon}
            />
          </div>
        </>
      )}
    </div>
  );
}
