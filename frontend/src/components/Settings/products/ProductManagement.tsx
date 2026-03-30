import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { HelpCircle, AlertCircle, Lock, Unlock, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useProducts,
  useUpdatePurchasePrice,
  useReorderProducts,
  useLinkProducts,
  useUnlinkProducts,
} from '../../../hooks/useProducts';
import { useSubscription } from '../../../hooks/useSubscription';
import type { Product } from '../../../types';
import type { CCConflict, LinkedPair } from './types';
import { SHAKE_CSS } from './constants';
import { CsvToolbar } from './CsvToolbar';
import { LinkedPairsSection } from './LinkedPairsSection';
import { UnlinkedSection } from './UnlinkedSection';

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

  const handleCustomSubmit = useCallback(() => {
    const num = parseFloat(customPrice);
    if (!isNaN(num) && num >= 0) {
      onResolve(wbProduct.id, ozonProduct.id, num);
    }
  }, [customPrice, wbProduct.id, ozonProduct.id, onResolve]);

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

// ─── Info Modal ───

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
  const [unlinkConfirm, setUnlinkConfirm] = useState<string | null>(null);

  // Debounced reorder
  const pendingRef = useRef<Map<string, number>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush pending reorder on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        const batch = Array.from(pendingRef.current.entries()).map(
          ([product_id, sort_order]) => ({ product_id, sort_order }),
        );
        if (batch.length > 0) reorderMut.mutate(batch);
        pendingRef.current.clear();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const products = productsData?.products || [];

  // ── Group products ──
  const { linkedPairs, unlinkedWb, unlinkedOzon } = useMemo(() => {
    const pairs: LinkedPair[] = [];
    const groupMap = new Map<string, { wb?: Product; ozon?: Product }>();
    const usedIds = new Set<string>();

    for (const p of products) {
      if (p.wb_nm_id && p.ozon_product_id) {
        pairs.push({ pairId: `auto-${p.id}`, wb: p, ozon: p, isAutoLinked: true });
        usedIds.add(p.id);
      }
    }

    for (const p of products) {
      if (usedIds.has(p.id) || !p.product_group_id) continue;
      const entry = groupMap.get(p.product_group_id) || {};
      if (p.wb_nm_id) entry.wb = p;
      if (p.ozon_product_id) entry.ozon = p;
      groupMap.set(p.product_group_id, entry);
    }

    for (const [groupId, entry] of groupMap) {
      if (entry.wb && entry.ozon) {
        pairs.push({ pairId: groupId, wb: entry.wb, ozon: entry.ozon, isAutoLinked: false });
        usedIds.add(entry.wb.id);
        usedIds.add(entry.ozon.id);
      }
    }

    pairs.sort((a, b) => {
      const aOrder = Math.min(a.wb.sort_order, a.ozon.sort_order);
      const bOrder = Math.min(b.wb.sort_order, b.ozon.sort_order);
      return aOrder - bOrder;
    });

    const ulWb = products
      .filter((p) => !usedIds.has(p.id) && p.wb_nm_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const ulOzon = products
      .filter((p) => !usedIds.has(p.id) && p.ozon_product_id)
      .sort((a, b) => a.sort_order - b.sort_order);

    return { linkedPairs: pairs, unlinkedWb: ulWb, unlinkedOzon: ulOzon };
  }, [products]);

  const isOzonDisabled = !!(
    subscription?.limits?.marketplaces &&
    !subscription.limits.marketplaces.includes('ozon')
  );

  // ── Debounced reorder helper ──
  const flushReorder = useCallback(() => {
    const items = Array.from(pendingRef.current.entries()).map(([product_id, sort_order]) => ({
      product_id,
      sort_order,
    }));
    if (items.length > 0) {
      reorderMut.mutate(items);
      pendingRef.current.clear();
    }
  }, [reorderMut]);

  const reorderAll = useCallback(
    (newPairs: LinkedPair[], newUnlinkedWb: Product[], newUnlinkedOzon: Product[]) => {
      let order = 0;

      for (const pair of newPairs) {
        if (pair.isAutoLinked) {
          pendingRef.current.set(pair.wb.id, order);
        } else {
          pendingRef.current.set(pair.wb.id, order);
          pendingRef.current.set(pair.ozon.id, order);
        }
        order++;
      }

      for (const p of newUnlinkedWb) {
        pendingRef.current.set(p.id, order);
        order++;
      }

      for (const p of newUnlinkedOzon) {
        pendingRef.current.set(p.id, order);
        order++;
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flushReorder, 2000);
    },
    [flushReorder],
  );

  // ── Handlers ──
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

  const handlePairsReorder = useCallback(
    (newPairs: LinkedPair[]) => {
      reorderAll(newPairs, unlinkedWb, unlinkedOzon);
    },
    [unlinkedWb, unlinkedOzon, reorderAll],
  );

  const handleUnlinkedWbReorder = useCallback(
    (newProducts: Product[]) => {
      reorderAll(linkedPairs, newProducts, unlinkedOzon);
    },
    [linkedPairs, unlinkedOzon, reorderAll],
  );

  const handleUnlinkedOzonReorder = useCallback(
    (newProducts: Product[]) => {
      reorderAll(linkedPairs, unlinkedWb, newProducts);
    },
    [linkedPairs, unlinkedWb, reorderAll],
  );

  const handleLink = useCallback(
    (wb: Product, ozon: Product) => {
      if (wb.purchase_price !== ozon.purchase_price) {
        setShakeIds(new Set([wb.id, ozon.id]));
        setTimeout(() => {
          setShakeIds(new Set());
          setConflict({ wbProduct: wb, ozonProduct: ozon });
        }, 450);
      } else {
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

  const openLinksHelp = useCallback(() => setHelpOpen('links'), []);
  const closeHelp = useCallback(() => setHelpOpen(null), []);

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
  const hasLinkedPairs = linkedPairs.length > 0;
  const hasUnlinked = unlinkedWb.length > 0 || unlinkedOzon.length > 0;

  return (
    <>
      <style>{SHAKE_CSS}</style>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-gray-900">Товары</h2>
          <button onClick={() => setHelpOpen('products')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <SKUCounter current={currentSku} max={maxSku} />
        </div>
        <CsvToolbar products={products} />
      </div>

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
          <span className="text-xs text-gray-400">Добавьте API-токены ниже и нажмите "Сохранить и синхронизировать".</span>
        </p>
      ) : (
        <div>
          {hasLinkedPairs && (
            <LinkedPairsSection
              linkedPairs={linkedPairs}
              shakeIds={shakeIds}
              onPriceChange={handlePriceChange}
              onUnlink={handleUnlinkClick}
              onReorder={handlePairsReorder}
              onHelpClick={openLinksHelp}
            />
          )}

          {hasLinkedPairs && hasUnlinked && (
            <div className="border-t border-gray-200 my-3" />
          )}

          <UnlinkedSection
            unlinkedWb={unlinkedWb}
            unlinkedOzon={unlinkedOzon}
            shakeIds={shakeIds}
            isOzonDisabled={isOzonDisabled}
            onPriceChange={handlePriceChange}
            onReorderWb={handleUnlinkedWbReorder}
            onReorderOzon={handleUnlinkedOzonReorder}
            onLink={handleLink}
            onHelpClick={openLinksHelp}
          />
        </div>
      )}

      {conflict && (
        <CCConflictModal
          conflict={conflict}
          onResolve={handleConflictResolve}
          onClose={() => setConflict(null)}
        />
      )}

      {helpOpen === 'products' && (
        <InfoModal title="Управление товарами" onClose={closeHelp}>
          <div className="space-y-3 text-xs text-gray-600">
            <div>
              <p className="font-medium text-gray-800 mb-1">Откуда берутся товары?</p>
              <p>Импортируются автоматически при синхронизации с маркетплейсами. Вручную добавить нельзя.</p>
            </div>
            <div>
              <p className="font-medium text-gray-800 mb-1">Себестоимость (рублей)</p>
              <p>Число справа от названия -- закупочная цена. Используется для расчёта прибыли на дашборде.</p>
            </div>
            <div>
              <p className="font-medium text-gray-800 mb-1">Порядок отображения</p>
              <p>Перетаскивайте <span className="inline-block align-middle text-gray-400">||</span> слева от названия для изменения порядка. Связанные пары перемещаются целиком.</p>
            </div>
            <div>
              <p className="font-medium text-gray-800 mb-1">Группы товаров</p>
              <p>Связанные товары (замочек) отображаются наверху как единая строка. Изменение себестоимости обновит оба товара.</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-gray-500">
              Количество товаров ограничено тарифом (SKU). На бесплатном -- до 3, на Pro -- до 20.
            </div>
          </div>
        </InfoModal>
      )}

      {helpOpen === 'links' && (
        <InfoModal title="Связь товаров WB + Ozon" onClose={closeHelp}>
          <div className="space-y-3 text-xs text-gray-600">
            <div className="flex gap-2.5 items-start">
              <Lock className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800">Авто-связь</p>
                <p>Один штрихкод на WB и Ozon -- один товар в базе. Разорвать нельзя.</p>
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
                <p>Нажмите открытый замок между несвязанными товарами, чтобы связать. Если себестоимость отличается -- выберете единую цену.</p>
              </div>
            </div>
            <div className="bg-indigo-50 rounded-lg px-3 py-2 text-indigo-700">
              Связанные товары считаются одним SKU и делят себестоимость. Они отображаются наверху списка как единые строки.
            </div>
          </div>
        </InfoModal>
      )}

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
