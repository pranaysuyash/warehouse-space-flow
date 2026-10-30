import { translateCargoFitLoadToInboundManifest } from './cargoFitBridge';
import { createCanonicalFacility, findSlotById, getAllSlots } from './spatialModel';
import { bayCapacityForSlot, checkSlotSuitability, solvePutawayManifest } from './putawayEngine';
import type { Facility, InboundManifest, PutawaySolveSummary } from './types';
import type { FlowResources, ReceiptInput, Shipment, ShipmentAdapter, StageResult } from '../suite/types';

export function inboundForShipment(shipment: Shipment): InboundManifest {
  const manifest = translateCargoFitLoadToInboundManifest({
    loadId: shipment.id, vehicleType: shipment.input.equipmentId, carrier: shipment.input.carrierDot, trailerNumber: shipment.input.trailerId,
    destinationFacilityId: 'LOCAL-RECEIVING-01', totalWeightLbs: shipment.input.units.reduce((sum, unit) => sum + unit.weightLbs, 0),
    packedItems: shipment.input.units.map(unit => ({ ...unit, itemId: unit.id })),
  });
  // A bridge demonstration's invented ETA, order number and door are not shared facts.
  return { ...manifest, deliveryOrderNumber: shipment.reference, eta: 'No scheduled arrival declared', dockAssigned: 'Receiving door not declared', stagingLaneAssigned: 'Staging lane not declared' };
}

function facilityGeometry(facility: Facility) {
  return JSON.stringify({ id: facility.id, code: facility.code, zones: facility.zones.map(zone => ({ id: zone.id, type: zone.type, slots: zone.slots.map(slot => ({ id: slot.id, code: slot.code, zoneId: slot.zoneId, type: slot.type, aisle: slot.aisle, bay: slot.bay, level: slot.level, dimensions: slot.dimensions, maxWeightLbs: slot.maxWeightLbs, bayMaxWeightLbs: slot.bayMaxWeightLbs, allowedClasses: slot.allowedClasses, groundOnlyAllowed: slot.groundOnlyAllowed })) })) });
}

export function assertConnectedFacility(facility: Facility) {
  if (facilityGeometry(facility) !== facilityGeometry(createCanonicalFacility())) throw new Error('Connected receiving uses the declared canonical local facility. Custom facility registration is not available; use independent planning for custom geometry.');
}

function overlayReservations(facility: Facility, shipment: Shipment, resources: FlowResources | null) {
  if (!resources) return;
  const previous = shipment.results.warehouse?.details.reservationSnapshot as FlowResources | undefined;
  const baseline = createCanonicalFacility();
  for (const slot of getAllSlots(facility)) {
    // A service reservation is temporary. It must not become permanent native
    // occupancy simply because it was retained in a reviewed facility snapshot.
    if (slot.status === 'blocked' && previous?.warehouseSlotIds.includes(slot.id)) {
      const original = findSlotById(baseline, slot.id);
      if (original) Object.assign(slot, { status: original.status, reservedPalletId: original.reservedPalletId, currentOccupantId: original.currentOccupantId, currentWeightLbs: original.currentWeightLbs, reservedWeightLbs: original.reservedWeightLbs });
    }
    if (resources.warehouseSlotIds.includes(slot.id)) Object.assign(slot, { status: 'blocked', reservedPalletId: undefined, currentOccupantId: undefined, currentWeightLbs: undefined, reservedWeightLbs: undefined });
  }
}

export function facilityForShipment(shipment: Shipment, resources: FlowResources | null): Facility {
  const saved = shipment.results.warehouse;
  const snapshot = saved?.details.facilitySnapshot as Facility | undefined;
  const facility = snapshot ? structuredClone(snapshot) : createCanonicalFacility();
  assertConnectedFacility(facility);
  overlayReservations(facility, shipment, resources);
  if (saved?.ok && saved.inputRevision === shipment.inputRevision) {
    const assignments = saved.details.assignments as { unitId: string; slotId: string }[];
    for (const assignment of assignments ?? []) {
      const slot = findSlotById(facility, assignment.slotId);
      if (!slot || resources?.warehouseSlotIds.includes(slot.id)) continue;
      const unit = shipment.input.units.find(item => item.id === assignment.unitId);
      slot.status = shipment.delivery ? 'occupied' : 'reserved_inbound';
      slot.reservedPalletId = shipment.delivery ? undefined : assignment.unitId;
      slot.currentOccupantId = shipment.delivery ? assignment.unitId : undefined;
      slot.reservedWeightLbs = shipment.delivery ? undefined : unit?.weightLbs;
      slot.currentWeightLbs = shipment.delivery ? unit?.weightLbs : undefined;
    }
  }
  return facility;
}

