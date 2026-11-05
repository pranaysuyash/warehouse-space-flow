/**
 * Canonical Spatial Model: Midwest Logistics Distribution Center & Yard (DC-04)
 * Provides layout geometry, rack/bin hierarchy, and dual-role moveable entities.
 */

import { Facility, LocationSlot, MoveableEntity, Zone } from './types';

/**
 * Generic facility factory for user-created facilities.
 * Allows construction of facilities with custom zones/spaces instead of the
 * hardcoded canonical DC-04 layout.
 */
export function createCustomFacility(input: {
  id: string;
  code: string;
  name: string;
  address: string;
  totalSquareFeet: number;
  clearHeightFt: number;
  zones: Zone[];
}): Facility {
  if (input.totalSquareFeet <= 0) throw new Error('Total square footage must be positive.');
  if (input.clearHeightFt <= 0) throw new Error('Clear height must be positive.');
  if (!input.zones || input.zones.length === 0) throw new Error('Facility must have at least one zone.');
  return {
    id: input.id,
    code: input.code,
    name: input.name,
    address: input.address,
    totalSquareFeet: input.totalSquareFeet,
    clearHeightFt: input.clearHeightFt,
    zones: input.zones,
  };
}

export function createCanonicalFacility(): Facility {
  // 1. Receiving Dock Doors (4 Doors)
  const dockSlots: LocationSlot[] = [1, 2, 3, 4].map((num) => ({
    id: `DOCK-0${num}`,
    code: `D-0${num}`,
    zoneId: 'ZONE-DOCK',
    type: 'dock_door',
    canvasCoords: { x: 30 + (num - 1) * 90, y: 30, width: 75, height: 50 },
    dimensions: { lengthIn: 636, widthIn: 102, heightIn: 162 }, // 53ft trailer aperture
    maxWeightLbs: 80000,
    allowedClasses: ['ambient', 'chilled', 'frozen', 'hazmat'],
    groundOnlyAllowed: true,
    status: num === 2 ? 'occupied' : 'available',
    currentOccupantId: num === 2 ? 'TRUCK-INBOUND-884' : undefined,
  }));

  const dockZone: Zone = {
    id: 'ZONE-DOCK',
    code: 'ZD-REC',
    name: 'Receiving Dock Bays',
    type: 'receiving_dock',
    canvasBounds: { x: 20, y: 15, width: 380, height: 80 },
    color: '#0284c7', // Sky blue
    slots: dockSlots,
  };

  // 2. Inbound Staging Lanes (STG-A, STG-B, STG-C)
  const stagingSlots: LocationSlot[] = ['A', 'B', 'C'].map((lane, idx) => ({
    id: `STG-${lane}`,
    code: `STAGING-${lane}`,
    zoneId: 'ZONE-STAGING',
    type: 'staging_lane',
    canvasCoords: { x: 420 + idx * 110, y: 30, width: 95, height: 50 },
    dimensions: { lengthIn: 360, widthIn: 120, heightIn: 96 },
    maxWeightLbs: 45000,
    allowedClasses: ['ambient', 'chilled', 'frozen', 'hazmat'],
    groundOnlyAllowed: true,
    status: lane === 'A' ? 'occupied' : 'available',
    currentOccupantId: lane === 'A' ? 'STAGE-BATCH-01' : undefined,
  }));

  const stagingZone: Zone = {
    id: 'ZONE-STAGING',
    code: 'ZS-INB',
    name: 'Inbound Ingest Staging',
    type: 'inbound_staging',
    canvasBounds: { x: 410, y: 15, width: 340, height: 80 },
    color: '#eab308', // Amber
    slots: stagingSlots,
  };

  // 3. High-Bay Selective Pallet Racks (Aisles R1, R2, R3)
  // Each Aisle has 4 Bays, 3 Levels (L1, L2, L3), 2 Positions (A, B) = 24 slots per aisle = 72 total
  const rackSlots: LocationSlot[] = [];
  const aisles = [
    { code: 'R01', label: 'Aisle 01 (Ambient Fast-Move)', startY: 130 },
    { code: 'R02', label: 'Aisle 02 (Ambient Reserve)', startY: 220 },
    { code: 'R03', label: 'Aisle 03 (Heavy Structural)', startY: 310 },
  ];

  aisles.forEach((aisle) => {
    for (let bay = 1; bay <= 4; bay++) {
      for (let level = 1; level <= 3; level++) {
        for (const pos of ['A', 'B'] as const) {
          const slotId = `${aisle.code}-B0${bay}-L${level}-${pos}`;
          // Level 1 = 2,800 lbs max, Level 2 = 2,500 lbs max, Level 3 = 2,000 lbs max
          const levelMaxWeight = level === 1 ? 2800 : level === 2 ? 2500 : 2000;
          // Level 1 & 2 = 68" clearance, Level 3 = 76" clearance
          const heightClearance = level === 3 ? 76 : 68;

          // Deterministic seed occupancy for realism (approx 35% pre-occupied)
          const isPreOccupied = (bay + level + (pos === 'A' ? 1 : 2)) % 3 === 0;

          rackSlots.push({
            id: slotId,
            code: slotId,
            zoneId: 'ZONE-RACKS',
            type: 'rack_bin',
            aisle: aisle.code,
            bay: `B0${bay}`,
            level,
            position: pos,
            canvasCoords: {
              x: 30 + (bay - 1) * 95 + (pos === 'B' ? 42 : 0),
              y: aisle.startY + (level - 1) * 25,
              width: 38,
              height: 20,
            },
            dimensions: { lengthIn: 48, widthIn: 40, heightIn: heightClearance },
            maxWeightLbs: levelMaxWeight,
            bayMaxWeightLbs: 6000,
            allowedClasses: ['ambient'],
            groundOnlyAllowed: level === 1,
            status: isPreOccupied ? 'occupied' : 'available',
            currentOccupantId: isPreOccupied ? `PRE-STOCK-${slotId}` : undefined,
          });
        }
      }
    }
  });

  const rackZone: Zone = {
    id: 'ZONE-RACKS',
    code: 'ZR-AMB',
    name: 'Selective High-Bay Racks (Aisles R01–R03)',
    type: 'high_bay_rack',
    canvasBounds: { x: 20, y: 110, width: 400, height: 290 },
    color: '#475569', // Slate (was indigo)
    slots: rackSlots,
  };

  // 4. Bulk Floor Storage (Slab-on-Grade for Heavy / Oversized Freight)
  const bulkSlots: LocationSlot[] = [1, 2, 3, 4, 5, 6].map((num) => ({
    id: `BLK-0${num}`,
    code: `BULK-0${num}`,
    zoneId: 'ZONE-BULK',
    type: 'floor_bulk',
    canvasCoords: { x: 440 + ((num - 1) % 3) * 105, y: 130 + Math.floor((num - 1) / 3) * 65, width: 95, height: 55 },
    dimensions: { lengthIn: 96, widthIn: 96, heightIn: 180 }, // high vertical clearance
    maxWeightLbs: 8500, // reinforced concrete pad
    allowedClasses: ['ambient'],
    groundOnlyAllowed: true,
    status: num === 1 ? 'occupied' : 'available',
    currentOccupantId: num === 1 ? 'PRE-HEAVY-PRESS-01' : undefined,
  }));

  const bulkZone: Zone = {
    id: 'ZONE-BULK',
    code: 'ZB-FLR',
    name: 'Bulk Floor Storage (Slab-on-Grade)',
    type: 'bulk_floor',
    canvasBounds: { x: 430, y: 110, width: 330, height: 150 },
    color: '#14b8a6', // Teal
    slots: bulkSlots,
  };

  // 5. Cold Storage Vault (Controlled Atmosphere 34°F)
  const coldSlots: LocationSlot[] = [1, 2, 3, 4, 5, 6].map((num) => ({
    id: `COLD-0${num}`,
    code: `COLD-0${num}`,
    zoneId: 'ZONE-COLD',
    type: 'floor_bulk',
    canvasCoords: { x: 440 + ((num - 1) % 3) * 105, y: 285 + Math.floor((num - 1) / 3) * 55, width: 95, height: 48 },
    dimensions: { lengthIn: 54, widthIn: 48, heightIn: 84 },
    maxWeightLbs: 3500,
    allowedClasses: ['chilled', 'frozen'],
    groundOnlyAllowed: true,
    status: num === 2 ? 'occupied' : 'available',
    currentOccupantId: num === 2 ? 'PRE-DAIRY-PALLET' : undefined,
    temperatureRangeF: { min: 32, max: 38 },
  }));

  const coldZone: Zone = {
    id: 'ZONE-COLD',
    code: 'ZC-VAULT',
    name: 'Reefer Cold Vault (34°F Perishables)',
    type: 'cold_vault',
    canvasBounds: { x: 430, y: 270, width: 330, height: 130 },
    temperatureRangeF: { min: 32, max: 38 },
    color: '#06b6d4', // Cyan
    slots: coldSlots,
  };

  // 6. HazMat Certified Containment Pad (Spill Berm & Suppression)
  const hazmatSlots: LocationSlot[] = [1, 2, 3, 4].map((num) => ({
    id: `HAZ-0${num}`,
    code: `HAZ-0${num}`,
    zoneId: 'ZONE-HAZMAT',
    type: 'floor_bulk',
    canvasCoords: { x: 780 + ((num - 1) % 2) * 110, y: 130 + Math.floor((num - 1) / 2) * 70, width: 100, height: 60 },
    dimensions: { lengthIn: 60, widthIn: 60, heightIn: 96 },
    maxWeightLbs: 4500,
    allowedClasses: ['hazmat', 'ambient'],
    groundOnlyAllowed: true,
    status: num === 1 ? 'occupied' : 'available',
    currentOccupantId: num === 1 ? 'PRE-CHEM-DRUM-PALLET' : undefined,
  }));

  const hazmatZone: Zone = {
    id: 'ZONE-HAZMAT',
    code: 'ZH-CONT',
    name: 'HazMat Spill-Containment Pad',
    type: 'bulk_floor',
    canvasBounds: { x: 770, y: 110, width: 235, height: 155 },
    color: '#f97316', // Orange
    slots: hazmatSlots,
  };

  // 7. Yard & Overflow Storage (Parking spots for 20ft & 53ft Intermodal Containers)
  const yardSlots: LocationSlot[] = [1, 2, 3, 4, 5, 6].map((num) => ({
    id: `YARD-0${num}`,
    code: `Y-${num < 10 ? '0' + num : num}`,
    zoneId: 'ZONE-YARD',
    type: 'yard_slot',
    canvasCoords: { x: 780 + ((num - 1) % 2) * 110, y: 285 + Math.floor((num - 1) / 2) * 55, width: 100, height: 48 },
    dimensions: { lengthIn: 636, widthIn: 102, heightIn: 114 }, // Container parking footprint
    maxWeightLbs: 65000,
    allowedClasses: ['ambient', 'hazmat'],
    groundOnlyAllowed: true,
    status: num === 2 ? 'occupied' : 'available',
    currentOccupantId: num === 2 ? 'CONTAINER-MSKU-910284' : undefined,
  }));

  const yardZone: Zone = {
    id: 'ZONE-YARD',
    code: 'ZY-OVERFLOW',
    name: 'Yard & Intermodal Container Depot',
    type: 'yard_container_storage',
    canvasBounds: { x: 770, y: 270, width: 235, height: 130 },
    color: '#84cc16', // Lime
    slots: yardSlots,
  };

  return {
    id: 'FACILITY-DC-04',
    code: 'DC-04',
    name: 'Midwest Logistics Hub & Freight Terminal',
    address: '4200 Logistics Parkway, Joliet, IL 60436',
    totalSquareFeet: 125000,
    clearHeightFt: 36,
    zones: [dockZone, stagingZone, rackZone, bulkZone, coldZone, hazmatZone, yardZone],
  };
}

