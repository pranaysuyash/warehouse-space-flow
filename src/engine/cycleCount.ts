/**
 * Cycle Count & Physical Inventory (P06) — Phase 3
 */

export interface CycleCountItem {
  slotId: string;
  expectedPalletId: string | null;
  actualPalletId: string | null;
  expectedWeightLbs: number | null;
  actualWeightLbs: number | null;
  status: 'match' | 'mismatch' | 'missing' | 'unexpected';
  countedAt: string;
  countedBy: string;
}

export function runCycleCount(
  slotOccupants: { slotId: string; occupantId: string | null; weightLbs: number | null }[],
  observed: { slotId: string; palletId: string | null; weightLbs: number | null }[],
  countedBy: string
): CycleCountItem[] {
  const observedMap = new Map(observed.map(o => [o.slotId, o]));
  const results: CycleCountItem[] = [];
  const now = new Date().toISOString();

  for (const slot of slotOccupants) {
    const obs = observedMap.get(slot.slotId);
    if (!obs) {
      results.push({ slotId: slot.slotId, expectedPalletId: slot.occupantId, actualPalletId: null, expectedWeightLbs: slot.weightLbs, actualWeightLbs: null, status: 'missing', countedAt: now, countedBy });
      continue;
    }
    if (obs.palletId === null && slot.occupantId !== null) {
      results.push({ slotId: slot.slotId, expectedPalletId: slot.occupantId, actualPalletId: null, expectedWeightLbs: slot.weightLbs, actualWeightLbs: obs.weightLbs, status: 'missing', countedAt: now, countedBy });
    } else if (obs.palletId !== null && slot.occupantId === null) {
      results.push({ slotId: slot.slotId, expectedPalletId: null, actualPalletId: obs.palletId, expectedWeightLbs: null, actualWeightLbs: obs.weightLbs, status: 'unexpected', countedAt: now, countedBy });
    } else if (obs.palletId !== slot.occupantId) {
      results.push({ slotId: slot.slotId, expectedPalletId: slot.occupantId, actualPalletId: obs.palletId, expectedWeightLbs: slot.weightLbs, actualWeightLbs: obs.weightLbs, status: 'mismatch', countedAt: now, countedBy });
    } else {
      results.push({ slotId: slot.slotId, expectedPalletId: slot.occupantId, actualPalletId: obs.palletId, expectedWeightLbs: slot.weightLbs, actualWeightLbs: obs.weightLbs, status: 'match', countedAt: now, countedBy });
    }
  }

  // Check for observed slots not in expected list
  for (const obs of observed) {
    if (!slotOccupants.some(s => s.slotId === obs.slotId)) {
      results.push({ slotId: obs.slotId, expectedPalletId: null, actualPalletId: obs.palletId, expectedWeightLbs: null, actualWeightLbs: obs.weightLbs, status: 'unexpected', countedAt: now, countedBy });
    }
  }

  return results;
}

export function cycleCountSummary(results: CycleCountItem[]): { total: number; match: number; mismatch: number; missing: number; unexpected: number; accuracyPercent: number } {
  const total = results.length;
  const match = results.filter(r => r.status === 'match').length;
  const mismatch = results.filter(r => r.status === 'mismatch').length;
  const missing = results.filter(r => r.status === 'missing').length;
  const unexpected = results.filter(r => r.status === 'unexpected').length;
  const accuracyPercent = total > 0 ? Math.round((match / total) * 100) : 0;
  return { total, match, mismatch, missing, unexpected, accuracyPercent };
}
