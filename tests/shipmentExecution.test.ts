import { describe, expect, it } from 'vitest';
import { createCanonicalFacility, findSlotById, getAllSlots } from '../src/engine/spatialModel';
import { bayCapacityForSlot, solvePutawayManifest } from '../src/engine/putawayEngine';
import { facilityForShipment, inboundForShipment, resultForReceivingPlan, validateManualReceipt } from '../src/engine/shipmentAdapter';
import { executeScanVerification } from '../src/engine/verificationEngine';
import type { Shipment } from '../src/suite/types';

const resources = { warehouseSlotIds: [] as string[], yardDoorIds: [] as string[] };
function fixture(): Shipment {
  return {
    id: 'shipment-A', reference: 'RECEIVING-TEST', mode: 'local_scenario', revision: 4, inputRevision: 2,
    input: { origin: 'Origin', destination: 'Destination', loadedMiles: 100, deadheadMiles: 5, equipmentId: 'dryvan-53', carrierDot: '123', driverId: 'driver', tractorId: 'tractor', trailerId: 'trailer', priorRestHours: 10,
      units: [{ id: 'original-01', barcode: '000AbC', description: 'Repeated description', lengthIn: 48, widthIn: 40, heightIn: 50, weightLbs: 1250, stackable: false, temperatureClass: 'ambient' }, { id: 'original-02', barcode: '000XyZ', description: 'Repeated description', lengthIn: 48, widthIn: 40, heightIn: 50, weightLbs: 1500, stackable: false, temperatureClass: 'ambient' }] },
    results: { fit: { ok: true, summary: 'Reviewed', details: {}, recordedAt: '2026-10-22T17:00:00.000Z', inputRevision: 2, productId: 'product-01-cargo-fit' } }, status: 'draft', events: [], exceptions: [], operations: {},
  };
}
function reviewed() {
  const shipment = fixture();
  const manifest = inboundForShipment(shipment);
  const facility = createCanonicalFacility();
  const solution = solvePutawayManifest(facility, manifest);
  return { shipment, manifest, facility, solution };
}

