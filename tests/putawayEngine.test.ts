import { describe, it, expect } from 'vitest';
import { createCanonicalFacility } from '../src/engine/spatialModel';
import { createCanonical40PalletManifest } from '../src/engine/inboundManifest';
import { solvePutawayManifest } from '../src/engine/putawayEngine';

describe('P06 Multi-Constraint Putaway Engine', () => {
  it('solves 40-pallet inbound manifest with categorized recommendations', () => {
    const facility = createCanonicalFacility();
    const manifest = createCanonical40PalletManifest();

    expect(manifest.items.length).toBe(40);

    const result = solvePutawayManifest(facility, manifest);

    expect(result.totalExpected).toBe(40);
    expect(result.recommendations.length).toBe(40);

    // Unknown pre-stock mass conservatively consumes its position's rating.
    // Coverage must reconcile; an optimistic fit count is not a safety oracle.
    expect(result.proposedCount).toBeGreaterThan(0);
    expect(result.alternativeCount).toBeGreaterThan(0);
    expect(result.conflictCount).toBeGreaterThanOrEqual(2);
    expect(result.proposedCount + result.alternativeCount + result.conflictCount).toBe(40);
  });

  it('correctly isolates cold-chain pallets to cold storage vault', () => {
    const facility = createCanonicalFacility();
    const manifest = createCanonical40PalletManifest();
    const result = solvePutawayManifest(facility, manifest);

    // Pallets 29 to 32 are chilled dairy
    const coldPallet29 = result.recommendations.find((r) => r.palletId === 'PLT-INB-29');
    expect(coldPallet29).toBeDefined();
    expect(coldPallet29!.status).toBe('proposed');
    expect(coldPallet29!.targetSlotId).toMatch(/^COLD-/);
    expect(coldPallet29!.targetZoneName).toContain('Cold');
  });

  it('routes HazMat pallets to certified spill-containment pad', () => {
    const facility = createCanonicalFacility();
    const manifest = createCanonical40PalletManifest();
    const result = solvePutawayManifest(facility, manifest);

    const hazPallet33 = result.recommendations.find((r) => r.palletId === 'PLT-INB-33');
    expect(hazPallet33).toBeDefined();
    expect(hazPallet33!.status).toBe('proposed');
    expect(hazPallet33!.targetSlotId).toMatch(/^HAZ-/);
  });

  it('diverts heavy machinery skid (>2,800 lbs) to slab-on-grade bulk floor', () => {
    const facility = createCanonicalFacility();
    const manifest = createCanonical40PalletManifest();
    const result = solvePutawayManifest(facility, manifest);

    // Pallet 35 is 3,450 lbs, exceeds rack level rating
    const heavyPallet35 = result.recommendations.find((r) => r.palletId === 'PLT-INB-35');
    expect(heavyPallet35).toBeDefined();
    expect(heavyPallet35!.status).toBe('alternative');
    expect(heavyPallet35!.targetSlotId).toMatch(/^BLK-/);
    expect(heavyPallet35!.reason).toContain('bulk floor');
  });

  it('flags unaccommodated extreme constraint items as conflicts with itemized violations', () => {
    const facility = createCanonicalFacility();
    const manifest = createCanonical40PalletManifest();
    const result = solvePutawayManifest(facility, manifest);

    // Pallet 39: 9,200 lbs (exceeds even 8,500 lbs slab limit)
    const conflict39 = result.recommendations.find((r) => r.palletId === 'PLT-INB-39');
    expect(conflict39).toBeDefined();
    expect(conflict39!.status).toBe('conflict');
    expect(conflict39!.targetSlotId).toBeNull();
    expect(conflict39!.violations).toBeDefined();
    expect(conflict39!.violations!.some((v) => v.includes('weight'))).toBe(true);

    // Pallet 40: 104" height (exceeds all available clearances)
    const conflict40 = result.recommendations.find((r) => r.palletId === 'PLT-INB-40');
    expect(conflict40).toBeDefined();
    expect(conflict40!.status).toBe('conflict');
    expect(conflict40!.targetSlotId).toBeNull();
    expect(conflict40!.violations!.some((v) => v.includes('height'))).toBe(true);
  });
});
