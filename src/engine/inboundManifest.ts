/**
 * Seed Inbound Freight Manifest (40 Pallets)
 * Demonstrates mixed-freight intake: standard ambient, cold-chain, hazmat, heavy slab, and over-height units.
 */

import { InboundManifest, InboundPalletItem } from './types';

export function createCanonical40PalletManifest(): InboundManifest {
  const items: InboundPalletItem[] = [];

  // 1. Standard Ambient Pallets (Pallets #01 to #28)
  for (let i = 1; i <= 28; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    const weight = 1100 + ((i * 37) % 800); // 1,100 to 1,900 lbs
    const height = 54 + ((i * 7) % 12); // 54" to 66"

    items.push({
      palletId: `PLT-INB-${num}`,
      barcode: `0001092837400000${num}`,
      sku: `SKU-DRY-${1000 + i}`,
      description: `Consumer Goods Pack Carton Group #${num}`,
      packageType: 'Standard GMA 48x40',
      dimensions: { lengthIn: 48, widthIn: 40, heightIn: height },
      weightLbs: weight,
      environmentalClass: 'ambient',
      groundOnly: false,
      stackable: true,
      customerAccount: 'Target National Distribution',
    });
  }

  // 2. Cold Chain Perishables (Pallets #29 to #32)
  for (let i = 29; i <= 32; i++) {
    items.push({
      palletId: `PLT-INB-${i}`,
      barcode: `0001092837400000${i}`,
      sku: `SKU-COLD-${2000 + i}`,
      description: `Refrigerated Dairy & Yogurt Culture Pack #${i}`,
      packageType: 'Reefer Insulated GMA',
      dimensions: { lengthIn: 48, widthIn: 40, heightIn: 60 },
      weightLbs: 1650,
      environmentalClass: 'chilled',
      groundOnly: false,
      stackable: false,
      customerAccount: 'Chobani Cold Supply Chain',
    });
  }

  // 3. HazMat Chemical Drums (Pallets #33 to #34)
  items.push({
    palletId: 'PLT-INB-33',
    barcode: '000109283740000033',
    sku: 'SKU-HAZ-3301',
    description: '4x 55-Gal Steel Drums (Class 3 Flammable Lacquer)',
    packageType: 'Containment Drum Spill Pallet',
    dimensions: { lengthIn: 48, widthIn: 48, heightIn: 55 },
    weightLbs: 2350,
    environmentalClass: 'hazmat',
    hazmatClass: 'Class 3 Flammable Liquid (UN 1263)',
    groundOnly: true,
    stackable: false,
    customerAccount: 'Sherwin-Williams Industrial',
  });

  items.push({
    palletId: 'PLT-INB-34',
    barcode: '000109283740000034',
    sku: 'SKU-HAZ-3402',
    description: '4x 55-Gal Steel Drums (Class 8 Corrosive Cleaner)',
    packageType: 'Containment Drum Spill Pallet',
    dimensions: { lengthIn: 48, widthIn: 48, heightIn: 55 },
    weightLbs: 2420,
    environmentalClass: 'hazmat',
    hazmatClass: 'Class 8 Corrosive Liquid (UN 1760)',
    groundOnly: true,
    stackable: false,
    customerAccount: 'Ecolab Institutional Chemicals',
  });

  // 4. Overweight Heavy Machinery Crates (Pallets #35 to #37)
  // Weight > 3,000 lbs (exceeds high-bay rack beam rating of 2,800 lbs) -> requires ground bulk slab!
  items.push({
    palletId: 'PLT-INB-35',
    barcode: '000109283740000035',
    sku: 'SKU-MACH-3501',
    description: 'Cast Iron Transmission Housing Casting',
    packageType: 'Heavy Timber Skid',
    dimensions: { lengthIn: 52, widthIn: 46, heightIn: 48 },
    weightLbs: 3450, // Exceeds rack beam rating!
    environmentalClass: 'ambient',
    groundOnly: true,
    stackable: false,
    customerAccount: 'Caterpillar Heavy Components',
  });

  items.push({
    palletId: 'PLT-INB-36',
    barcode: '000109283740000036',
    sku: 'SKU-MACH-3602',
    description: 'CNC High-Speed Spindle & Motor Assembly',
    packageType: 'Heavy Timber Skid',
    dimensions: { lengthIn: 54, widthIn: 48, heightIn: 50 },
    weightLbs: 3620, // Exceeds rack beam rating!
    environmentalClass: 'ambient',
    groundOnly: true,
    stackable: false,
    customerAccount: 'Haas Automation Delivery',
  });

  items.push({
    palletId: 'PLT-INB-37',
    barcode: '000109283740000037',
    sku: 'SKU-MACH-3703',
    description: 'Hydraulic Press Ram & Hydraulic Manifold',
    packageType: 'Reinforced Steel Skid',
    dimensions: { lengthIn: 50, widthIn: 48, heightIn: 52 },
    weightLbs: 3900, // Exceeds rack beam rating!
    environmentalClass: 'ambient',
    groundOnly: true,
    stackable: false,
    customerAccount: 'Parker Hannifin Systems',
  });

  // 5. Over-Height Display Pallet (Pallet #38)
  // Height 78" (exceeds rack Level 1 & 2 clearance of 68", fits Level 3 or bulk)
  items.push({
    palletId: 'PLT-INB-38',
    barcode: '000109283740000038',
    sku: 'SKU-DSP-3801',
    description: 'Pre-Built Retail Display Tower (Corrugated Endcap)',
    packageType: 'Tall Retail Display Pallet',
    dimensions: { lengthIn: 48, widthIn: 40, heightIn: 75 }, // Exceeds 68" clearance!
    weightLbs: 890,
    environmentalClass: 'ambient',
    groundOnly: false,
    stackable: false,
    customerAccount: 'Walmart Retail Merchandising',
  });

  // 6. Deliberate Constraint Conflict Pallets (Pallets #39 and #40)
  // Pallet 39: Super-Heavy Crate (9,200 lbs) exceeding even bulk pad capacity (8,500 lbs)
  items.push({
    palletId: 'PLT-INB-39',
    barcode: '000109283740000039',
    sku: 'SKU-CONFLICT-HEAVY',
    description: 'Solid Bronze Turbine Impeller Crate',
    packageType: 'Monolithic Heavy Skid',
    dimensions: { lengthIn: 60, widthIn: 60, heightIn: 64 },
    weightLbs: 9200, // Violates 8,500 lbs max slab rating!
    environmentalClass: 'ambient',
    groundOnly: true,
    stackable: false,
    customerAccount: 'GE Power Equipment',
  });

  // Pallet 40: Massive Over-Dimension Crate exceeding both rack and bulk floor footprint clearances
  items.push({
    palletId: 'PLT-INB-40',
    barcode: '000109283740000040',
    sku: 'SKU-CONFLICT-HEIGHT',
    description: 'Architectural Glazing Crate (Oversized Glass Panels)',
    packageType: 'Vertical A-Frame Glass Crate',
    dimensions: { lengthIn: 108, widthIn: 102, heightIn: 104 }, // Violates 96x96" bulk slot dimensions and rack clearances
    weightLbs: 2150,
    environmentalClass: 'ambient',
    groundOnly: true,
    stackable: false,
    customerAccount: 'Oldcastle BuildingEnvelope',
  });

  return {
    manifestId: 'MNFST-2026-0941',
    deliveryOrderNumber: 'DO-CHI-884910',
    carrierName: 'Swift Transportation Express Fleet',
    vehiclePlate: 'IL-TRK-7841',
    eta: 'Today 14:30 CST',
    originTruckLoadId: 'CARGOFIT-LOAD-ORD-4491', // Bridged from P01
    dockAssigned: 'DOCK-02',
    stagingLaneAssigned: 'STG-B',
    items,
  };
}
