import { useCallback } from 'react';
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
import { Lock, HelpCircle } from 'lucide-react';
import type { LinkedPair } from './types';
import { LinkedPairRow } from './LinkedPairRow';
import { HEADER_H } from './constants';

interface LinkedPairsSectionProps {
  linkedPairs: LinkedPair[];
  shakeIds: Set<string>;
  onPriceChange: (productId: string, price: number) => void;
  onUnlink: (groupId: string) => void;
  onReorder: (newPairs: LinkedPair[]) => void;
  onHelpClick: () => void;
}

export function LinkedPairsSection({
  linkedPairs,
  shakeIds,
  onPriceChange,
  onUnlink,
  onReorder,
  onHelpClick,
}: LinkedPairsSectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = linkedPairs.findIndex((p) => p.pairId === active.id);
    const newIndex = linkedPairs.findIndex((p) => p.pairId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(linkedPairs, oldIndex, newIndex));
  }, [linkedPairs, onReorder]);

  if (linkedPairs.length === 0) return null;

  return (
    <div className="mb-2">
      <div className={`${HEADER_H} flex items-end px-1 pb-1`}>
        <h3 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <Lock className="w-3 h-3" />
          Связанные пары
          <button onClick={onHelpClick} className="text-gray-300 hover:text-gray-500 transition-colors">
            <HelpCircle className="w-3 h-3" />
          </button>
        </h3>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={linkedPairs.map((p) => p.pairId)} strategy={verticalListSortingStrategy}>
          {linkedPairs.map((pair) => (
            <LinkedPairRow
              key={pair.pairId}
              pair={pair}
              shakeIds={shakeIds}
              onPriceChange={onPriceChange}
              onUnlink={onUnlink}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
