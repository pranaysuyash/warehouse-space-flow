import { describe, it, expect } from 'vitest';
import { createCanonicalFacility } from '../src/engine/spatialModel';
import { createCanonical40PalletManifest } from '../src/engine/inboundManifest';
import { solvePutawayManifest } from '../src/engine/putawayEngine';
import { executeScanVerification } from '../src/engine/verificationEngine';

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
