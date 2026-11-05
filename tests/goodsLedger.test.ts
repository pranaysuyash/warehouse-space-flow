import { describe, it, expect } from 'vitest';
import { GoodsLedger } from '../src/engine/goodsLedger';

describe('P06 Goods Ledger', () => {
  it('records receipt and tracks on-hand', () => {
    const g = new GoodsLedger();
    g.recordReceipt({ receiptId: 'R1', customerId: 'C1', sku: 'SKU1', description: 'Bolts', quantity: 10, unit: 'pallet', condition: 'good', weightLbs: 100, receivedAt: '2026-01-01', slotId: 'S1' });
    expect(g.onHand('C1', 'SKU1')).toBe(10);
  });

  it('rejects dispatch exceeding on-hand', () => {
    const g = new GoodsLedger();
    g.recordReceipt({ receiptId: 'R1', customerId: 'C1', sku: 'SKU1', description: 'Bolts', quantity: 5, unit: 'pallet', condition: 'good', weightLbs: 50, receivedAt: '2026-01-01', slotId: 'S1' });
    expect(() => g.recordDispatch({ dispatchId: 'D1', customerId: 'C1', sku: 'SKU1', quantity: 10, unit: 'pallet', dispatchedAt: '2026-01-02', slotId: 'S1' })).toThrow();
  });

  it('records dispatch and reduces on-hand', () => {
    const g = new GoodsLedger();
    g.recordReceipt({ receiptId: 'R1', customerId: 'C1', sku: 'SKU1', description: 'Bolts', quantity: 10, unit: 'pallet', condition: 'good', weightLbs: 100, receivedAt: '2026-01-01', slotId: 'S1' });
    g.recordDispatch({ dispatchId: 'D1', customerId: 'C1', sku: 'SKU1', quantity: 4, unit: 'pallet', dispatchedAt: '2026-01-02', slotId: 'S1' });
    expect(g.onHand('C1', 'SKU1')).toBe(6);
  });

  it('stockByCustomer returns correct', () => {
    const g = new GoodsLedger();
    g.recordReceipt({ receiptId: 'R1', customerId: 'C1', sku: 'SKU1', description: 'Bolts', quantity: 10, unit: 'pallet', condition: 'good', weightLbs: 100, receivedAt: '2026-01-01', slotId: 'S1' });
    g.recordReceipt({ receiptId: 'R2', customerId: 'C1', sku: 'SKU2', description: 'Nuts', quantity: 5, unit: 'box', condition: 'good', weightLbs: 25, receivedAt: '2026-01-01', slotId: 'S2' });
    const stock = g.stockByCustomer('C1');
    expect(stock.length).toBe(2);
    expect(stock.find(s => s.sku === 'SKU1')?.quantityOnHand).toBe(10);
  });

  it('rejects non-positive quantities', () => {
    const g = new GoodsLedger();
    expect(() => g.recordReceipt({ receiptId: 'R1', customerId: 'C1', sku: 'SKU1', description: 'X', quantity: 0, unit: 'pallet', condition: 'good', weightLbs: 0, receivedAt: '2026-01-01', slotId: 'S1' })).toThrow();
    expect(() => g.recordDispatch({ dispatchId: 'D1', customerId: 'C1', sku: 'SKU1', quantity: -1, unit: 'pallet', dispatchedAt: '2026-01-02', slotId: 'S1' })).toThrow();
  });

  it('totals received/dispatched', () => {
    const g = new GoodsLedger();
    g.recordReceipt({ receiptId: 'R1', customerId: 'C1', sku: 'SKU1', description: 'X', quantity: 10, unit: 'pallet', condition: 'good', weightLbs: 100, receivedAt: '2026-01-01', slotId: 'S1' });
    g.recordReceipt({ receiptId: 'R2', customerId: 'C2', sku: 'SKU1', description: 'X', quantity: 5, unit: 'pallet', condition: 'good', weightLbs: 50, receivedAt: '2026-01-01', slotId: 'S2' });
    expect(g.totalReceived()).toBe(15);
    expect(g.totalReceived('C1')).toBe(10);
  });
});