export function planningFacility(facility: Facility, shipment: Shipment, resources: FlowResources | null): Facility {
  const next = structuredClone(facility);
  overlayReservations(next, shipment, resources);
  const ownIds = new Set(shipment.input.units.map(unit => unit.id));
  for (const slot of getAllSlots(next)) {
    if (slot.status === 'reserved_inbound' && slot.reservedPalletId && ownIds.has(slot.reservedPalletId)) {
      slot.status = 'available'; slot.reservedPalletId = undefined; slot.reservedWeightLbs = undefined;
    }
  }
  return next;
}

export function resultForReceivingPlan(shipment: Shipment, facility: Facility, manifest: InboundManifest, reviewed: PutawaySolveSummary, resources: FlowResources | null): StageResult {
  if (!resources) throw new Error('Current shared receiving reservations are unavailable. Refresh before publishing.');
  if (!shipment.results.fit?.ok || shipment.results.fit.inputRevision !== shipment.inputRevision) throw new Error('Publish the current Cargo Fit result before reserving receiving space.');
  assertConnectedFacility(facility);
  const expected = inboundForShipment(shipment);
  if (JSON.stringify(manifest) !== JSON.stringify(expected)) throw new Error('The native manifest differs from the shared shipment. Reload current shipment inputs before publishing.');
  if (reviewed.recommendations.length !== manifest.items.length || new Set(reviewed.recommendations.map(item => item.palletId)).size !== manifest.items.length) throw new Error('Every original handling unit must have exactly one reviewed recommendation.');
  if (reviewed.totalExpected !== manifest.items.length || reviewed.proposedCount !== reviewed.recommendations.filter(item => item.status === 'proposed').length || reviewed.alternativeCount !== reviewed.recommendations.filter(item => item.status === 'alternative').length || reviewed.conflictCount !== reviewed.recommendations.filter(item => item.status === 'conflict').length) throw new Error('The reviewed solution totals do not reconcile with its handling-unit recommendations. Re-solve before publishing.');
  const validationFacility = planningFacility(facility, shipment, resources);
  const slots = getAllSlots(validationFacility);
  const assigned = new Set<string>();
  const plannedWeights = new Map<string, number>();
  for (const recommendation of reviewed.recommendations) {
    const item = manifest.items.find(candidate => candidate.palletId === recommendation.palletId);
    if (!item || recommendation.barcode !== item.barcode || recommendation.weightLbs !== item.weightLbs || JSON.stringify(recommendation.dimensions) !== JSON.stringify(item.dimensions) || recommendation.environmentalClass !== item.environmentalClass || recommendation.packageType !== item.packageType || recommendation.groundOnly !== item.groundOnly) throw new Error('Reviewed handling-unit identity or physical constraints differ from the manifest.');
    if (!recommendation.targetSlotId) {
      if (recommendation.status !== 'conflict') throw new Error('Every unassigned handling unit must retain its constraint conflict.');
      continue;
    }
    if (recommendation.status === 'conflict') throw new Error('A conflicting handling unit cannot reserve a receiving location.');
    const slot = findSlotById(validationFacility, recommendation.targetSlotId);
    if (!slot || slot.status !== 'available' || assigned.has(slot.id) || slot.code !== recommendation.targetLocationCode || !checkSlotSuitability(item, slot).compatible) throw new Error(`Receiving location for ${item.palletId} is unavailable or violates its declared constraints. Re-solve before publishing.`);
    const bay = bayCapacityForSlot(slot, slots, plannedWeights);
    if (bay && bay.usedWeightLbs + item.weightLbs > bay.maxWeightLbs) throw new Error(`Receiving plan exceeds shared rack bay ${bay.key} capacity.`);
    assigned.add(slot.id); plannedWeights.set(slot.id, item.weightLbs);
  }
  const assignments = reviewed.recommendations.filter(item => item.targetSlotId).map(item => ({ unitId: item.palletId, barcode: item.barcode, slotId: item.targetSlotId!, slotCode: item.targetLocationCode }));
  const unknownMassSlots = slots.filter(slot => {
    const mass = slot.status === 'reserved_inbound' ? slot.reservedWeightLbs : slot.currentWeightLbs;
    return slot.type === 'rack_bin' && slot.status !== 'available' && !(typeof mass === 'number' && Number.isFinite(mass) && mass >= 0);
  }).map(slot => slot.id);
  const ok = assignments.length === manifest.items.length;
  return { ok, summary: `${assignments.length}/${manifest.items.length} identified units have reviewed compatible receiving locations.`, details: { facilityId: 'LOCAL-RECEIVING-01', facilitySnapshot: structuredClone(validationFacility), nativeManifest: structuredClone(manifest), nativeResult: structuredClone(reviewed), recommendations: structuredClone(reviewed.recommendations), assignments, computedAt: reviewed.computedAt, fitRecordedAt: shipment.results.fit.recordedAt, reviewedRecordRevision: shipment.revision, reservationSnapshot: structuredClone(resources), capacityBasis: 'Declared canonical local facility plus current shared reservations. Unknown committed rack mass consumes the full position rating.', unknownMassSlots, source: 'reviewed_native_local_scenario' } };
}

