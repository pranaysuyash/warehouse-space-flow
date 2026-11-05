import { describe, it, expect } from 'vitest';
import {
  calculateWarehouseDistance,
  optimizeWavePickPath,
  SAMPLE_OUTBOUND_WAVE_ITEMS,
  PickItem,
} from '../src/engine/wavePickingTsp';

describe('Distribution Center Outbound Wave Picking & TSP Optimizer', () => {
  it('calculates rectilinear warehouse distance including cross-aisle travel', () => {
    // Same aisle test: Aisle 1, Bay 2 (y=16) to Bay 8 (y=64) -> 48 ft
    const dSame = calculateWarehouseDistance(
      { xFt: 14, yFt: 16, zFt: 0, aisleNum: 1 },
      { xFt: 14, yFt: 64, zFt: 0, aisleNum: 1 }
    );
    expect(dSame).toBe(48);

    // Cross-aisle test: Aisle 1 (x=14, y=10) to Aisle 2 (x=28, y=10)
    // Distance = dx (14) + min(10+10, 86+86) = 14 + 20 = 34 ft
    const dCross = calculateWarehouseDistance(
      { xFt: 14, yFt: 10, zFt: 0, aisleNum: 1 },
      { xFt: 28, yFt: 10, zFt: 0, aisleNum: 2 }
    );
    expect(dCross).toBe(34);
  });

  it('optimizes pick sequence using TSP heuristic and achieves material distance reduction', () => {
    const res = optimizeWavePickPath(SAMPLE_OUTBOUND_WAVE_ITEMS);

    expect(res.totalItemsCount).toBe(6);
    expect(res.optimizedDistanceFt).toBeLessThan(res.unoptimizedDistanceFt);
    expect(res.distanceSavedFt).toBeGreaterThan(0);
    expect(res.distanceReductionPct).toBeGreaterThan(15); // >15% travel savings
    expect(res.fefoAuditPassed).toBe(true);
    expect(res.estimatedPickDurationMinutes).toBeGreaterThan(0);
  });

  it('detects and flags quarantined inventory lots in wave pick list', () => {
    const itemsWithQuarantine: PickItem[] = [
      ...SAMPLE_OUTBOUND_WAVE_ITEMS,
      {
        id: 'PICK-QUAR',
        sku: 'SKU-RECALL-99',
        description: 'Recalled Baby Formula',
        orderId: 'ORD-9042',
        locationCode: 'A03-B01-L1',
        aisleNum: 3,
        bayNum: 1,
        level: 1,
        coords: { xFt: 42, yFt: 8, zFt: 0 },
        qty: 1,
        weightLb: 20,
        lotNumber: 'LOT-BAD-001',
        expirationDate: '2026-05-01',
        isQuarantined: true, // Quarantined lot!
      },
    ];

    const res = optimizeWavePickPath(itemsWithQuarantine);
    expect(res.fefoAuditPassed).toBe(false);
    expect(res.fefoWarnings.length).toBe(1);
    expect(res.fefoWarnings[0]).toContain('QUARANTINE ALERT');
  });
});
