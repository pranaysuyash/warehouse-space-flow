/**
 * Goods Ledger (P06) — Phase 3
 * Customer-wise stock tracking: inward/outward register, quantity, condition, location.
 * Separate bounded context from space ledger (P09). Shares physical facility via spaceId.
 */

import { maintainedRangeFits } from './temperatureRange';

export interface GoodsReceipt {
  receiptId: string;
  customerId: string;
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  condition: 'good' | 'damaged' | 'quarantined';
  weightLbs: number | null;
  receivedAt: string;
  slotId: string;
  manifestId?: string;
}

export interface GoodsDispatch {
  dispatchId: string;
  customerId: string;
  sku: string;
  quantity: number;
  unit: string;
  dispatchedAt: string;
  slotId: string;
  destination?: string;
}

export interface CustomerStock {
  customerId: string;
  sku: string;
  quantityOnHand: number;
  unit: string;
  slotIds: string[];
  lastMovementAt: string;
}

export interface UnitMovementTotal {
  unit: string;
  quantity: number;
}

function movementTotalsByUnit(movements: readonly { customerId: string; unit: string; quantity: number }[], customerId?: string): UnitMovementTotal[] {
  const totals = new Map<string, number>();
  for (const movement of movements) {
    if (customerId !== undefined && movement.customerId !== customerId) continue;
    const next = (totals.get(movement.unit) ?? 0) + movement.quantity;
    if (!Number.isFinite(next)) throw new Error('Movement total exceeds the supported numeric range.');
    totals.set(movement.unit, next);
  }
  return [...totals].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([unit, quantity]) => ({ unit, quantity }));
}

function singleUnitTotal(totals: UnitMovementTotal[]): number {
  if (totals.length > 1) throw new Error('Cannot combine quantities with different units. Use totals grouped by unit.');
  return totals[0]?.quantity ?? 0;
}

export class GoodsLedger {
  private receipts: GoodsReceipt[] = [];
  private dispatches: GoodsDispatch[] = [];

  recordReceipt(r: GoodsReceipt): void {
    if (!Number.isFinite(r.quantity) || r.quantity <= 0) throw new Error('Receipt quantity must be finite and positive.');
    if (![r.receiptId, r.customerId, r.sku, r.unit, r.slotId].every(value => typeof value === 'string' && value.trim())) throw new Error('Receipt needs an ID, customer, SKU, unit and slot.');
    if (this.receipts.some(existing => existing.receiptId === r.receiptId)) throw new Error('Receipt ID already exists.');
    const existing = this.receipts.find(receipt => receipt.customerId === r.customerId && receipt.sku === r.sku);
    if (existing && existing.unit !== r.unit) throw new Error('The customer and SKU already use a different unit.');
    this.receipts.push({ ...r });
  }

  recordDispatch(d: GoodsDispatch): void {
    if (!Number.isFinite(d.quantity) || d.quantity <= 0) throw new Error('Dispatch quantity must be finite and positive.');
    if (![d.dispatchId, d.customerId, d.sku, d.unit, d.slotId].every(value => typeof value === 'string' && value.trim())) throw new Error('Dispatch needs an ID, customer, SKU, unit and slot.');
    if (this.dispatches.some(existing => existing.dispatchId === d.dispatchId)) throw new Error('Dispatch ID already exists.');
    const existing = this.receipts.find(receipt => receipt.customerId === d.customerId && receipt.sku === d.sku);
    if (existing && existing.unit !== d.unit) throw new Error('Dispatch unit differs from the recorded stock unit.');
    const received = this.receipts.filter(r => r.customerId === d.customerId && r.sku === d.sku && r.slotId === d.slotId && r.condition === 'good').reduce((s, r) => s + r.quantity, 0);
    const dispatched = this.dispatches.filter(r => r.customerId === d.customerId && r.sku === d.sku && r.slotId === d.slotId).reduce((s, r) => s + r.quantity, 0);
    const available = received - dispatched;
    if (d.quantity > available) throw new Error(`Insufficient good stock in slot ${d.slotId}: ${available} available, ${d.quantity} requested.`);
    this.dispatches.push({ ...d });
  }

  onHand(customerId: string, sku: string): number {
    const inQty = this.receipts.filter(r => r.customerId === customerId && r.sku === sku).reduce((s, r) => s + r.quantity, 0);
    const outQty = this.dispatches.filter(d => d.customerId === customerId && d.sku === sku).reduce((s, d) => s + d.quantity, 0);
    return inQty - outQty;
  }

  stockByCustomer(customerId: string): CustomerStock[] {
    const skus = new Set(this.receipts.filter(r => r.customerId === customerId).map(r => r.sku));
    return [...skus].map(sku => ({
      customerId,
      sku,
      quantityOnHand: this.onHand(customerId, sku),
      unit: this.receipts.find(r => r.customerId === customerId && r.sku === sku)?.unit ?? '',
      slotIds: [...new Set(this.receipts.filter(r => r.customerId === customerId && r.sku === sku).map(r => r.slotId))].filter(slotId => {
        const received = this.receipts.filter(r => r.customerId === customerId && r.sku === sku && r.slotId === slotId).reduce((sum, r) => sum + r.quantity, 0);
        const dispatched = this.dispatches.filter(d => d.customerId === customerId && d.sku === sku && d.slotId === slotId).reduce((sum, d) => sum + d.quantity, 0);
        return received > dispatched;
      }),
      lastMovementAt: this.lastMovement(customerId, sku),
    }));
  }

  totalReceived(customerId?: string): number {
    return singleUnitTotal(this.receivedTotalsByUnit(customerId));
  }

  totalDispatched(customerId?: string): number {
    return singleUnitTotal(this.dispatchedTotalsByUnit(customerId));
  }

  receivedTotalsByUnit(customerId?: string): UnitMovementTotal[] {
    return movementTotalsByUnit(this.receipts, customerId);
  }

  dispatchedTotalsByUnit(customerId?: string): UnitMovementTotal[] {
    return movementTotalsByUnit(this.dispatches, customerId);
  }

  getReceipts(customerId?: string): GoodsReceipt[] {
    return (customerId ? this.receipts.filter(r => r.customerId === customerId) : this.receipts).map(r => ({ ...r }));
  }

  getDispatches(customerId?: string): GoodsDispatch[] {
    return (customerId ? this.dispatches.filter(d => d.customerId === customerId) : this.dispatches).map(d => ({ ...d }));
  }

  private lastMovement(customerId: string, sku: string): string {
    const r = this.receipts.filter(x => x.customerId === customerId && x.sku === sku).map(x => x.receivedAt).sort().pop();
    const d = this.dispatches.filter(x => x.customerId === customerId && x.sku === sku).map(x => x.dispatchedAt).sort().pop();
    return [r, d].filter(Boolean).sort().pop() ?? '';
  }
}

export function isTemperatureCompatible(itemMin: number, itemMax: number, slotMin: number, slotMax: number): boolean {
  return maintainedRangeFits({ min: itemMin, max: itemMax }, { min: slotMin, max: slotMax });
}
