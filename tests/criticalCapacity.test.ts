import { describe, expect, it } from 'vitest';
import { createCanonicalFacility, getAllSlots } from '../src/engine/spatialModel';
import { createCanonical40PalletManifest } from '../src/engine/inboundManifest';
import { solvePutawayManifest } from '../src/engine/putawayEngine';
import { executeScanVerification } from '../src/engine/verificationEngine';

describe('Storage eligibility and stale execution', () => {
  it('never allocates a quarantined location', () => {
    const facility = createCanonicalFacility();
    getAllSlots(facility).forEach(slot => { slot.status = 'quarantined'; });
    const result = solvePutawayManifest(facility, createCanonical40PalletManifest());
    expect(result.conflictCount).toBe(result.totalExpected);
    expect(result.recommendations.every(rec => rec.targetSlotId === null)).toBe(true);
  });

  it('cannot overwrite a location occupied after the plan was generated', () => {
    const facility = createCanonicalFacility();
    const rec = solvePutawayManifest(facility, createCanonical40PalletManifest()).recommendations.find(r => r.targetSlotId)!;
    const slot = getAllSlots(facility).find(s => s.id === rec.targetSlotId)!;
    slot.status = 'occupied'; slot.currentOccupantId = 'OTHER-PALLET';
    const result = executeScanVerification(facility, rec, rec.targetLocationCode);
    expect(result.success).toBe(false);
    expect(slot.currentOccupantId).toBe('OTHER-PALLET');
    expect(result.eventGenerated).toBeNull();
  });
});