describe('Reviewed native receiving and manual receipt', () => {
  it('retains the exact reviewed result, manifest, physical identities, fit binding and reservation snapshot', () => {
    const { shipment, manifest, facility, solution } = reviewed();
    const before = structuredClone({ facility, manifest, solution });
    const result = resultForReceivingPlan(shipment, facility, manifest, solution, resources);
    expect(result.ok).toBe(true);
    expect(result.details.nativeResult).toEqual(solution);
    expect(result.details.nativeManifest).toEqual(manifest);
    expect(result.details.reservationSnapshot).toEqual(resources);
    expect(result.details.reviewedRecordRevision).toBe(4);
    expect(result.details.fitRecordedAt).toBe(shipment.results.fit!.recordedAt);
    expect(result.details.assignments).toEqual(solution.recommendations.map(rec => ({ unitId: rec.palletId, barcode: rec.barcode, slotId: rec.targetSlotId, slotCode: rec.targetLocationCode })));
    expect({ facility, manifest, solution }).toEqual(before);
  });

  it.each(['missing', 'stale'] as const)('refuses %s current fit evidence', state => {
    const { shipment, manifest, facility, solution } = reviewed();
    if (state === 'missing') delete shipment.results.fit;
    else shipment.results.fit!.inputRevision--;
    expect(() => resultForReceivingPlan(shipment, facility, manifest, solution, resources)).toThrow(/Cargo Fit/);
  });

  it('abstains when the shared reservations are unknown', () => {
    const { shipment, manifest, facility, solution } = reviewed();
    expect(() => resultForReceivingPlan(shipment, facility, manifest, solution, null)).toThrow(/reservations/);
  });

  it('rejects edited manifest metadata and identity rather than publishing a different native record', () => {
    const { shipment, manifest, facility, solution } = reviewed();
    manifest.dockAssigned = 'Fabricated dock';
    expect(() => resultForReceivingPlan(shipment, facility, manifest, solution, resources)).toThrow(/manifest differs/);
  });

  it('rejects changed barcodes and duplicate receiving locations', () => {
    const { shipment, manifest, facility, solution } = reviewed();
    const altered = structuredClone(solution);
    altered.recommendations[0].barcode = '000abc';
    expect(() => resultForReceivingPlan(shipment, facility, manifest, altered, resources)).toThrow(/identity/);
    altered.recommendations = structuredClone(solution.recommendations);
    altered.recommendations[1].targetSlotId = altered.recommendations[0].targetSlotId;
    altered.recommendations[1].targetLocationCode = altered.recommendations[0].targetLocationCode;
    expect(() => resultForReceivingPlan(shipment, facility, manifest, altered, resources)).toThrow(/unavailable/);
  });

  it('rechecks current reservations without silently re-solving the reviewed selection', () => {
    const { shipment, manifest, facility, solution } = reviewed();
    expect(() => resultForReceivingPlan(shipment, facility, manifest, solution, { ...resources, warehouseSlotIds: [solution.recommendations[0].targetSlotId!] })).toThrow(/unavailable/);
  });

  it('projects an accepted reservation and receipt with actual declared mass', () => {
    const { shipment, manifest, facility, solution } = reviewed();
    const result = resultForReceivingPlan(shipment, facility, manifest, solution, resources);
    shipment.results.warehouse = { ...result, inputRevision: 2, recordedAt: '2026-10-22T17:01:00.000Z', productId: 'product-06-warehouse-space-flow' };
    const slotId = solution.recommendations[0].targetSlotId!;
    expect(findSlotById(facilityForShipment(shipment, resources), slotId)).toMatchObject({ status: 'reserved_inbound', reservedPalletId: 'original-01', reservedWeightLbs: 1250 });
    shipment.delivery = { receiver: 'Receiver', receivedAt: '2026-10-22T18:00:00.000Z', units: [] };
    expect(findSlotById(facilityForShipment(shipment, resources), slotId)).toMatchObject({ status: 'occupied', currentOccupantId: 'original-01', currentWeightLbs: 1250 });
  });

  it('restores released external reservations from their declared baseline and treats new mass as unknown', () => {
    const { shipment, manifest, facility } = reviewed();
    const external = getAllSlots(facility).find(slot => slot.type === 'rack_bin' && slot.status === 'available')!;
    external.status = 'blocked';
    external.currentWeightLbs = 10;
    shipment.results.warehouse = { ok: false, summary: 'Earlier review', inputRevision: 2, recordedAt: '2026-10-22T17:01:00.000Z', productId: 'product-06-warehouse-space-flow', details: { facilitySnapshot: facility, reservationSnapshot: { ...resources, warehouseSlotIds: [external.id] } } };
    expect(findSlotById(facilityForShipment(shipment, resources), external.id)?.status).toBe('available');
    const current = facilityForShipment(shipment, { ...resources, warehouseSlotIds: [external.id] });
    const blocked = findSlotById(current, external.id)!;
    expect(blocked.status).toBe('blocked');
    expect(blocked.currentWeightLbs).toBeUndefined();
    expect(bayCapacityForSlot(blocked, getAllSlots(current))!.unknownMassCount).toBeGreaterThan(0);
    expect(solvePutawayManifest(current, manifest).recommendations.every(item => item.targetSlotId !== external.id)).toBe(true);
  });

  it('requires original case-sensitive barcodes, receiver and accepted locations, with correction recovery', () => {
    const { shipment, manifest, facility, solution } = reviewed();
    shipment.results.warehouse = { ...resultForReceivingPlan(shipment, facility, manifest, solution, resources), inputRevision: 2, recordedAt: '2026-10-22T17:01:00.000Z', productId: 'product-06-warehouse-space-flow' };
    const receipt = { receiver: 'Receiver', units: solution.recommendations.map(rec => ({ id: rec.palletId, barcode: rec.barcode, slotCode: rec.targetLocationCode })) };
    receipt.units[0].barcode = '000abc';
    expect(() => validateManualReceipt(shipment, receipt)).toThrow(/barcode/);
    receipt.units[0].barcode = '000AbC';
    receipt.units[0].slotCode = 'WRONG';
    expect(() => validateManualReceipt(shipment, receipt)).toThrow(/Location/);
    receipt.units[0].slotCode = solution.recommendations[0].targetLocationCode;
    expect(() => validateManualReceipt(shipment, { ...receipt, receiver: ' ' })).toThrow(/receiver/);
    expect(() => validateManualReceipt(shipment, { ...receipt, units: receipt.units.slice(1) })).toThrow(/every original/);
    expect(() => validateManualReceipt(shipment, { ...receipt, units: [receipt.units[0], receipt.units[0]] })).toThrow(/every original/);
    expect(() => validateManualReceipt(shipment, receipt)).not.toThrow();
    expect(shipment.delivery).toBeUndefined();
  });
});

