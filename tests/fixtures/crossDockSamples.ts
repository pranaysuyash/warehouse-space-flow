import type { InboundReceiptPallet, OutboundDepartureOrder } from '../../src/engine/crossDockMatching';

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