/**
 * Seed Dual-Role Containers & Movable Assets
 * Demonstrates: A shipping container is BOTH an asset at YARD-02 and a storage space holding pallets!
 */
export function createSeedMoveableEntities(): MoveableEntity[] {
  const container53: MoveableEntity = {
    id: 'CONTAINER-MSKU-910284',
    type: 'intermodal_container_53',
    label: '53ft Dry Van Container MSKU-910284',
    dimensions: { lengthIn: 636, widthIn: 102, heightIn: 110 },
    weightLbs: 8400, // tare weight
    environmentalClass: 'ambient',
    groundOnly: true,
    stackable: true,
    parentLocationId: 'YARD-02', // Parked at Yard Position Y-02
    isStorageContainer: true,
    containedEntityIds: ['PALLET-YARD-C01', 'PALLET-YARD-C02'],
  };

  const palletInContainer1: MoveableEntity = {
    id: 'PALLET-YARD-C01',
    type: 'standard_gma_pallet',
    label: 'Pallet: Industrial Fasteners (1/2" bolts)',
    sku: 'SKU-FAST-902',
    skuDescription: 'Grade 8 Heavy Hex Bolts (40 Cases)',
    dimensions: { lengthIn: 48, widthIn: 40, heightIn: 52 },
    weightLbs: 1850,
    environmentalClass: 'ambient',
    groundOnly: false,
    stackable: true,
    parentLocationId: 'CONTAINER-MSKU-910284', // Held inside container!
    isStorageContainer: false,
  };

  const palletInContainer2: MoveableEntity = {
    id: 'PALLET-YARD-C02',
    type: 'standard_gma_pallet',
    label: 'Pallet: Stamped Steel Brackets',
    sku: 'SKU-STMP-441',
    skuDescription: 'Reinforced Trailer Corner Castings',
    dimensions: { lengthIn: 48, widthIn: 40, heightIn: 48 },
    weightLbs: 2100,
    environmentalClass: 'ambient',
    groundOnly: false,
    stackable: true,
    parentLocationId: 'CONTAINER-MSKU-910284', // Held inside container!
    isStorageContainer: false,
  };

  return [container53, palletInContainer1, palletInContainer2];
}

