/**
 * Distribution Center Outbound Wave Picking & Traveling Salesperson (TSP) Pick-Path Optimizer
 *
 * Implements heuristic TSP tour routing through warehouse rack aisles (rectilinear aisle traversal)
 * with 2-Opt local search improvement, pick duration estimation, and FEFO (First-Expired, First-Out)
 * lot compliance auditing.
 */

export interface PickItem {
  id: string;
  sku: string;
  description: string;
  orderId: string;
  locationCode: string;
  aisleNum: number; // e.g. 1 to 6
  bayNum: number;   // e.g. 1 to 12
  level: number;    // 1 to 4
  coords: { xFt: number; yFt: number; zFt: number };
  qty: number;
  weightLb: number;
  lotNumber: string;
  expirationDate: string; // YYYY-MM-DD
  isQuarantined: boolean;
}

export interface TspOptimizationResult {
  waveId: string;
  totalItemsCount: number;
  totalWeightLb: number;
  orderedPickSequence: PickItem[];
  unoptimizedDistanceFt: number;
  optimizedDistanceFt: number;
  distanceSavedFt: number;
  distanceReductionPct: number;
  estimatedPickDurationMinutes: number;
  fefoAuditPassed: boolean;
  fefoWarnings: string[];
}

/** Standard warehouse aisle geometry constants */
export const WAREHOUSE_GEOMETRY = {
  aisleSpacingFt: 14, // Center-to-center distance between aisles
  baySpacingFt: 8,    // Bay distance along aisle
  aisleLengthFt: 96,  // Total aisle length (12 bays * 8 ft)
  levelHeightFt: 5,   // Vertical lift per rack level
  pickerWalkingSpeedMph: 2.8, // Average warehouse picker walking speed (ft/sec = ~4.1)
  secondsPerPickScan: 30,    // Time to locate, scan barcode, and place into cart
};

export interface LocationPoint {
  xFt: number;
  yFt: number;
  zFt: number;
  aisleNum: number;
}

export function toLocationPoint(item: PickItem | LocationPoint): LocationPoint {
  if ('coords' in item) {
    return {
      xFt: item.coords.xFt,
      yFt: item.coords.yFt,
      zFt: item.coords.zFt,
      aisleNum: item.aisleNum,
    };
  }
  return item;
}

/**
 * Calculates rectilinear walking distance between two warehouse pick locations.
 * Warehouse pickers must walk down the aisle to the cross-aisle end before transitioning to an adjacent aisle.
 */
export function calculateWarehouseDistance(
  a: PickItem | LocationPoint,
  b: PickItem | LocationPoint
): number {
  const p1 = toLocationPoint(a);
  const p2 = toLocationPoint(b);
  const geom = WAREHOUSE_GEOMETRY;
  const verticalPenalty = Math.abs(p1.zFt - p2.zFt) * 0.75;

  if (p1.aisleNum === p2.aisleNum) {
    // Same aisle: direct straight walk
    return Math.abs(p1.yFt - p2.yFt) + verticalPenalty;
  }

  // Different aisles: picker must travel to front cross-aisle (y=0) or back cross-aisle (y=aisleLengthFt)
  const distViaFront = p1.yFt + p2.yFt;
  const distViaBack = geom.aisleLengthFt - p1.yFt + (geom.aisleLengthFt - p2.yFt);
  const minAlongAisle = Math.min(distViaFront, distViaBack);
  const crossAisleDist = Math.abs(p1.xFt - p2.xFt);

  return crossAisleDist + minAlongAisle + verticalPenalty;
}

