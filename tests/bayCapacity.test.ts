import { describe, expect, it } from 'vitest';
import { createCanonicalFacility } from '../src/engine/spatialModel';
import { createCanonical40PalletManifest } from '../src/engine/inboundManifest';
import { solvePutawayManifest } from '../src/engine/putawayEngine';

describe('Shared rack bay capacity', () => {
  it('does not exceed the bay rating when individually eligible slots remain', () => {
    const facility = createCanonicalFacility();
    facility.zones = facility.zones.filter(zone => zone.id === 'ZONE-RACKS');
    facility.zones[0].slots = facility.zones[0].slots.filter(slot => slot.aisle === 'R01' && slot.bay === 'B01');
    for (const slot of facility.zones[0].slots) { slot.status = 'available'; delete slot.currentOccupantId; }
    const manifest = createCanonical40PalletManifest();
    manifest.items = manifest.items.slice(0, 4).map(item => ({ ...item, weightLbs: 2000 }));
    const result = solvePutawayManifest(facility, manifest);
    const assigned = result.recommendations.filter(item => item.targetSlotId);
    expect(assigned.reduce((sum, item) => sum + item.weightLbs, 0)).toBeLessThanOrEqual(6000);
    expect(assigned).toHaveLength(3);
    expect(result.conflictCount).toBe(1);
    expect(result.recommendations[3].violations?.some(reason => reason.includes('bay'))).toBe(true);
  });
});
