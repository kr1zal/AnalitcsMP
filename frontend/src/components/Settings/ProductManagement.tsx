import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Lock, Unlock, X, AlertCircle, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  useProducts,
  useUpdatePurchasePrice,
  useReorderProducts,
  useLinkProducts,
  useUnlinkProducts,
} from '../../hooks/useProducts';
import { useSubscription } from '../../hooks/useSubscription';
import type { Product } from '../../types';

// ─── Shake animation CSS ───

const SHAKE_CSS = `
@keyframes pm-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
  20%, 40%, 60%, 80% { transform: translateX(3px); }
}
.pm-shake { animation: pm-shake 0.4s ease-in-out; }
`;

// ─── Layout constants (shared between all 3 columns) ───

const ROW_H = 'h-[44px] sm:h-[40px]';   // product row + lock row
const HEADER_H = 'h-7';                   // header area above rows (28px)

// ─── Types ───

interface CCConflict {
  wbProduct: Product;
  ozonProduct: Product;
}

// ─── SKU Counter ───

function SKUCounter({ current, max }: { current: number; max: number | null }) {
  if (max === null) {
    return <span className="text-xs text-gray-400">SKU: {current}</span>;
  }
  const ratio = current / max;
  const color =
    ratio >= 1
      ? 'text-red-600 bg-red-50'
      : ratio >= 0.8
        ? 'text-amber-600 bg-amber-50'
        : 'text-green-600 bg-green-50';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      SKU {current}/{max}
    </span>
  );
}

// ─── Sortable Product Row ───