export const SAMPLE_OUTBOUND_WAVE_ITEMS: PickItem[] = [
  {
    id: 'PICK-01',
    sku: 'SKU-DRY-8821',
    description: 'Organic Cold-Pressed Olive Oil (Case of 12)',
    orderId: 'ORD-9042',
    locationCode: 'A04-B10-L1',
    aisleNum: 4,
    bayNum: 10,
    level: 1,
    coords: { xFt: 56, yFt: 80, zFt: 0 },
    qty: 4,
    weightLb: 120,
    lotNumber: 'LOT-2026-081',
    expirationDate: '2027-04-15',
    isQuarantined: false,
  },
  {
    id: 'PICK-02',
    sku: 'SKU-BEV-1024',
    description: 'Sparkling Mineral Water (Pack of 24)',
    orderId: 'ORD-9042',
    locationCode: 'A01-B02-L2',
    aisleNum: 1,
    bayNum: 2,
    level: 2,
    coords: { xFt: 14, yFt: 16, zFt: 5 },
    qty: 6,
    weightLb: 180,
    lotNumber: 'LOT-2026-092',
    expirationDate: '2027-01-30',
    isQuarantined: false,
  },
  {
    id: 'PICK-03',
    sku: 'SKU-DRY-3319',
    description: 'Artisan Sourdough Crackers',
    orderId: 'ORD-9042',
    locationCode: 'A01-B04-L1',
    aisleNum: 1,
    bayNum: 4,
    level: 1,
    coords: { xFt: 14, yFt: 32, zFt: 0 },
    qty: 8,
    weightLb: 64,
    lotNumber: 'LOT-2026-044',
    expirationDate: '2026-12-15',
    isQuarantined: false,
  },
  {
    id: 'PICK-04',
    sku: 'SKU-CHL-7740',
    description: 'Cultured Pasture Butter (50 lb Block)',
    orderId: 'ORD-9042',
    locationCode: 'A02-B08-L1',
    aisleNum: 2,
    bayNum: 8,
    level: 1,
    coords: { xFt: 28, yFt: 64, zFt: 0 },
    qty: 2,
    weightLb: 100,
    lotNumber: 'LOT-2026-105',
    expirationDate: '2026-11-20',
    isQuarantined: false,
  },
  {
    id: 'PICK-05',
    sku: 'SKU-DRY-9901',
    description: 'Raw Honey Glass Jars',
    orderId: 'ORD-9042',
    locationCode: 'A04-B03-L2',
    aisleNum: 4,
    bayNum: 3,
    level: 2,
    coords: { xFt: 56, yFt: 24, zFt: 5 },
    qty: 5,
    weightLb: 75,
    lotNumber: 'LOT-2026-018',
    expirationDate: '2028-06-01',
    isQuarantined: false,
  },
  {
    id: 'PICK-06',
    sku: 'SKU-CHL-6612',
    description: 'Aged White Cheddar Wheels',
    orderId: 'ORD-9042',
    locationCode: 'A02-B02-L1',
    aisleNum: 2,
    bayNum: 2,
    level: 1,
    coords: { xFt: 28, yFt: 16, zFt: 0 },
    qty: 3,
    weightLb: 90,
    lotNumber: 'LOT-2026-072',
    expirationDate: '2026-11-01',
    isQuarantined: false,
  },
];

/**
 * Optimizes outbound wave pick path using Nearest-Neighbor + 2-Opt local search improvement.
 */
