import { describe, it, expect } from 'vitest';
import { checkSlotSuitability } from '../src/engine/putawayEngine';
import { createCanonicalFacility } from '../src/engine/spatialModel';
import type { HazmatPolicyConfig } from '../src/engine/hazmatPolicy';

describe('HazMat policy in putaway suitability', () => {
  const facility = createCanonicalFacility();
  const hazmatSlot = facility.zones.flatMap(z => z.slots).find(s => s.allowedClasses.includes('hazmat'))!;

  it('rejects when site policy forbids co-located class', () => {
    const policy: HazmatPolicyConfig = { siteId: 'S1', forbiddenPairs: [['3','5.1']] };
    const item = {
      environmentalClass: 'hazmat' as const,
      packageType: 'DRUM',
      weightLbs: 500,
      dimensions: { lengthIn: 24, widthIn: 24, heightIn: 36 },
      groundOnly: true,
      hazmatClass: '3',
    };
    const ok = checkSlotSuitability(item, hazmatSlot, { hazmatPolicy: policy, coLocatedHazmatClasses: [] });
    expect(ok.compatible).toBe(true);
    const bad = checkSlotSuitability(item, hazmatSlot, { hazmatPolicy: policy, coLocatedHazmatClasses: ['5.1'] });
    expect(bad.compatible).toBe(false);
    expect(bad.violation).toContain('HazMat policy conflict');
  });

  it('preserves compatibility when no policy/options provided', () => {
    const item = {
      environmentalClass: 'hazmat' as const,
      packageType: 'DRUM',
      weightLbs: 500,
      dimensions: { lengthIn: 24, widthIn: 24, heightIn: 36 },
      groundOnly: true,
      hazmatClass: '3',
    };
    const r = checkSlotSuitability(item, hazmatSlot);
    expect(r.compatible).toBe(true);
  });
});
