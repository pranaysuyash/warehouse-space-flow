import { describe, it, expect } from 'vitest';
import { matchCrossDock } from '../src/engine/crossDockMatcher';

describe('P06 Cross-Dock Matcher', () => {
  it('cross-docks when outbound departs within 4h', () => {
    const now = '2026-01-01T10:00:00Z';
    const orders = [{ orderId: 'O1', sku: 'SKU1', quantity: 5, requiredBy: '2026-01-01T12:00:00Z', destination: 'NYC' }];
    const r = matchCrossDock([{ palletId: 'P1', sku: 'SKU1', quantity: 5 }], orders, now);
    expect(r[0].action).toBe('cross_dock');
  });
  it('putaways when outbound departs after 4h', () => {
    const now = '2026-01-01T10:00:00Z';
    const orders = [{ orderId: 'O1', sku: 'SKU1', quantity: 5, requiredBy: '2026-01-02T10:00:00Z', destination: 'NYC' }];
    const r = matchCrossDock([{ palletId: 'P1', sku: 'SKU1', quantity: 5 }], orders, now);
    expect(r[0].action).toBe('putaway');
  });
  it('putaways when no matching order', () => {
    const r = matchCrossDock([{ palletId: 'P1', sku: 'SKU1', quantity: 5 }], [], '2026-01-01T10:00:00Z');
    expect(r[0].action).toBe('putaway');
    expect(r[0].reason).toContain('No matching');
  });
  it('picks earliest requiredBy', () => {
    const now = '2026-01-01T10:00:00Z';
    const orders = [
      { orderId: 'O1', sku: 'SKU1', quantity: 5, requiredBy: '2026-01-01T13:00:00Z', destination: 'NYC' },
      { orderId: 'O2', sku: 'SKU1', quantity: 5, requiredBy: '2026-01-01T11:30:00Z', destination: 'LA' },
    ];
    const r = matchCrossDock([{ palletId: 'P1', sku: 'SKU1', quantity: 5 }], orders, now);
    expect(r[0].outboundOrderId).toBe('O2');
  });
});
