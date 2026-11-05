import { describe, it, expect } from 'vitest';
import { runCycleCount, cycleCountSummary } from '../src/engine/cycleCount';

describe('P06 Cycle Count', () => {
  it('reports match when expected == actual', () => {
    const r = runCycleCount([{ slotId: 'S1', occupantId: 'P1', weightLbs: 100 }], [{ slotId: 'S1', palletId: 'P1', weightLbs: 100 }], 'op');
    expect(r[0].status).toBe('match');
  });
  it('reports mismatch when pallet differs', () => {
    const r = runCycleCount([{ slotId: 'S1', occupantId: 'P1', weightLbs: 100 }], [{ slotId: 'S1', palletId: 'P2', weightLbs: 100 }], 'op');
    expect(r[0].status).toBe('mismatch');
  });
  it('reports missing when slot empty but expected occupied', () => {
    const r = runCycleCount([{ slotId: 'S1', occupantId: 'P1', weightLbs: 100 }], [{ slotId: 'S1', palletId: null, weightLbs: null }], 'op');
    expect(r[0].status).toBe('missing');
  });
  it('reports unexpected when slot occupied but expected empty', () => {
    const r = runCycleCount([{ slotId: 'S1', occupantId: null, weightLbs: null }], [{ slotId: 'S1', palletId: 'P1', weightLbs: 50 }], 'op');
    expect(r[0].status).toBe('unexpected');
  });
  it('reports missing when slot not observed', () => {
    const r = runCycleCount([{ slotId: 'S1', occupantId: 'P1', weightLbs: 100 }], [], 'op');
    expect(r[0].status).toBe('missing');
  });
  it('reports unexpected for observed slot not in expected list', () => {
    const r = runCycleCount([], [{ slotId: 'S2', palletId: 'P1', weightLbs: 50 }], 'op');
    expect(r[0].status).toBe('unexpected');
  });
  it('summary computes accuracy', () => {
    const r = runCycleCount([{ slotId: 'S1', occupantId: 'P1', weightLbs: 100 }, { slotId: 'S2', occupantId: 'P2', weightLbs: 50 }], [{ slotId: 'S1', palletId: 'P1', weightLbs: 100 }, { slotId: 'S2', palletId: 'P3', weightLbs: 50 }], 'op');
    const s = cycleCountSummary(r);
    expect(s.total).toBe(2);
    expect(s.match).toBe(1);
    expect(s.mismatch).toBe(1);
    expect(s.accuracyPercent).toBe(50);
  });
});
