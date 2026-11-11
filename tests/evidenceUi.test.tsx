import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CycleCountModal } from '../src/ui/CycleCountModal';
import { WarehouseIsometricCanvas } from '../src/ui/WarehouseIsometricCanvas';
import { CrossDockModal } from '../src/ui/CrossDockModal';
import { WavePickingModal } from '../src/ui/WavePickingModal';
import { GoodsLedgerModal } from '../src/ui/GoodsLedgerModal';
import { createCanonicalFacility, computeFacilityMetrics } from '../src/engine/spatialModel';

describe('warehouse evidence presentation', () => {
  it('starts the manual count with no actual observation and a disabled action', () => {
    const html = renderToStaticMarkup(<CycleCountModal isOpen onClose={() => {}} facility={createCanonicalFacility()} />);
    expect(html).toMatch(/aria-label="Actual pallet"[^>]*value=""/);
    expect(html).toMatch(/<button disabled=""[^>]*>Run Count/);
    expect(html).toContain('Slot is empty');
  });
  it('presents workspace slot ratings without claiming stored mass', () => {
    const facility = createCanonicalFacility();
    const html = renderToStaticMarkup(<WarehouseIsometricCanvas facility={facility} />);
    expect(html).toContain(computeFacilityMetrics(facility).totalWeightCapacityLbs.toLocaleString());
    expect(html).toContain('Sum of slot weight ratings');
    expect(html).not.toContain('Total Stored Mass');
    expect(html).toContain('Inspect warehouse location');
    expect(html).toContain(facility.zones[0].slots[0].code);
    expect(html).toContain('Heights are schematic');
    expect(html).not.toContain('5,000 lbs');
    expect(html).not.toContain('SKU-LOG-');
  });
  it('does not offer an unconnected cross-dock dispatch or claim sample picks were released', () => {
    const crossDock = renderToStaticMarkup(<CrossDockModal isOpen onClose={() => {}} />);
    expect(crossDock).toContain('No inbound pallets or outbound orders supplied');
    expect(crossDock).toMatch(/<button disabled=""[^>]*>Review matches/);
    expect(crossDock).not.toContain('Dispatch Cross-Dock Moves');
    const wave = renderToStaticMarkup(<WavePickingModal isOpen onClose={() => {}} />);
    expect(wave).toContain('Sample wave');
    expect(wave).not.toContain('Release Pick Wave');
  });
  it('does not prefill undeclared ledger identities or slot', () => {
    const html = renderToStaticMarkup(<GoodsLedgerModal isOpen onClose={() => {}} />);
    expect(html).not.toContain('CUST-001');
    expect(html).not.toContain('SLOT-A1');
    expect(html).toContain('aria-label="Slot id"');
  });
  it('shows the existing scenario receipt without claiming a persisted stock movement', () => {
    const html = renderToStaticMarkup(<GoodsLedgerModal isOpen onClose={() => {}} scenarioReceipt={{ receiver: 'Sam', receivedAt: '2026-11-06T00:00:00Z', units: [{ id: 'unit-1', barcode: '000123', slotCode: 'A-1' }] }} />);
    expect(html).toContain('unit-1');
    expect(html).toContain('000123');
    expect(html).toContain('A-1');
    expect(html).toContain('Manually entered scenario receipt');
    expect(html).toContain('does not create a stock ledger');
  });
});
