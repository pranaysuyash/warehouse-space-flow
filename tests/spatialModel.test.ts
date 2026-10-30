import { describe, it, expect } from 'vitest';
import {
  createCanonicalFacility,
  createSeedMoveableEntities,
  computeFacilityMetrics,
  getAllSlots,
} from '../src/engine/spatialModel';

describe('P06 Spatial Model & Containment Hierarchy', () => {
  it('creates canonical DC-04 facility with all required operational zones', () => {
    const facility = createCanonicalFacility();
    expect(facility.id).toBe('FACILITY-DC-04');
    expect(facility.zones.length).toBe(7);

    const zoneCodes = facility.zones.map((z) => z.code);
    expect(zoneCodes).toContain('ZD-REC'); // Receiving Docks
    expect(zoneCodes).toContain('ZS-INB'); // Staging Lanes
    expect(zoneCodes).toContain('ZR-AMB'); // Selective High-Bay Racks
    expect(zoneCodes).toContain('ZB-FLR'); // Bulk Floor Slab
    expect(zoneCodes).toContain('ZC-VAULT'); // Cold Storage Vault
    expect(zoneCodes).toContain('ZH-CONT'); // HazMat Spill Pad
    expect(zoneCodes).toContain('ZY-OVERFLOW'); // Yard Container Depot
  });

  it('correctly configures selective rack aisles with 3-tier beam weight limits', () => {
    const facility = createCanonicalFacility();
    const allSlots = getAllSlots(facility);

    const level1Slot = allSlots.find((s) => s.id === 'R01-B01-L1-A');
    const level2Slot = allSlots.find((s) => s.id === 'R01-B01-L2-A');
    const level3Slot = allSlots.find((s) => s.id === 'R01-B01-L3-A');

    expect(level1Slot).toBeDefined();
    expect(level2Slot).toBeDefined();
    expect(level3Slot).toBeDefined();

    // Level 1 allows ground beam max 2,800 lbs; Level 3 max 2,000 lbs
    expect(level1Slot!.maxWeightLbs).toBe(2800);
    expect(level2Slot!.maxWeightLbs).toBe(2500);
    expect(level3Slot!.maxWeightLbs).toBe(2000);

    // Ground-only freight permitted only on Level 1
    expect(level1Slot!.groundOnlyAllowed).toBe(true);
    expect(level2Slot!.groundOnlyAllowed).toBe(false);
    expect(level3Slot!.groundOnlyAllowed).toBe(false);
  });

  it('demonstrates dual-role containerization: container as both asset and storage space', () => {
    const entities = createSeedMoveableEntities();
    const container = entities.find((e) => e.type === 'intermodal_container_53');
    expect(container).toBeDefined();
    expect(container!.isStorageContainer).toBe(true);
    expect(container!.parentLocationId).toBe('YARD-02'); // Asset parked at Yard spot Y-02
    expect(container!.containedEntityIds?.length).toBe(2);

    // Pallets inside the container
    const pallet1 = entities.find((e) => e.id === 'PALLET-YARD-C01');
    expect(pallet1).toBeDefined();
    expect(pallet1!.parentLocationId).toBe(container!.id); // Containment parent is the container!
  });

  it('calculates facility metrics accurately', () => {
    const facility = createCanonicalFacility();
    const metrics = computeFacilityMetrics(facility);

    expect(metrics.totalSlots).toBeGreaterThan(80);
    expect(metrics.availableSlots).toBeGreaterThan(0);
    expect(metrics.occupiedSlots).toBeGreaterThan(0);
    expect(metrics.occupancyPercent).toBeGreaterThan(0);
    expect(metrics.occupancyPercent).toBeLessThan(100);
  });
});
