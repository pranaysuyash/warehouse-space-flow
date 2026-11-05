/**
 * ABC Velocity Dynamic Re-Slotting (P06) — Phase 3
 * Generates off-peak re-slotting move queue for high-velocity SKUs.
 */

export type VelocityClass = 'A' | 'B' | 'C';

export interface SlotMove {
  palletId: string;
  sku: string;
  fromSlotId: string;
  toSlotId: string;
  reason: string;
  priority: number;
}

export function classifyVelocity(pickCount: number, totalPicks: number): VelocityClass {
  const pct = totalPicks > 0 ? pickCount / totalPicks : 0;
  if (pct >= 0.2) return 'A';
  if (pct >= 0.05) return 'B';
  return 'C';
}

export function generateReslotQueue(
  items: { palletId: string; sku: string; currentSlotId: string; velocityClass: VelocityClass }[],
  frontSlots: string[],
  rearSlots: string[]
): SlotMove[] {
  const moves: SlotMove[] = [];
  let frontIdx = 0;
  // A-class items should be in front slots
  const aItems = items.filter(i => i.velocityClass === 'A' && !frontSlots.includes(i.currentSlotId));
  for (const item of aItems) {
    if (frontIdx < frontSlots.length) {
      moves.push({ palletId: item.palletId, sku: item.sku, fromSlotId: item.currentSlotId, toSlotId: frontSlots[frontIdx], reason: 'A-class velocity: move to front slot for pick efficiency.', priority: 1 });
      frontIdx++;
    }
  }
  // C-class items in front slots should move to rear
  const cInFront = items.filter(i => i.velocityClass === 'C' && frontSlots.includes(i.currentSlotId));
  for (const item of cInFront) {
    if (rearSlots.length > 0) {
      moves.push({ palletId: item.palletId, sku: item.sku, fromSlotId: item.currentSlotId, toSlotId: rearSlots[0], reason: 'C-class velocity: relocate to rear to free front slots.', priority: 2 });
    }
  }
  return moves.sort((a, b) => a.priority - b.priority);
}
