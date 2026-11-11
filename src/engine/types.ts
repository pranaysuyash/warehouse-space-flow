/**
 * Warehouse Space & Flow Planner (Product 06)
 * Core Domain Models & Shared Spatial Engine Types
 */

export type EnvironmentalClass = 'ambient' | 'chilled' | 'frozen' | 'hazmat';

export type ZoneType =
  | 'receiving_dock'
  | 'inbound_staging'
  | 'high_bay_rack'
  | 'bulk_floor'
  | 'cold_vault'
  | 'yard_container_storage';

export type SlotType =
  | 'dock_door'
  | 'staging_lane'
  | 'rack_bin'
  | 'floor_bulk'
  | 'yard_slot';

export type SlotOccupancyStatus =
  | 'available'
  | 'reserved_inbound'
  | 'occupied'
  | 'blocked'
  | 'quarantined';

export interface Dimensions3D {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
}

export interface Coordinates2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LocationSlot {
  id: string;
  code: string;
  zoneId: string;
  type: SlotType;
  aisle?: string;
  bay?: string;
  level?: number; // 1 = lower/ground beam, 2 = mid, 3 = top
  position?: 'A' | 'B';
  canvasCoords: Coordinates2D;
  dimensions: Dimensions3D;
  maxWeightLbs: number;
  bayMaxWeightLbs?: number;
  allowedClasses: EnvironmentalClass[];
  groundOnlyAllowed: boolean;
  status: SlotOccupancyStatus;
  currentOccupantId?: string;
  reservedPalletId?: string;
  /** Declared mass only. Absence is unknown and consumes the slot rating for bay checks. */
  currentWeightLbs?: number;
  /** Maintained temperature range for this slot (°F). Used to reject commodity temperature mismatches. */
  temperatureRangeF?: { min: number; max: number };
  /** DOT hazmat class of the current occupant, when known. Enables segregation checks. */
  hazmatClass?: string;
  reservedWeightLbs?: number;
}

export interface Zone {
  id: string;
  code: string;
  name: string;
  type: ZoneType;
  canvasBounds: Coordinates2D;
  temperatureRangeF?: { min: number; max: number };
  color: string;
  slots: LocationSlot[];
}

export interface Facility {
  id: string;
  code: string;
  name: string;
  address: string;
  totalSquareFeet: number;
  clearHeightFt: number;
  zones: Zone[];
}

/**
 * Moveable Entity with Dual-Role Containerization
 * Can be an item stored in a space, AND can be a container holding other items.
 */
export interface MoveableEntity {
  id: string;
  type:
    | 'standard_gma_pallet'
    | 'euro_pallet'
    | 'drum_pallet'
    | 'intermodal_container_53'
    | 'intermodal_container_20'
    | 'gaylord';
  label: string;
  sku?: string;
  skuDescription?: string;
  dimensions: Dimensions3D;
  weightLbs: number;
  environmentalClass: EnvironmentalClass;
  /** Declared accepted commodity temperature interval (°F); class-only defaults are illustrative, not a declaration. */
  storageTempRangeF?: { min: number; max: number };
  hazmatClass?: string;
  groundOnly: boolean;
  stackable: boolean;
  maxStackWeightLbs?: number;
  parentLocationId: string; // Slot ID or another MoveableEntity ID
  isStorageContainer: boolean;
  containedEntityIds?: string[];
}

/**
 * Inbound Manifest & Item Definitions
 */
export interface InboundPalletItem {
  palletId: string;
  barcode: string;
  sku: string;
  description: string;
  packageType: string;
  dimensions: Dimensions3D;
  weightLbs: number;
  environmentalClass: EnvironmentalClass;
  /** Declared accepted commodity temperature interval (°F); class-only defaults are illustrative, not a declaration. */
  storageTempRangeF?: { min: number; max: number };
  hazmatClass?: string;
  groundOnly: boolean;
  stackable: boolean;
  customerAccount: string;
}

export interface InboundManifest {
  manifestId: string;
  deliveryOrderNumber: string;
  carrierName: string;
  vehiclePlate: string;
  eta: string;
  originTruckLoadId?: string; // Bridged from P01 Cargo Fit
  dockAssigned: string;
  stagingLaneAssigned: string;
  items: InboundPalletItem[];
}

/**
 * Putaway Recommendation & Constraint Solver Types
 */
export type PutawayStatus = 'proposed' | 'alternative' | 'conflict';

export interface PutawayRecommendation {
  palletId: string;
  barcode: string;
  sku: string;
  description: string;
  packageType: string;
  groundOnly: boolean;
  weightLbs: number;
  dimensions: Dimensions3D;
  environmentalClass: EnvironmentalClass;
  status: PutawayStatus;
  targetSlotId: string | null;
  targetLocationCode: string;
  targetZoneName: string;
  suitabilityScore: number;
  reason: string;
  violations?: string[];
  alternativeSlotIds?: string[];
}

export interface PutawaySolveSummary {
  totalExpected: number;
  proposedCount: number;
  alternativeCount: number;
  conflictCount: number;
  recommendations: PutawayRecommendation[];
  computedAt: string;
}

/**
 * GS1 EPCIS 2.0 Standard Audit Events
 */
export interface EpcisEvent {
  eventId: string;
  eventType: 'ObjectEvent' | 'AggregationEvent' | 'TransactionEvent';
  eventTime: string;
  action: 'ADD' | 'OBSERVE' | 'DELETE';
  bizStep: string;
  disposition: string;
  epcList: string[];
  readPoint: string;
  bizLocation: string;
  verificationEvidence: {
    scanType: 'BARCODE_2D_DATAMATRIX' | 'RFID_UHF' | 'MANUAL_DISPATCH';
    operatorId: string;
    verifiedTimestamp: string;
    notes?: string;
  };
  /** Truth level of this event: simulated (local), observed (verified), published (external). */
  verificationStatus: 'simulated' | 'observed' | 'published';
}

export interface DiscrepancyReport {
  id: string;
  palletId: string;
  expectedLocationId: string;
  actualLocationId: string;
  discrepancyType: 'MISPLACED_LOCATION' | 'DIMENSION_MISMATCH' | 'WEIGHT_EXCEEDED' | 'DAMAGED';
  reportedBy: string;
  timestamp: string;
  resolved: boolean;
}
