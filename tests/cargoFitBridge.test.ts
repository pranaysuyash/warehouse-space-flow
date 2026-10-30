import { describe, it, expect } from 'vitest';
import {
  CargoFitVehicleLoad,
  translateCargoFitLoadToInboundManifest,
} from '../src/engine/cargoFitBridge';
import { createCanonicalFacility } from '../src/engine/spatialModel';
import { solvePutawayManifest } from '../src/engine/putawayEngine';

describe('P01 Cargo Fit -> P06 Inbound Warehouse Space Bridge', () => {
  it('translates packed truckload from Cargo Fit into an actionable inbound manifest', () => {
    const mockTruckLoad: CargoFitVehicleLoad = {
      loadId: 'CF-LOAD-ORD-771',
      vehicleType: '53ft Dry Van',
      carrier: 'Schneider National',
      trailerNumber: 'SN-TR-4910',
      destinationFacilityId: 'FACILITY-DC-04',
      totalWeightLbs: 34000,
      packedItems: [
        {
          itemId: 'ITEM-01',
          description: 'Industrial Bearings',
          lengthIn: 48,
          widthIn: 40,
          heightIn: 50,
          weightLbs: 1800,
          temperatureClass: 'ambient',
        },
        {
          itemId: 'ITEM-02',
          description: 'Pharmaceutical Vaccine Totes',
          lengthIn: 48,
          widthIn: 40,
          heightIn: 48,
          weightLbs: 950,
          temperatureClass: 'chilled',
        },
        {
          itemId: 'ITEM-03',
          description: 'Industrial Cleaning Solvents',
          lengthIn: 48,
          widthIn: 48,
          heightIn: 55,
          weightLbs: 2200,
          isHazmat: true,
        },
      ],
    };

    const manifest = translateCargoFitLoadToInboundManifest(mockTruckLoad);

    expect(manifest.manifestId).toBe('MNFST-CF-CF-LOAD-ORD-771');
    expect(manifest.originTruckLoadId).toBe('CF-LOAD-ORD-771');
    expect(manifest.items.length).toBe(3);

    expect(manifest.items[0].environmentalClass).toBe('ambient');
    expect(manifest.items[1].environmentalClass).toBe('chilled');
    expect(manifest.items[2].environmentalClass).toBe('hazmat');

    // Feed translated manifest directly into the putaway engine
    const facility = createCanonicalFacility();
    const result = solvePutawayManifest(facility, manifest);

    expect(result.totalExpected).toBe(3);
    // Native unknown pre-stock mass can make a bulk-floor alternative safer
    // than an individually eligible rack. Complete compatible coverage is the
    // bridge's contract, rather than an optimistic preference category.
    expect(result.proposedCount + result.alternativeCount).toBe(3);
    expect(result.conflictCount).toBe(0);
    expect(result.recommendations.map(item => item.palletId)).toEqual(manifest.items.map(item => item.palletId));
    expect(new Set(result.recommendations.map(item => item.targetSlotId)).size).toBe(3);
  });
});
