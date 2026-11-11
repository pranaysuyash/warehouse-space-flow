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

  it('groups receipt and dispatch totals by unit and rejects mixed-unit scalar totals', () => {
    const g = new GoodsLedger();
    const base = { description: 'Goods', condition: 'good' as const, weightLbs: null, receivedAt: '2026-01-01', slotId: 'S1' };
    g.recordReceipt({ ...base, receiptId: 'R1', customerId: 'C1', sku: 'P', quantity: 5, unit: 'pallet' });
    g.recordReceipt({ ...base, receiptId: 'R2', customerId: 'C1', sku: 'K', quantity: 10, unit: 'kg' });
    g.recordReceipt({ ...base, receiptId: 'R3', customerId: 'C2', sku: 'P', quantity: 3, unit: 'pallet' });
    g.recordDispatch({ dispatchId: 'D1', customerId: 'C1', sku: 'P', quantity: 2, unit: 'pallet', dispatchedAt: '2026-01-02', slotId: 'S1' });
    g.recordDispatch({ dispatchId: 'D2', customerId: 'C1', sku: 'K', quantity: 4, unit: 'kg', dispatchedAt: '2026-01-02', slotId: 'S1' });
    g.recordDispatch({ dispatchId: 'D3', customerId: 'C2', sku: 'P', quantity: 1, unit: 'pallet', dispatchedAt: '2026-01-02', slotId: 'S1' });
    expect(() => g.totalReceived('C1')).toThrow(/different units/i);
    expect(() => g.totalDispatched()).toThrow(/different units/i);
    expect(g.receivedTotalsByUnit()).toEqual([{ unit: 'kg', quantity: 10 }, { unit: 'pallet', quantity: 8 }]);
    expect(g.dispatchedTotalsByUnit('C1')).toEqual([{ unit: 'kg', quantity: 4 }, { unit: 'pallet', quantity: 2 }]);
    expect(g.totalReceived('C2')).toBe(3);
    expect(g.totalDispatched('C2')).toBe(1);
    expect(g.receivedTotalsByUnit('missing')).toEqual([]);
    expect(g.dispatchedTotalsByUnit('')).toEqual([]);
    expect(g.totalReceived('')).toBe(0);
    expect(g.totalDispatched('missing')).toBe(0);
  });

  it('rejects invalid quantities, mismatched units and dispatch from an empty slot', () => {
    const g = new GoodsLedger();
    const receipt = { receiptId: 'R1', customerId: 'C1', sku: 'S', description: 'X', quantity: 5, unit: 'pallet', condition: 'good' as const, weightLbs: 5, receivedAt: '2026-01-01', slotId: 'A' };
    expect(() => g.recordReceipt({ ...receipt, quantity: NaN })).toThrow();
    g.recordReceipt(receipt);
    expect(() => g.recordReceipt({ ...receipt, receiptId: 'R2', unit: 'case' })).toThrow();
    expect(() => g.recordDispatch({ dispatchId: 'D1', customerId: 'C1', sku: 'S', quantity: 1, unit: 'pallet', dispatchedAt: '2026-01-02', slotId: 'B' })).toThrow();
    expect(() => g.recordDispatch({ dispatchId: 'D2', customerId: 'C1', sku: 'S', quantity: 1, unit: 'case', dispatchedAt: '2026-01-02', slotId: 'A' })).toThrow();
    expect(g.onHand('C1', 'S')).toBe(5);
  });

  it('keeps quarantined goods out of dispatch and drops emptied slots from stock', () => {
    const g = new GoodsLedger();
    const receipt = { receiptId: 'R1', customerId: 'C1', sku: 'S', description: 'X', quantity: 2, unit: 'pallet', condition: 'good' as const, weightLbs: 5, receivedAt: '2026-01-01', slotId: 'A' };
    g.recordReceipt(receipt);
    g.recordReceipt({ ...receipt, receiptId: 'R2', slotId: 'B', condition: 'quarantined' });
    expect(() => g.recordDispatch({ dispatchId: 'D1', customerId: 'C1', sku: 'S', quantity: 1, unit: 'pallet', dispatchedAt: '2026-01-02', slotId: 'B' })).toThrow();
    g.recordDispatch({ dispatchId: 'D2', customerId: 'C1', sku: 'S', quantity: 2, unit: 'pallet', dispatchedAt: '2026-01-02', slotId: 'A' });
    expect(g.stockByCustomer('C1')[0].slotIds).toEqual(['B']);
    expect(g.onHand('C1', 'S')).toBe(2);
  });
});
