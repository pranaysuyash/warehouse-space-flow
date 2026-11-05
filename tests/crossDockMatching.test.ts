import { describe, it, expect } from 'vitest';
import {
  matchCrossDockPallets,
  SAMPLE_INBOUND_PALLETS,
  SAMPLE_OUTBOUND_ORDERS,
} from '../src/engine/crossDockMatching';

describe('Inbound-to-Outbound Cross-Dock Direct Allocation (T-036)', () => {
  it('identifies eligible cross-dock pallets within the 4-hour departure window', () => {
    const summary = matchCrossDockPallets(SAMPLE_INBOUND_PALLETS, SAMPLE_OUTBOUND_ORDERS, 4.0);

    // BEV-ORG-01 and DRY-BAR-04 both match departing orders within 4 hours
    expect(summary.crossDockEligibleCount).toBe(2);
    expect(summary.putawayRequiredCount).toBe(1); // FROZ-BER-09 has no matching outbound order -> putaway required
    expect(summary.crossDockRatioPct).toBeGreaterThan(60);
    expect(summary.totalLaborSavingsDollars).toBe(48.0); // 2 * $24 = $48
  });

  it('rejects cross-dock matching if the outbound order departs beyond the allowable dwell window', () => {
    // If departure window is tightened to 1 hour, neither order departs in time
    const summary = matchCrossDockPallets(SAMPLE_INBOUND_PALLETS, SAMPLE_OUTBOUND_ORDERS, 1.0);

    expect(summary.crossDockEligibleCount).toBe(0);
    expect(summary.putawayRequiredCount).toBe(3);
    expect(summary.totalLaborSavingsDollars).toBe(0);
  });

  it('correctly maps inbound door to outbound door transfer buffer lanes', () => {
    const summary = matchCrossDockPallets(SAMPLE_INBOUND_PALLETS, SAMPLE_OUTBOUND_ORDERS, 4.0);

    const match1 = summary.matches[0];
    expect(match1.inboundDoor).toBe('DOOR_02');
    expect(match1.outboundDoor).toBe('DOOR_16');
    expect(match1.transferBufferLane).toBe('LANE_02B');
    expect(match1.status).toBe('MATCHED_READY');
  });
});