describe('Warehouse aggregate capacity and execution', () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects malformed declared mass %s', mass => {
    const { manifest, facility } = reviewed();
    manifest.items[0].weightLbs = mass;
    const recommendation = solvePutawayManifest(facility, manifest).recommendations[0];
    expect(recommendation.targetSlotId).toBeNull();
    expect(recommendation.status).toBe('conflict');
  });

  it.each(['occupied', 'reserved_inbound', 'blocked', 'quarantined'] as const)('charges unknown %s mass at its full declared position rating', status => {
    const facility = createCanonicalFacility();
    const slot = getAllSlots(facility).find(item => item.type === 'rack_bin')!;
    const peers = getAllSlots(facility).filter(item => item.zoneId === slot.zoneId && item.aisle === slot.aisle && item.bay === slot.bay);
    peers.forEach(item => { item.status = 'available'; });
    slot.status = status;
    const result = bayCapacityForSlot(slot, getAllSlots(facility))!;
    expect(result.usedWeightLbs).toBe(slot.maxWeightLbs);
    expect(result.unknownMassCount).toBe(1);
    slot.currentWeightLbs = 900; slot.reservedWeightLbs = 900;
    expect(bayCapacityForSlot(slot, getAllSlots(facility))!.usedWeightLbs).toBe(900);
  });

  it('gives constrained freight its scarce compatible position and keeps display order', () => {
    const { manifest, facility } = reviewed();
    const bulk = getAllSlots(facility).find(slot => slot.type === 'floor_bulk')!;
    const big = { ...bulk, id: 'big', code: 'BIG', dimensions: { lengthIn: 80, widthIn: 80, heightIn: 90 }, status: 'available' as const };
    const small = { ...bulk, id: 'small', code: 'SMALL', dimensions: { lengthIn: 48, widthIn: 40, heightIn: 60 }, status: 'available' as const };
    facility.zones = [{ ...facility.zones.find(zone => zone.id === bulk.zoneId)!, slots: [big, small] }];
    manifest.items[1].dimensions = { lengthIn: 60, widthIn: 60, heightIn: 60 };
    const solution = solvePutawayManifest(facility, manifest);
    expect(solution.recommendations.map(item => item.palletId)).toEqual(manifest.items.map(item => item.palletId));
    expect(solution.recommendations.map(item => item.targetSlotId)).toEqual(['small', 'big']);
    expect(solution.conflictCount).toBe(0);
  });

  it('rejects a stale putaway when another occupancy consumes the rack bay capacity', () => {
    const { manifest, facility } = reviewed();
    const allSlots = getAllSlots(facility);
    allSlots.forEach(slot => { slot.status = 'available'; });
    const recommendation = solvePutawayManifest(facility, manifest).recommendations[0];
    const target = findSlotById(facility, recommendation.targetSlotId!)!;
    const peer = allSlots.find(slot => slot.id !== target.id && slot.aisle === target.aisle && slot.bay === target.bay && slot.type === 'rack_bin')!;
    peer.status = 'occupied'; peer.currentWeightLbs = 5500;
    const before = structuredClone(target);
    const result = executeScanVerification(facility, recommendation, recommendation.targetLocationCode, 'Receiver');
    expect(result.success).toBe(false);
    expect(result.eventGenerated).toBeNull();
    expect(target).toEqual(before);
  });

  it('carries actual mass from own reserved position into successful putaway', () => {
    const { manifest, facility } = reviewed();
    const recommendation = solvePutawayManifest(facility, manifest).recommendations[0];
    const target = findSlotById(facility, recommendation.targetSlotId!)!;
    target.status = 'reserved_inbound'; target.reservedPalletId = recommendation.palletId; target.reservedWeightLbs = recommendation.weightLbs;
    const result = executeScanVerification(facility, recommendation, recommendation.targetLocationCode, 'Receiver');
    expect(result.success).toBe(true);
    expect(target.currentWeightLbs).toBe(recommendation.weightLbs);
    expect(target.reservedWeightLbs).toBeUndefined();
  });
});
