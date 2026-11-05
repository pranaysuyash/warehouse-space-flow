/**
 * Inbound-to-Outbound Cross-Dock Direct Allocation Engine.
 * 
 * Matches incoming receipts with active outbound departure schedules
 * within a 4-hour departure window, bypassing rack putaway to eliminate
 * handling labor and reduce terminal dwell time.
 */

export interface InboundReceiptPallet {
  palletId: string;
  sku: string;
  description: string;
  quantityUnits: number;
  weightLbs: number;
  ssccBarcode: string;
  inboundDoorId: string; // e.g. "DOOR_02"
  arrivalEpoch: number;
  temperatureZone: 'AMBIENT' | 'CHILLED' | 'FROZEN';
}

export interface OutboundDepartureOrder {
  orderId: string;
  destinationHub: string;
  outboundDoorId: string; // e.g. "DOOR_16"
  departureEpoch: number;
  neededSku: string;
  neededQuantityUnits: number;
  carrierName: string;
  trailerAssigned: string;
}

export interface CrossDockMatchRecord {
  matchId: string;
  inboundPalletId: string;
  outboundOrderId: string;
  sku: string;
  matchedQuantityUnits: number;
  inboundDoor: string;
  outboundDoor: string;
  transferBufferLane: string;
  transitDwellMinutes: number;
  laborSavingsDollars: number; // $24.00 per pallet avoided putaway/retrieval
  status: 'MATCHED_READY' | 'IN_TRANSIT_STAGING' | 'STAGED_AT_DOOR';
}

export interface CrossDockOptimizationSummary {
  totalInboundPallets: number;
  crossDockEligibleCount: number;
  putawayRequiredCount: number;
  crossDockRatioPct: number;
  totalLaborSavingsDollars: number;
  averageDwellMinutes: number;
  matches: CrossDockMatchRecord[];
}

export const SAMPLE_INBOUND_PALLETS: InboundReceiptPallet[] = [
  {
    palletId: 'PAL-9001',
    sku: 'BEV-ORG-01',
    description: 'Organic Cold-Pressed Juice (48 Cases)',
    quantityUnits: 48,
    weightLbs: 1850,
    ssccBarcode: '001084920000009001',
    inboundDoorId: 'DOOR_02',
    arrivalEpoch: Date.now(),
    temperatureZone: 'CHILLED',
  },
  {
    palletId: 'PAL-9002',
    sku: 'DRY-BAR-04',
    description: 'Protein Energy Bars (72 Cartons)',
    quantityUnits: 72,
    weightLbs: 1240,
    ssccBarcode: '001084920000009002',
    inboundDoorId: 'DOOR_02',
    arrivalEpoch: Date.now(),
    temperatureZone: 'AMBIENT',
  },
  {
    palletId: 'PAL-9003',
    sku: 'FROZ-BER-09',
    description: 'Frozen Organic Blueberries (36 Cases)',
    quantityUnits: 36,
    weightLbs: 1420,
    ssccBarcode: '001084920000009003',
    inboundDoorId: 'DOOR_04',
    arrivalEpoch: Date.now(),
    temperatureZone: 'FROZEN',
  },
];

export const SAMPLE_OUTBOUND_ORDERS: OutboundDepartureOrder[] = [
  {
    orderId: 'OUT-7701',
    destinationHub: 'Des Moines Regional Depot',
    outboundDoorId: 'DOOR_16',
    departureEpoch: Date.now() + 2.5 * 3600 * 1000, // Departs in 2.5 hours
    neededSku: 'BEV-ORG-01',
    neededQuantityUnits: 48,
    carrierName: 'Midwest Intermountain Freight',
    trailerAssigned: 'TR-53819',
  },
  {
    orderId: 'OUT-7702',
    destinationHub: 'Omaha Supercenter',
    outboundDoorId: 'DOOR_18',
    departureEpoch: Date.now() + 3.2 * 3600 * 1000, // Departs in 3.2 hours
    neededSku: 'DRY-BAR-04',
    neededQuantityUnits: 72,
    carrierName: 'Prairie Express Logistics',
    trailerAssigned: 'TR-44091',
  },
];

/**
 * Optimizes inbound-to-outbound direct cross-dock matches.
 * Standard cross-docking window is departures within maxDepartureHours (default: 4 hours).
 */
export function matchCrossDockPallets(
  inboundPallets: InboundReceiptPallet[] = SAMPLE_INBOUND_PALLETS,
  outboundOrders: OutboundDepartureOrder[] = SAMPLE_OUTBOUND_ORDERS,
  maxDepartureHours: number = 4.0
): CrossDockOptimizationSummary {
  const matches: CrossDockMatchRecord[] = [];
  const matchedPalletIds = new Set<string>();
  const maxDepartureMs = maxDepartureHours * 3600 * 1000;
  const LABOR_SAVINGS_PER_PALLET = 24.0; // $12 putaway + $12 retrieval labor savings

  for (const pallet of inboundPallets) {
    // Find candidate outbound orders needing this SKU that depart within the window
    const candidateOrder = outboundOrders.find(
      (ord) =>
        ord.neededSku === pallet.sku &&
        ord.departureEpoch > pallet.arrivalEpoch &&
        ord.departureEpoch - pallet.arrivalEpoch <= maxDepartureMs &&
        !matches.some((m) => m.outboundOrderId === ord.orderId)
    );

    if (candidateOrder) {
      const dwellMs = candidateOrder.departureEpoch - pallet.arrivalEpoch;
      const dwellMinutes = Math.round(dwellMs / 60000);

      matches.push({
        matchId: `XD-${pallet.palletId}-${candidateOrder.orderId}`,
        inboundPalletId: pallet.palletId,
        outboundOrderId: candidateOrder.orderId,
        sku: pallet.sku,
        matchedQuantityUnits: Math.min(pallet.quantityUnits, candidateOrder.neededQuantityUnits),
        inboundDoor: pallet.inboundDoorId,
        outboundDoor: candidateOrder.outboundDoorId,
        transferBufferLane: `LANE_${pallet.inboundDoorId.slice(-2)}B`,
        transitDwellMinutes: dwellMinutes,
        laborSavingsDollars: LABOR_SAVINGS_PER_PALLET,
        status: 'MATCHED_READY',
      });

      matchedPalletIds.add(pallet.palletId);
    }
  }

  const crossDockEligibleCount = matches.length;
  const putawayRequiredCount = inboundPallets.length - crossDockEligibleCount;
  const ratio = inboundPallets.length > 0 ? (crossDockEligibleCount / inboundPallets.length) * 100 : 0;
  const totalLaborSavings = crossDockEligibleCount * LABOR_SAVINGS_PER_PALLET;
  const avgDwell =
    matches.length > 0
      ? Math.round(matches.reduce((s, m) => s + m.transitDwellMinutes, 0) / matches.length)
      : 0;

  return {
    totalInboundPallets: inboundPallets.length,
    crossDockEligibleCount,
    putawayRequiredCount,
    crossDockRatioPct: Math.round(ratio * 10) / 10,
    totalLaborSavingsDollars: totalLaborSavings,
    averageDwellMinutes: avgDwell,
    matches,
  };
}
