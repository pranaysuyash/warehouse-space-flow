/**
 * Cross-Dock Matcher (P06) — Phase 3
 * Matches inbound pallets to outbound orders to bypass rack putaway.
 */

export interface OutboundOrder {
  orderId: string;
  sku: string;
  quantity: number;
  requiredBy: string; // ISO timestamp
  destination: string;
}

export interface CrossDockMatch {
  palletId: string;
  sku: string;
  outboundOrderId: string;
  destination: string;
  requiredBy: string;
  hoursUntilDeparture: number;
  action: 'cross_dock' | 'putaway';
  reason: string;
}

export function matchCrossDock(
  inboundItems: { palletId: string; sku: string; quantity: number }[],
  outboundOrders: OutboundOrder[],
  now: string = new Date().toISOString()
): CrossDockMatch[] {
  const nowMs = new Date(now).getTime();
  const results: CrossDockMatch[] = [];

  for (const item of inboundItems) {
    const matchingOrders = outboundOrders.filter(o => o.sku === item.sku && new Date(o.requiredBy).getTime() > nowMs);
    if (matchingOrders.length === 0) {
      results.push({ palletId: item.palletId, sku: item.sku, outboundOrderId: '', destination: '', requiredBy: '', hoursUntilDeparture: Infinity, action: 'putaway', reason: 'No matching outbound order.' });
      continue;
    }
    // Pick the earliest requiredBy
    const best = matchingOrders.sort((a, b) => new Date(a.requiredBy).getTime() - new Date(b.requiredBy).getTime())[0];
    const hoursUntil = (new Date(best.requiredBy).getTime() - nowMs) / (1000 * 60 * 60);
    if (hoursUntil < 4) {
      results.push({ palletId: item.palletId, sku: item.sku, outboundOrderId: best.orderId, destination: best.destination, requiredBy: best.requiredBy, hoursUntilDeparture: Math.round(hoursUntil * 10) / 10, action: 'cross_dock', reason: `Outbound departs in ${Math.round(hoursUntil * 10) / 10}h — bypass rack putaway.` });
    } else {
      results.push({ palletId: item.palletId, sku: item.sku, outboundOrderId: best.orderId, destination: best.destination, requiredBy: best.requiredBy, hoursUntilDeparture: Math.round(hoursUntil * 10) / 10, action: 'putaway', reason: `Outbound departs in ${Math.round(hoursUntil * 10) / 10}h — normal putaway.` });
    }
  }
  return results;
}