/**
 * Spatial Facility Helpers
 */
export function getAllSlots(facility: Facility): LocationSlot[] {
  return facility.zones.flatMap((z) => z.slots);
}

export function findSlotById(facility: Facility, slotId: string): LocationSlot | undefined {
  for (const zone of facility.zones) {
    const found = zone.slots.find((s) => s.id === slotId);
    if (found) return found;
  }
  return undefined;
}

export function findZoneBySlotId(facility: Facility, slotId: string): Zone | undefined {
  return facility.zones.find((z) => z.slots.some((s) => s.id === slotId));
}

export interface FacilityMetrics {
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  occupancyPercent: number;
  totalWeightCapacityLbs: number;
}

export function computeFacilityMetrics(facility: Facility): FacilityMetrics {
  const allSlots = getAllSlots(facility);
  const totalSlots = allSlots.length;
  const availableSlots = allSlots.filter((s) => s.status === 'available').length;
  const occupiedSlots = allSlots.filter((s) => s.status === 'occupied').length;
  const reservedSlots = allSlots.filter((s) => s.status === 'reserved_inbound').length;
  const totalWeightCapacityLbs = allSlots.reduce((sum, s) => sum + s.maxWeightLbs, 0);

  const occupancyPercent = totalSlots > 0 ? Math.round(((occupiedSlots + reservedSlots) / totalSlots) * 100) : 0;

  return {
    totalSlots,
    availableSlots,
    occupiedSlots,
    reservedSlots,
    occupancyPercent,
    totalWeightCapacityLbs,
  };
}