export function validateManualReceipt(shipment: Shipment, receipt: ReceiptInput): void {
  const saved = shipment.results.warehouse;
  if (!saved?.ok || saved.inputRevision !== shipment.inputRevision || !receipt.receiver.trim() || receipt.receiver.length > 100) throw new Error('A receiver and current accepted receiving plan are required.');
  const assignments = saved.details.assignments as { unitId: string; barcode: string; slotId: string; slotCode: string }[] | undefined;
  if (!Array.isArray(assignments)) throw new Error('The accepted receiving assignments are unavailable. Inspect the receiving plan.');
  const expectedIds = new Set(shipment.input.units.map(unit => unit.id));
  if (receipt.units.length !== expectedIds.size || new Set(receipt.units.map(unit => unit.id)).size !== expectedIds.size) throw new Error('Enter every original handling unit exactly once.');
  const snapshot = saved.details.facilitySnapshot as Facility | undefined;
  const facility = snapshot ? structuredClone(snapshot) : createCanonicalFacility();
  assertConnectedFacility(facility);
  for (const unit of receipt.units) {
    const assignment = assignments.find(item => item.unitId === unit.id);
    const original = shipment.input.units.find(item => item.id === unit.id);
    const slot = assignment ? findSlotById(facility, assignment.slotId) : null;
    if (!expectedIds.has(unit.id) || !assignment || unit.barcode !== assignment.barcode || unit.barcode !== original?.barcode) throw new Error('Handling-unit barcode does not match the accepted shipment. Preserve leading zeros and case.');
    if (!slot || slot.code !== assignment.slotCode || unit.slotCode.trim().toUpperCase() !== assignment.slotCode.toUpperCase()) throw new Error(`Location for ${unit.id} differs from the accepted receiving assignment.`);
    if (slot.status !== 'available' && !(slot.status === 'reserved_inbound' && slot.reservedPalletId === unit.id)) throw new Error('The accepted receiving location is no longer available.');
  }
}

export const shipmentAdapter: ShipmentAdapter = {
  stage: 'warehouse',
  evaluate(shipment, resources) {
    const manifest = inboundForShipment(shipment);
    const facility = planningFacility(facilityForShipment(shipment, resources), shipment, resources);
    return resultForReceivingPlan(shipment, facility, manifest, solvePutawayManifest(facility, manifest), resources);
  },
  verifyReceipt: validateManualReceipt,
};