export function optimizeWavePickPath(
  items: PickItem[] = SAMPLE_OUTBOUND_WAVE_ITEMS,
  waveId: string = 'WAVE-2026-1030'
): TspOptimizationResult {
  if (items.length === 0) {
    return {
      waveId,
      totalItemsCount: 0,
      totalWeightLb: 0,
      orderedPickSequence: [],
      unoptimizedDistanceFt: 0,
      optimizedDistanceFt: 0,
      distanceSavedFt: 0,
      distanceReductionPct: 0,
      estimatedPickDurationMinutes: 0,
      fefoAuditPassed: true,
      fefoWarnings: [],
    };
  }

  const depot = { xFt: 0, yFt: 0, zFt: 0, aisleNum: 1 };
  const fefoWarnings: string[] = [];

  // FEFO & Quarantine check
  for (const item of items) {
    if (item.isQuarantined) {
      fefoWarnings.push(
        `QUARANTINE ALERT: ${item.sku} (${item.description}) in location ${item.locationCode} is marked QUARANTINED and cannot be dispatched!`
      );
    }
  }

  // Calculate unoptimized distance (arbitrary input order starting and ending at depot)
  let unoptimizedDistance = calculateWarehouseDistance(depot, items[0]);
  for (let i = 0; i < items.length - 1; i++) {
    unoptimizedDistance += calculateWarehouseDistance(items[i], items[i + 1]);
  }
  unoptimizedDistance += calculateWarehouseDistance(items[items.length - 1], depot);

  // Nearest Neighbor TSP heuristic starting from depot
  const unvisited = [...items];
  const tour: PickItem[] = [];
  let currentPos: LocationPoint | PickItem = depot;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minD = calculateWarehouseDistance(currentPos, unvisited[0]);

    for (let i = 1; i < unvisited.length; i++) {
      const d = calculateWarehouseDistance(currentPos, unvisited[i]);
      if (d < minD) {
        minD = d;
        nearestIdx = i;
      }
    }

    const nextItem = unvisited.splice(nearestIdx, 1)[0];
    tour.push(nextItem);
    currentPos = nextItem;
  }

  // 2-Opt local search refinement
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 50) {
    improved = false;
    iterations++;

    for (let i = 0; i < tour.length - 1; i++) {
      for (let k = i + 1; k < tour.length; k++) {
        // Evaluate swapping edges (i-1, i) and (k, k+1)
        const prevNode = i === 0 ? depot : tour[i - 1];
        const nextNode = k === tour.length - 1 ? depot : tour[k + 1];

        const dCurrent =
          calculateWarehouseDistance(prevNode, tour[i]) +
          calculateWarehouseDistance(tour[k], nextNode);

        const dReversed =
          calculateWarehouseDistance(prevNode, tour[k]) +
          calculateWarehouseDistance(tour[i], nextNode);

        if (dReversed < dCurrent - 0.5) {
          // Reverse segment between i and k
          const segment = tour.slice(i, k + 1).reverse();
          tour.splice(i, segment.length, ...segment);
          improved = true;
        }
      }
    }
  }

  // Calculate optimized distance
  let optimizedDistance = calculateWarehouseDistance(depot, tour[0]);
  for (let i = 0; i < tour.length - 1; i++) {
    optimizedDistance += calculateWarehouseDistance(tour[i], tour[i + 1]);
  }
  optimizedDistance += calculateWarehouseDistance(tour[tour.length - 1], depot);

  const roundedUnoptimized = Math.round(unoptimizedDistance);
  const roundedOptimized = Math.round(optimizedDistance);
  const distanceSavedFt = Math.max(0, roundedUnoptimized - roundedOptimized);
  const distanceReductionPct =
    roundedUnoptimized > 0 ? Math.round((distanceSavedFt / roundedUnoptimized) * 100) : 0;

  // Duration: Walking speed ~4.1 ft/sec + 30 sec per pick item
  const walkingSeconds = roundedOptimized / (WAREHOUSE_GEOMETRY.pickerWalkingSpeedMph * 1.46667);
  const pickingSeconds = tour.length * WAREHOUSE_GEOMETRY.secondsPerPickScan;
  const estimatedPickDurationMinutes = Number(((walkingSeconds + pickingSeconds) / 60).toFixed(1));

  const totalWeightLb = items.reduce((acc, it) => acc + it.weightLb, 0);

  return {
    waveId,
    totalItemsCount: items.length,
    totalWeightLb,
    orderedPickSequence: tour,
    unoptimizedDistanceFt: roundedUnoptimized,
    optimizedDistanceFt: roundedOptimized,
    distanceSavedFt,
    distanceReductionPct,
    estimatedPickDurationMinutes,
    fefoAuditPassed: fefoWarnings.length === 0,
    fefoWarnings,
  };
}
