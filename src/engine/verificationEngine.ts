/**
 * Verification Engine & GS1 EPCIS 2.0 Event Generator
 * Closes the loop between planned reservations and physical barcode-verified putaway.
 */

import {
  DiscrepancyReport,
  EpcisEvent,
  Facility,
  LocationSlot,
  PutawayRecommendation,
} from './types';
import { findSlotById, getAllSlots } from './spatialModel';
import { bayCapacityForSlot, checkSlotSuitability } from './putawayEngine';

export interface VerificationResult {
  success: boolean;
  message: string;
  slotUpdated: LocationSlot | null;
  eventGenerated: EpcisEvent | null;
  discrepancyReport?: DiscrepancyReport;
}

/**
 * External EPCIS publisher port. Implementations push a locally-generated event
 * to a GS1 EPCIS 2.0 capture endpoint (or any compliant receiver). The default
 * is a no-op publisher that leaves the event in 'simulated' state, so local
 * verification never falsely claims publication.
 */
export interface EpcisPublisher {
  publish(event: EpcisEvent): Promise<{ published: boolean; receiptId?: string; error?: string }>;
}

export const noopEpcisPublisher: EpcisPublisher = {
  async publish() { return { published: false, error: 'no publisher configured' }; },
};

export async function publishEpcisEvent(
  event: EpcisEvent,
  publisher: EpcisPublisher = noopEpcisPublisher
): Promise<EpcisEvent> {
  const result = await publisher.publish(event);
  if (result.published) {
    return { ...event, verificationStatus: 'published' as EpcisEvent['verificationStatus'], verificationEvidence: { ...event.verificationEvidence, notes: `${event.verificationEvidence.notes} Published: ${result.receiptId ?? 'ok'}.` } };
  }
  return { ...event, verificationStatus: (event.verificationStatus === 'simulated' ? 'observed' : event.verificationStatus) as EpcisEvent['verificationStatus'] };
}

export function executeScanVerification(
  facility: Facility,
  recommendation: PutawayRecommendation,
  scannedSlotCode: string,
  operatorId: string = 'OPR-FORKLIFT-04'
): VerificationResult {
  const targetSlotId = recommendation.targetSlotId;
  if (!targetSlotId) {
    return {
      success: false,
      message: 'Cannot verify putaway for an item with no assigned target slot.',
      slotUpdated: null,
      eventGenerated: null,
    };
  }

  const assignedSlot = findSlotById(facility, targetSlotId);
  if (!assignedSlot) {
    return {
      success: false,
      message: `Assigned slot ${targetSlotId} not found in facility.`,
      slotUpdated: null,
      eventGenerated: null,
    };
  }

  const timestamp = new Date().toISOString();

  if (assignedSlot.status !== 'available' &&
      !(assignedSlot.status === 'reserved_inbound' && assignedSlot.reservedPalletId === recommendation.palletId)) {
    return {
      success: false,
      message: 'Location is unavailable or its reservation belongs to another pallet. Replan before putaway.',
      slotUpdated: null,
      eventGenerated: null,
    };
  }

  // Recheck physical capacity at execution. An earlier recommendation is not
  // permission to overwrite newly consumed bay capacity, including unknown mass.
  const suitability = checkSlotSuitability(recommendation, assignedSlot);
  const slotsWithoutOwnReservation = getAllSlots(facility).map(slot => slot.id === assignedSlot.id ? { ...slot, status: 'available' as const } : slot);
  const bay = bayCapacityForSlot(assignedSlot, slotsWithoutOwnReservation);
  if (!suitability.compatible || bay && bay.usedWeightLbs + recommendation.weightLbs > bay.maxWeightLbs) {
    return { success: false, message: suitability.violation ?? 'Shared rack bay capacity changed. Replan before putaway.', slotUpdated: null, eventGenerated: null };
  }

  // Check if operator scanned the correct slot
  if (scannedSlotCode.toUpperCase().trim() !== assignedSlot.code.toUpperCase().trim()) {
    const discrepancy: DiscrepancyReport = {
      id: `DISC-${Date.now()}`,
      palletId: recommendation.palletId,
      expectedLocationId: assignedSlot.code,
      actualLocationId: scannedSlotCode,
      discrepancyType: 'MISPLACED_LOCATION',
      reportedBy: operatorId,
      timestamp,
      resolved: false,
    };

    return {
      success: false,
      message: `️ Putaway Discrepancy: Scanned location '${scannedSlotCode}' does not match planned reservation '${assignedSlot.code}'. Operator notified to redirect.`,
      slotUpdated: null,
      eventGenerated: null,
      discrepancyReport: discrepancy,
    };
  }

  // Update slot occupancy state
  assignedSlot.status = 'occupied';
  assignedSlot.currentOccupantId = recommendation.palletId;
  assignedSlot.reservedPalletId = undefined;
  assignedSlot.currentWeightLbs = recommendation.weightLbs;
  assignedSlot.reservedWeightLbs = undefined;

  // Generate compliant GS1 EPCIS 2.0 ObjectEvent
  const epcisEvent: EpcisEvent = {
    eventId: `urn:uuid:${crypto.randomUUID ? crypto.randomUUID() : 'evt-' + Date.now()}`,
    eventType: 'ObjectEvent',
    eventTime: timestamp,
    action: 'OBSERVE',
    bizStep: 'urn:epcglobal:cbv:bizstep:putting_away',
    disposition: 'urn:epcglobal:cbv:disp:active',
    epcList: [`urn:epc:id:sscc:0614141.${recommendation.barcode}`],
    readPoint: `urn:epc:id:sgln:0614141.00001.${assignedSlot.code}`,
    bizLocation: `urn:epc:id:sgln:0614141.00001.${assignedSlot.id}`,
    verificationEvidence: {
      scanType: 'BARCODE_2D_DATAMATRIX',
      operatorId,
      verifiedTimestamp: timestamp,
      notes: `Putaway verified at bin ${assignedSlot.code}. Mass: ${recommendation.weightLbs} lbs.`,
    },
    verificationStatus: 'simulated',
  };

  return {
    success: true,
    message: ` Putaway Verified: Pallet ${recommendation.palletId} confirmed at bin ${assignedSlot.code}. GS1 EPCIS event generated locally (verification status: simulated; external publication requires connector).`,
    slotUpdated: assignedSlot,
    eventGenerated: epcisEvent,
  };
}
