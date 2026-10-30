/**
 * Cargo Fit (P01) Bridge for Product 06
 * Ingests Open Logistics Loading Plan (OLLP-v1) manifests from Cargo Fit
 * and transforms them into destination warehouse space allocation requests.
 */

import { InboundManifest, InboundPalletItem } from './types';

export interface CargoFitVehicleLoad {
  loadId: string;
  vehicleType: string;
  carrier: string;
  trailerNumber: string;
  destinationFacilityId: string;
  totalWeightLbs: number;
  packedItems: Array<{
    itemId: string;
    barcode?: string;
    stackable?: boolean;
    description: string;
    lengthIn: number;
    widthIn: number;
    heightIn: number;
    weightLbs: number;
    isHazmat?: boolean;
    temperatureClass?: 'ambient' | 'chilled' | 'frozen';
    groundOnly?: boolean;
  }>;
}

export function translateCargoFitLoadToInboundManifest(
  load: CargoFitVehicleLoad,
  dockAssigned: string = 'DOCK-02',
  stagingLaneAssigned: string = 'STG-B'
): InboundManifest {
  const items: InboundPalletItem[] = load.packedItems.map((item) => {

    let envClass: 'ambient' | 'chilled' | 'frozen' | 'hazmat' = 'ambient';
    if (item.isHazmat) {
      envClass = 'hazmat';
    } else if (item.temperatureClass) {
      envClass = item.temperatureClass;
    }

    return {
      palletId: item.itemId,
      barcode: item.barcode ?? `${load.loadId}:${item.itemId}`,
      sku: `SKU-CF-${item.itemId}`,
      description: item.description,
      packageType: 'Cargo Fit Optimized Pallet',
      dimensions: {
        lengthIn: item.lengthIn,
        widthIn: item.widthIn,
        heightIn: item.heightIn,
      },
      weightLbs: item.weightLbs,
      environmentalClass: envClass,
      hazmatClass: item.isHazmat ? 'HazMat Transport Restricted' : undefined,
      groundOnly: item.groundOnly ?? (item.weightLbs > 2800),
      stackable: item.stackable ?? false,
      customerAccount: 'Cargo Fit Integrated Shipper',
    };
  });

  return {
    manifestId: `MNFST-CF-${load.loadId}`,
    deliveryOrderNumber: `DO-CF-${Date.now().toString().slice(-6)}`,
    carrierName: load.carrier,
    vehiclePlate: load.trailerNumber,
    eta: 'Today 15:00 CST (Dispatched from P01)',
    originTruckLoadId: load.loadId,
    dockAssigned,
    stagingLaneAssigned,
    items,
  };
}