function SortableProductRow({
  product,
  shakeIds,
  onPriceChange,
}: {
  product: Product;
  shakeIds: Set<string>;
  onPriceChange: (productId: string, price: number) => void;
}) {
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

  const handleBlur = () => {
    const num = parseFloat(localPrice);
    if (!isNaN(num) && num >= 0 && num !== product.purchase_price) {
      onPriceChange(product.id, num);
    } else {
      setLocalPrice(String(product.purchase_price || ''));
    }
  };

  const isShaking = shakeIds.has(product.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${ROW_H} flex items-center gap-1 sm:gap-2 px-0.5 sm:px-2 rounded-lg hover:bg-gray-50 ${
        isDragging ? 'bg-indigo-50 shadow-md' : ''
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
      >
        <GripVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      {/* Name — two-line on mobile for better readability */}
      <span
        className="text-[11px] sm:text-sm text-gray-800 flex-1 min-w-0 leading-tight line-clamp-2 sm:truncate sm:line-clamp-none"
        title={product.name}
      >
        {product.name}
      </span>

      {/* Price input */}
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

// ─── Product Column ───

function ProductColumn({
  title,
  products,
  shakeIds,
  onPriceChange,
  onReorder,
  disabled,
}: {
  title: string;
  products: Product[];
  shakeIds: Set<string>;
  onPriceChange: (productId: string, price: number) => void;
  onReorder: (products: Product[]) => void;
  disabled?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = products.findIndex((p) => p.id === active.id);
    const newIndex = products.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(products, oldIndex, newIndex));
  };

  return (
    <div className={`flex-1 min-w-0 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className={`${HEADER_H} flex items-end px-1 pb-1`}>
        <h3 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      {products.length === 0 ? (
        <p className="text-xs text-gray-400 px-1 py-4 text-center">Нет товаров</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {products.map((product) => (
              <SortableProductRow
                key={product.id}
                product={product}
                shakeIds={shakeIds}
                onPriceChange={onPriceChange}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// ─── Lock Column ───

function LinkColumn({
  wbProducts,
  ozonProducts,
  onLink,
  onUnlink,
  onHelp,
}: {
  wbProducts: Product[];
  ozonProducts: Product[];
  onLink: (wb: Product, ozon: Product) => void;
  onUnlink: (groupId: string) => void;
  onHelp: () => void;
}) {
  const maxRows = Math.max(wbProducts.length, ozonProducts.length);

  return (
    <div className="flex flex-col items-center w-6 sm:w-10 flex-shrink-0">
      {/* Header with help icon — matches ProductColumn HEADER_H */}
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

        // Auto-linked: same DB row (both marketplace IDs on one product)
        const isAutoLinked = wb.id === ozon.id;

        // Manually linked: same product_group_id
        const isManuallyLinked =
          !isAutoLinked &&
          !!wb.product_group_id &&
          !!ozon.product_group_id &&
          wb.product_group_id === ozon.product_group_id;

        const isLinked = isAutoLinked || isManuallyLinked;

        return (
          <div key={i} className={`${ROW_H} flex items-center justify-center`}>
            {isLinked ? (
              <button
                onClick={() => {
                  if (isAutoLinked) return;
                  if (wb.product_group_id) onUnlink(wb.product_group_id);
                }}
                disabled={isAutoLinked}
                className={`p-0.5 sm:p-1 rounded transition-colors ${
                  isAutoLinked
                    ? 'text-indigo-400 cursor-default'
                    : 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800'
                }`}
                title={isAutoLinked ? 'Авто-связь (один штрихкод)' : 'Разорвать связь'}
              >
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            ) : (
              <button
                onClick={() => onLink(wb, ozon)}
                className="p-0.5 sm:p-1 rounded text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Связать товары"
              >
                <Unlock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── CC Conflict Modal ───

function CCConflictModal({
  conflict,
  onResolve,
  onClose,
}: {
  conflict: CCConflict;
  onResolve: (wbId: string, ozonId: string, price: number) => void;
  onClose: () => void;
}) {
  const [customPrice, setCustomPrice] = useState('');
  const { wbProduct, ozonProduct } = conflict;

  const handleCustomSubmit = () => {
    const num = parseFloat(customPrice);
    if (!isNaN(num) && num >= 0) {
      onResolve(wbProduct.id, ozonProduct.id, num);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Себестоимость не совпадает</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-gray-600 truncate mr-2">WB: {wbProduct.name}</span>
            <span className="font-medium text-gray-900 flex-shrink-0">
              {wbProduct.purchase_price}₽
            </span>
          </div>
          <div className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-gray-600 truncate mr-2">Ozon: {ozonProduct.name}</span>
            <span className="font-medium text-gray-900 flex-shrink-0">
              {ozonProduct.purchase_price}₽
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-3">Какую себестоимость использовать?</p>

        <div className="space-y-2">
          <button
            onClick={() => onResolve(wbProduct.id, ozonProduct.id, wbProduct.purchase_price)}
            className="w-full py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            {wbProduct.purchase_price}₽ (WB)
          </button>
          <button
            onClick={() => onResolve(wbProduct.id, ozonProduct.id, ozonProduct.purchase_price)}
            className="w-full py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            {ozonProduct.purchase_price}₽ (Ozon)
          </button>

          <div className="flex gap-2">
            <input
              type="number"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              placeholder="Своя цена"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              min={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCustomSubmit();
              }}
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customPrice || isNaN(parseFloat(customPrice))}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </div>
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
          Подключить Pro — 990₽/мес
        </button>
      </div>
    </div>
  );
}

// ─── Info Modal (click-to-open, mobile bottom-sheet) ───

function InfoModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-sm sm:mx-4 p-5 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Main Component ───

export function ProductManagement() {
  const { data: productsData, isLoading: productsLoading } = useProducts();
  const { data: subscription } = useSubscription();
  const updatePrice = useUpdatePurchasePrice();
  const reorderMut = useReorderProducts();
  const linkMut = useLinkProducts();
  const unlinkMut = useUnlinkProducts();

  const [shakeIds, setShakeIds] = useState<Set<string>>(new Set());
  const [conflict, setConflict] = useState<CCConflict | null>(null);
  const [helpOpen, setHelpOpen] = useState<'products' | 'links' | null>(null);

  const products = productsData?.products || [];

  // Split into WB and Ozon lists
  const wbProducts = useMemo(
    () => products.filter((p) => p.wb_nm_id).sort((a, b) => a.sort_order - b.sort_order),
    [products],
  );
  const ozonProducts = useMemo(
    () =>
      products.filter((p) => p.ozon_product_id).sort((a, b) => a.sort_order - b.sort_order),
    [products],
  );

  const isOzonDisabled =
    subscription?.limits?.marketplaces &&
    !subscription.limits.marketplaces.includes('ozon');

  // ── Handle price update ──
  const handlePriceChange = useCallback(
    (productId: string, price: number) => {
      updatePrice.mutate(
        { productId, price },
        {
          onSuccess: () => toast.success('Себестоимость обновлена'),
          onError: () => toast.error('Ошибка обновления себестоимости'),
        },
      );
    },
    [updatePrice],
  );

  // ── Handle reorder ──
  const handleReorder = useCallback(
    (newProducts: Product[]) => {
      const items = newProducts.map((p, i) => ({ product_id: p.id, sort_order: i }));
      reorderMut.mutate(items);
    },
    [reorderMut],
  );

  // ── Handle link click ──
  const handleLink = useCallback(
    (wb: Product, ozon: Product) => {
      if (wb.purchase_price !== ozon.purchase_price) {
        // Shake both price cells, then show conflict modal
        setShakeIds(new Set([wb.id, ozon.id]));
        setTimeout(() => {
          setShakeIds(new Set());
          setConflict({ wbProduct: wb, ozonProduct: ozon });
        }, 450);
      } else {
        // Same price → link directly
        linkMut.mutate(
          { wbId: wb.id, ozonId: ozon.id, purchasePrice: wb.purchase_price },
          {
            onSuccess: () => toast.success('Товары связаны'),
            onError: () => toast.error('Ошибка связывания'),
          },
        );
      }
    },
    [linkMut],
  );

  // ── Handle unlink with confirmation ──
  const [unlinkConfirm, setUnlinkConfirm] = useState<string | null>(null);

  const handleUnlinkClick = useCallback((groupId: string) => {
    setUnlinkConfirm(groupId);
  }, []);

  const handleUnlinkConfirm = useCallback(() => {
    if (!unlinkConfirm) return;
    unlinkMut.mutate(unlinkConfirm, {
      onSuccess: () => {
        toast.success('Связь разорвана');
        setUnlinkConfirm(null);
      },
      onError: () => toast.error('Ошибка'),
    });
  }, [unlinkMut, unlinkConfirm]);

  // ── Handle CC conflict resolution ──
  const handleConflictResolve = useCallback(
    (wbId: string, ozonId: string, price: number) => {
      linkMut.mutate(
        { wbId, ozonId, purchasePrice: price },
        {
          onSuccess: () => {
            toast.success('Товары связаны');
            setConflict(null);
          },
          onError: () => toast.error('Ошибка связывания'),
        },
      );
    },
    [linkMut],
  );

  // ── Loading ──
  if (productsLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentSku = products.length;
  const maxSku = subscription?.limits?.max_sku ?? null;

  return (
    <>
      <style>{SHAKE_CSS}</style>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-gray-900">Товары</h2>
          <button onClick={() => setHelpOpen('products')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>
        <SKUCounter current={currentSku} max={maxSku} />
      </div>

      {/* SKU limit exceeded warning */}
      {maxSku !== null && currentSku > maxSku && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            Лимит SKU превышен ({currentSku}/{maxSku}).
            Новые товары не будут импортироваться при синхронизации.{' '}
            <button
              onClick={() => document.getElementById('subscription')?.scrollIntoView({ behavior: 'smooth' })}
              className="underline hover:no-underline font-medium"
            >
              Перейдите на Pro
            </button>
          </p>
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">
          Товары появятся после первой синхронизации с маркетплейсами.
          <br />
          <span className="text-xs text-gray-400">Добавьте API-токены ниже и нажмите «Сохранить и синхронизировать».</span>
        </p>
      ) : (
        <div className="flex gap-0 sm:gap-1">
          <ProductColumn
            title="Wildberries"
            products={wbProducts}
            shakeIds={shakeIds}
            onPriceChange={handlePriceChange}
            onReorder={handleReorder}
          />

          {isOzonDisabled ? (
            <OzonProOverlay />
          ) : (
            <>
              <LinkColumn
                wbProducts={wbProducts}
                ozonProducts={ozonProducts}
                onLink={handleLink}
                onUnlink={handleUnlinkClick}
                onHelp={() => setHelpOpen('links')}
              />

              <ProductColumn
                title="Ozon"
                products={ozonProducts}
                shakeIds={shakeIds}
                onPriceChange={handlePriceChange}
                onReorder={handleReorder}
              />
            </>
          )}
        </div>
      )}

      {conflict && (
        <CCConflictModal
          conflict={conflict}
          onResolve={handleConflictResolve}
          onClose={() => setConflict(null)}
        />
      )}

      {/* ── Help modals ── */}
      {helpOpen === 'products' && (
        <InfoModal title="Управление товарами" onClose={() => setHelpOpen(null)}>
          <div className="space-y-3 text-xs text-gray-600">
            <div>
              <p className="font-medium text-gray-800 mb-1">Откуда берутся товары?</p>
              <p>Импортируются автоматически при синхронизации с маркетплейсами. Вручную добавить нельзя.</p>
            </div>
            <div>
              <p className="font-medium text-gray-800 mb-1">Себестоимость (₽)</p>
              <p>Число справа от названия — закупочная цена. Используется для расчёта прибыли на дашборде.</p>
            </div>
            <div>
              <p className="font-medium text-gray-800 mb-1">Порядок отображения</p>
              <p>Перетаскивайте <span className="inline-block align-middle text-gray-400">⋮⋮</span> слева от названия для изменения порядка.</p>
            </div>
            <div>
              <p className="font-medium text-gray-800 mb-1">Группы товаров</p>
              <p>Если товар связан с другим (замочек между колонками), изменение себестоимости обновит оба товара.</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-gray-500">
              Количество товаров ограничено тарифом (SKU). На бесплатном — до 3, на Pro — до 20.
            </div>
          </div>
        </InfoModal>
      )}

      {helpOpen === 'links' && (
        <InfoModal title="Связь товаров WB + Ozon" onClose={() => setHelpOpen(null)}>
          <div className="space-y-3 text-xs text-gray-600">
            <div className="flex gap-2.5 items-start">
              <Lock className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800">Авто-связь</p>
                <p>Один штрихкод на WB и Ozon — один товар в базе. Разорвать нельзя.</p>
              </div>
            </div>
            <div className="flex gap-2.5 items-start">
              <Lock className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800">Ручная связь</p>
                <p>Разные товары, объединённые вручную. Нажмите замок, чтобы разорвать связь.</p>
              </div>
            </div>
            <div className="flex gap-2.5 items-start">
              <Unlock className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800">Не связаны</p>
                <p>Нажмите открытый замок, чтобы связать. Если себестоимость отличается — выберете единую цену.</p>
              </div>
            </div>
            <div className="bg-indigo-50 rounded-lg px-3 py-2 text-indigo-700">
              Связанные товары считаются одним SKU и делят себестоимость.
            </div>
          </div>
        </InfoModal>
      )}

      {/* Unlink confirmation */}
      {unlinkConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setUnlinkConfirm(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-xs w-full mx-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-gray-900 mb-2">Разорвать связь?</h3>
            <p className="text-xs text-gray-500 mb-4">
              Товары останутся, но перестанут считаться одним SKU. Себестоимость сохранится.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setUnlinkConfirm(null)}
                className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleUnlinkConfirm}
                disabled={unlinkMut.isPending}
                className="flex-1 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {unlinkMut.isPending ? 'Разрываю...' : 'Разорвать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
