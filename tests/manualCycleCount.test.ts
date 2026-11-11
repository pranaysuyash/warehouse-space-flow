import { describe, expect, it } from 'vitest';
import { resolveManualCountObservation, runCycleCount } from '../src/engine/cycleCount';

describe('manual cycle count evidence', () => {
  it('requires an entered occupant or an explicit empty declaration', () => {
    expect(resolveManualCountObservation('', false)).toBeNull();
    expect(resolveManualCountObservation('  ', false)).toBeNull();
    expect(resolveManualCountObservation(' PLT-3 ', false)).toEqual({ palletId: 'PLT-3' });
    expect(resolveManualCountObservation('', true)).toEqual({ palletId: null });
    expect(resolveManualCountObservation('PLT-3', true)).toBeNull();
  });
  it('compares a separately entered occupant and an explicitly empty slot', () => {
    const expected = [{ slotId: 'A', occupantId: 'PLT-1', weightLbs: 100 }];
    const wrong = resolveManualCountObservation('PLT-2', false)!;
    const empty = resolveManualCountObservation('', true)!;
    expect(runCycleCount(expected, [{ slotId: 'A', ...wrong, weightLbs: null }], 'operator')[0].status).toBe('mismatch');
    expect(runCycleCount(expected, [{ slotId: 'A', ...empty, weightLbs: null }], 'operator')[0].status).toBe('missing');
  });
});
