import { describe, it, expect } from 'vitest';
import { computePutawayCost } from '../src/engine/putawayEngine';

describe('P06 Putaway Cost Model', () => {
  it('computes cost with default dock origin', () => {
    const slot: any = { canvasCoords: { x: 100, y: 100 }, level: 2, maxWeightLbs: 2000 };
    const c = computePutawayCost(slot, { weightLbs: 1500 });
    expect(c).toBeGreaterThan(0);
  });

  it('higher level increases cost', () => {
    const s1: any = { canvasCoords: { x: 100, y: 100 }, level: 1, maxWeightLbs: 2000 };
    const s2: any = { canvasCoords: { x: 100, y: 100 }, level: 3, maxWeightLbs: 2000 };
    expect(computePutawayCost(s2, { weightLbs: 1000 })).toBeGreaterThan(computePutawayCost(s1, { weightLbs: 1000 }));
  });

  it('accepts custom dock origin', () => {
    const slot: any = { canvasCoords: { x: 50, y: 50 }, level: 1, maxWeightLbs: 2000 };
    const c = computePutawayCost(slot, { weightLbs: 1000 }, { dockOrigin: { x: 0, y: 0 } });
    expect(c).toBeGreaterThan(0);
  });
});
