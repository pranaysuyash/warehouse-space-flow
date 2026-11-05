import { describe, it, expect } from 'vitest';
import { createCanonicalFacility } from '../src/engine/spatialModel';
import { createCanonical40PalletManifest } from '../src/engine/inboundManifest';
import { solvePutawayManifest } from '../src/engine/putawayEngine';
import { executeScanVerification, publishEpcisEvent, noopEpcisPublisher } from '../src/engine/verificationEngine';

describe('P06 Scan Verification & GS1 EPCIS 2.0 Audits', () => {
  it('confirms putaway and generates compliant EPCIS ObjectEvent when barcode matches assigned bin', () => {
    const facility = createCanonicalFacility();
    const manifest = createCanonical40PalletManifest();
    const solution = solvePutawayManifest(facility, manifest);

    const firstProposed = solution.recommendations.find((r) => r.status === 'proposed');
    expect(firstProposed).toBeDefined();

    const result = executeScanVerification(
      facility,
      firstProposed!,
      firstProposed!.targetLocationCode,
      'OPR-JONES-44'
    );

    expect(result.success).toBe(true);
    expect(result.slotUpdated).toBeDefined();
    expect(result.slotUpdated!.status).toBe('occupied');
    expect(result.slotUpdated!.currentOccupantId).toBe(firstProposed!.palletId);

    // Verify GS1 EPCIS 2.0 event payload
    expect(result.eventGenerated).toBeDefined();
    const event = result.eventGenerated!;
    expect(event.eventType).toBe('ObjectEvent');
    expect(event.action).toBe('OBSERVE');
    expect(event.bizStep).toBe('urn:epcglobal:cbv:bizstep:putting_away');
    expect(event.disposition).toBe('urn:epcglobal:cbv:disp:active');
    expect(event.epcList[0]).toContain(firstProposed!.barcode);
    expect(event.verificationEvidence.operatorId).toBe('OPR-JONES-44');
    expect(event.verificationEvidence.scanType).toBe('BARCODE_2D_DATAMATRIX');
    expect(event.verificationStatus).toBe('simulated');
  });

  it('detects misplaced location discrepancy when scanned code does not match reservation', () => {
    const facility = createCanonicalFacility();
    const manifest = createCanonical40PalletManifest();
    const solution = solvePutawayManifest(facility, manifest);

    const firstProposed = solution.recommendations.find((r) => r.status === 'proposed');
    expect(firstProposed).toBeDefined();

    // Operator scans wrong bin
    const result = executeScanVerification(
      facility,
      firstProposed!,
      'WRONG-BIN-999',
      'OPR-JONES-44'
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Discrepancy');
    expect(result.discrepancyReport).toBeDefined();
    expect(result.discrepancyReport!.expectedLocationId).toBe(firstProposed!.targetLocationCode);
    expect(result.discrepancyReport!.actualLocationId).toBe('WRONG-BIN-999');
    expect(result.discrepancyReport!.discrepancyType).toBe('MISPLACED_LOCATION');
  });
});

describe('P06 EPCIS publisher port', () => {
  const baseEvent = {
    eventId: 'urn:uuid:test-evt',
    eventType: 'ObjectEvent' as const,
    eventTime: new Date().toISOString(),
    action: 'OBSERVE' as const,
    bizStep: 'putting_away',
    disposition: 'active',
    epcList: ['urn:epc:id:sscc:0614141.123'],
    readPoint: 'urn:epc:id:sgln:0614141.00001.A1',
    bizLocation: 'urn:epc:id:sgln:0614141.00001.SLOT-A1',
    verificationEvidence: { scanType: 'BARCODE_2D_DATAMATRIX' as const, operatorId: 'OPR-1', verifiedTimestamp: new Date().toISOString(), notes: 'verified' },
    verificationStatus: 'simulated' as const,
  };

  it('no-op publisher leaves event simulated/observed (never falsely published)', async () => {
    const out = await publishEpcisEvent(baseEvent, noopEpcisPublisher);
    expect(out.verificationStatus).not.toBe('published');
  });

  it('successful publisher transitions to published', async () => {
    const pub = { async publish() { return { published: true, receiptId: 'RCPT-1' }; } };
    const out = await publishEpcisEvent(baseEvent, pub);
    expect(out.verificationStatus).toBe('published');
    expect(out.verificationEvidence.notes).toContain('Published: RCPT-1');
  });
});
