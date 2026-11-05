/**
 * Goods Ledger (P06) — Phase 3
 * Customer-wise stock tracking: inward/outward register, quantity, condition, location.
 * Separate bounded context from space ledger (P09). Shares physical facility via spaceId.
 */

export interface GoodsReceipt {
  receiptId: string;
  customerId: string;
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  condition: 'good' | 'damaged' | 'quarantined';
  weightLbs: number;
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

export class GoodsLedger {
  private receipts: GoodsReceipt[] = [];
  private dispatches: GoodsDispatch[] = [];

  recordReceipt(r: GoodsReceipt): void {
    if (r.quantity <= 0) throw new Error('Receipt quantity must be positive.');
    this.receipts.push(r);
  }

  recordDispatch(d: GoodsDispatch): void {
    if (d.quantity <= 0) throw new Error('Dispatch quantity must be positive.');
    const onHand = this.onHand(d.customerId, d.sku);
    if (d.quantity > onHand) throw new Error(`Insufficient stock: ${onHand} available, ${d.quantity} requested.`);
    this.dispatches.push(d);
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
      slotIds: [...new Set(this.receipts.filter(r => r.customerId === customerId && r.sku === sku).map(r => r.slotId))],
      lastMovementAt: this.lastMovement(customerId, sku),
    }));
  }

  totalReceived(customerId?: string): number {
    const filtered = customerId ? this.receipts.filter(r => r.customerId === customerId) : this.receipts;
    return filtered.reduce((s, r) => s + r.quantity, 0);
  }

  totalDispatched(customerId?: string): number {
    const filtered = customerId ? this.dispatches.filter(d => d.customerId === customerId) : this.dispatches;
    return filtered.reduce((s, d) => s + d.quantity, 0);
  }

  getReceipts(customerId?: string): GoodsReceipt[] {
    return customerId ? this.receipts.filter(r => r.customerId === customerId) : [...this.receipts];
  }

  getDispatches(customerId?: string): GoodsDispatch[] {
    return customerId ? this.dispatches.filter(d => d.customerId === customerId) : [...this.dispatches];
  }

  private lastMovement(customerId: string, sku: string): string {
    const r = this.receipts.filter(x => x.customerId === customerId && x.sku === sku).map(x => x.receivedAt).sort().pop();
    const d = this.dispatches.filter(x => x.customerId === customerId && x.sku === sku).map(x => x.dispatchedAt).sort().pop();
    return [r, d].filter(Boolean).sort().pop() ?? '';
  }
}

export function isTemperatureCompatible(itemMin: number, itemMax: number, slotMin: number, slotMax: number): boolean {
  return itemMin <= slotMax && itemMax >= slotMin;
}
