/**
 * Multi-Constraint Putaway Optimization Engine
 * Evaluates dimensions, weights, environmental regimes, ground-only rules,
 * and bay capacities to propose feasible warehouse storage plans.
 */

import {
  Facility,
  InboundManifest,
  InboundPalletItem,
  LocationSlot,
  PutawayRecommendation,
  PutawaySolveSummary,
  PutawayStatus,
} from './types';
import { getAllSlots, findZoneBySlotId } from './spatialModel';

export function solvePutawayManifest(
  facility: Facility,
  manifest: InboundManifest
): PutawaySolveSummary {
  const allSlots = getAllSlots(facility);
  // Track reserved slot IDs within this solve run to prevent double-booking
  const allocatedSlotIds = new Set<string>();
  const plannedWeights = new Map<string, number>();

  // Pre-seed already occupied or externally reserved slots
  allSlots.forEach((slot) => {
    if (slot.status !== 'available') {
      allocatedSlotIds.add(slot.id);
    }
  });

  const recommendations: PutawayRecommendation[] = [];

  // Keep scarce locations for constrained cargo. Recommendation display order
  // remains the manifest's order after allocation.
  const initialBayCapacity = new Map(allSlots.map(slot => [slot.id, bayCapacityForSlot(slot, allSlots)]));
  const candidateCounts = new Map(manifest.items.map(item => [item.palletId, allSlots.filter(slot => {
      if (allocatedSlotIds.has(slot.id) || slot.type === 'dock_door' || slot.type === 'staging_lane') return false;
      const bay = initialBayCapacity.get(slot.id);
      return checkSlotSuitability(item, slot).compatible && (!bay || bay.usedWeightLbs + item.weightLbs <= bay.maxWeightLbs);
    }).length]));
  const orderedItems = [...manifest.items].sort((a, b) =>
    candidateCounts.get(a.palletId)! - candidateCounts.get(b.palletId)! || Number(b.groundOnly) - Number(a.groundOnly) || b.weightLbs - a.weightLbs);
  for (const item of orderedItems) {
    const evalResult = evaluatePalletPlacement(item, allSlots, allocatedSlotIds, facility, plannedWeights);

    if (evalResult.targetSlotId) {
      allocatedSlotIds.add(evalResult.targetSlotId);
      plannedWeights.set(evalResult.targetSlotId, item.weightLbs);
    }

    recommendations.push(evalResult);
  }
  const manifestOrder = new Map(manifest.items.map((item, index) => [item.palletId, index]));
  recommendations.sort((a, b) => manifestOrder.get(a.palletId)! - manifestOrder.get(b.palletId)!);

  const proposedCount = recommendations.filter((r) => r.status === 'proposed').length;
  const alternativeCount = recommendations.filter((r) => r.status === 'alternative').length;
  const conflictCount = recommendations.filter((r) => r.status === 'conflict').length;

  return {
    totalExpected: manifest.items.length,
    proposedCount,
    alternativeCount,
    conflictCount,
    recommendations,
    computedAt: new Date().toISOString(),
  };
}

interface SlotCandidateScore {
  slot: LocationSlot;
  score: number;
  isAlternative: boolean;
  reasons: string[];
}


export interface SlotCostContext {
  dockOrigin: { x: number; y: number };
}



export function environmentalClassFromTempRange(range: { min: number; max: number }): 'ambient' | 'chilled' | 'frozen' | 'hazmat' {
  // Classify by the range's midpoint and max, not max alone.
  // A room maintaining 28-34F is chilled, not frozen (frozen requires <= 5F max).
  // A room maintaining -25 to 5F is frozen.
  const mid = (range.min + range.max) / 2;
  if (range.max <= 5) return 'frozen';
  if (range.max <= 46 && mid >= 28) return 'chilled';
  if (range.max <= 46 && mid < 28) return 'frozen';
  return 'ambient';
}
export function computePutawayCost(slot: LocationSlot, item: { weightLbs: number }, ctx?: SlotCostContext): number {
  const origin = ctx?.dockOrigin ?? { x: 30, y: 30 };
  const dx = slot.canvasCoords.x - origin.x;
  const dy = slot.canvasCoords.y - origin.y;
  const travelDistance = Math.sqrt(dx * dx + dy * dy);
  // Handling cost: heavier items cost more to lift; higher levels cost more
  const levelPenalty = (slot.level ?? 1) * 5;
  const weightHandling = item.weightLbs * 0.001;
  return Math.round((travelDistance + levelPenalty + weightHandling) * 100) / 100;
}

function evaluatePalletPlacement(
  item: InboundPalletItem,
  allSlots: LocationSlot[],
  allocatedSlotIds: Set<string>,
  facility: Facility,
  plannedWeights: Map<string, number>
): PutawayRecommendation {
  const violationsCollected: string[] = [];
  const validCandidates: SlotCandidateScore[] = [];

  // Filter slots by general availability
  const openSlots = allSlots.filter((s) => !allocatedSlotIds.has(s.id) && s.type !== 'dock_door' && s.type !== 'staging_lane');

  if (openSlots.length === 0) {
    return {
      palletId: item.palletId,
      barcode: item.barcode,
      sku: item.sku,
      description: item.description,
      packageType: item.packageType,
      groundOnly: item.groundOnly,
      weightLbs: item.weightLbs,
      dimensions: item.dimensions,
      environmentalClass: item.environmentalClass,
      status: 'conflict',
      targetSlotId: null,
      targetLocationCode: 'NONE',
      targetZoneName: 'Facility Exhausted',
      suitabilityScore: 0,
      reason: 'No open storage positions remaining in facility.',
      violations: ['Facility total storage capacity 100% committed.'],
    };
  }

  for (const slot of openSlots) {
    const check = checkSlotSuitability(item, slot);
    const bay = bayCapacityForSlot(slot, allSlots, plannedWeights);
    if (check.compatible && bay && bay.usedWeightLbs + item.weightLbs > bay.maxWeightLbs) {
      violationsCollected.push(`Shared rack bay ${bay.key} weight would exceed ${bay.maxWeightLbs} lbs (${bay.usedWeightLbs} lbs already committed).`);
      continue;
    }
    if (check.compatible) {
      const cost = computePutawayCost(slot, item);
      const costAdjustment = Math.max(-15, Math.min(0, -Math.round(cost / 10)));
      validCandidates.push({
        slot,
        score: check.score + costAdjustment,
        isAlternative: check.isAlternative,
        reasons: [...check.reasons, `Putaway cost ${cost}`],
      });
    } else {
      if (check.violation && !violationsCollected.includes(check.violation)) {
        violationsCollected.push(check.violation);
      }
    }
  }

  // If no candidates matched
  if (validCandidates.length === 0) {
    return {
      palletId: item.palletId,
      barcode: item.barcode,
      sku: item.sku,
      description: item.description,
      packageType: item.packageType,
      groundOnly: item.groundOnly,
      weightLbs: item.weightLbs,
      dimensions: item.dimensions,
      environmentalClass: item.environmentalClass,
      status: 'conflict',
      targetSlotId: null,
      targetLocationCode: 'NONE',
      targetZoneName: 'Unassignable',
      suitabilityScore: 0,
      reason: `Failed physical constraints: ${violationsCollected.slice(0, 2).join('; ')}`,
      violations: violationsCollected,
    };
  }

  // Sort candidates by score descending
  validCandidates.sort((a, b) => b.score - a.score);

  const best = validCandidates[0];
  const zone = findZoneBySlotId(facility, best.slot.id);
  const status: PutawayStatus = best.isAlternative ? 'alternative' : 'proposed';

  const alternativeSlotIds = validCandidates
    .slice(1, 4)
    .map((c) => c.slot.code);

  return {
    palletId: item.palletId,
    barcode: item.barcode,
    sku: item.sku,
    description: item.description,
    packageType: item.packageType,
    groundOnly: item.groundOnly,
    weightLbs: item.weightLbs,
    dimensions: item.dimensions,
    environmentalClass: item.environmentalClass,
    status,
    targetSlotId: best.slot.id,
    targetLocationCode: best.slot.code,
    targetZoneName: zone ? zone.name : 'Storage Zone',
    suitabilityScore: Math.min(100, Math.max(10, Math.round(best.score))),
    reason: best.reasons.join(', '),
    violations: violationsCollected.length > 0 ? violationsCollected : undefined,
    alternativeSlotIds: alternativeSlotIds.length > 0 ? alternativeSlotIds : undefined,
  };
}

interface SuitabilityCheck {
  compatible: boolean;
  score: number;
  isAlternative: boolean;
  reasons: string[];
  violation?: string;
}


export function defaultTempRangeForClass(cls: string): { min: number; max: number } {
  switch (cls) {
    case 'frozen': return { min: -25, max: 5 };
    case 'chilled': return { min: 33, max: 46 };
    case 'hazmat': return { min: 50, max: 80 };
    case 'ambient':
    default: return { min: 50, max: 80 };
  }
}

export function checkSlotSuitability(item: Pick<InboundPalletItem, 'environmentalClass' | 'packageType' | 'weightLbs' | 'dimensions' | 'groundOnly' | 'storageTempRangeF'>, slot: LocationSlot): SuitabilityCheck {
  const reasons: string[] = [];

  if (!Number.isFinite(item.weightLbs) || item.weightLbs <= 0 || !Object.values(item.dimensions).every(value => Number.isFinite(value) && value > 0) || typeof item.packageType !== 'string' || typeof item.groundOnly !== 'boolean') {
    return { compatible: false, score: 0, isAlternative: false, reasons: [], violation: 'Physical dimensions, mass and storage requirements must be declared. Replan before allocation.' };
  }

  // 1. Environmental class compatibility
  if (!slot.allowedClasses.includes(item.environmentalClass)) {
    return {
      compatible: false,
      score: 0,
      isAlternative: false,
      reasons: [],
      violation: `Zone does not support ${item.environmentalClass.toUpperCase()} classification (requires certified storage)`,
    };
  }

  // 1a. Temperature range compatibility: the slot's maintained range must cover
  // the commodity's required storage range. A 34F chilled room cannot hold frozen cargo.
  if (slot.temperatureRangeF) {
    const itemRange = item.storageTempRangeF ?? defaultTempRangeForClass(item.environmentalClass);
    // Overlap check: the slot's maintained range and the commodity's required range
    // must overlap. A 34F chilled room cannot hold frozen cargo (ranges disjoint).
    if (!(itemRange.min <= slot.temperatureRangeF.max && itemRange.max >= slot.temperatureRangeF.min)) {
      return {
        compatible: false,
        score: 0,
        isAlternative: false,
        reasons: [],
        violation: `Commodity requires ${itemRange.min}–${itemRange.max}°F but slot maintains ${slot.temperatureRangeF.min}–${slot.temperatureRangeF.max}°F (temperature mismatch)`,
      };
    }
  }

  // 1b. Yard slot policy: Exterior yard slots require containerized equipment or trailers
  if (slot.type === 'yard_slot' && !item.packageType.toLowerCase().includes('container') && !item.packageType.toLowerCase().includes('intermodal')) {
    return {
      compatible: false,
      score: 0,
      isAlternative: false,
      reasons: [],
      violation: 'Exterior yard slots require intermodal or ISO containerized cargo',
    };
  }

  // 2. Weight capacity constraint
  if (item.weightLbs > slot.maxWeightLbs) {
    return {
      compatible: false,
      score: 0,
      isAlternative: false,
      reasons: [],
      violation: `Pallet weight ${item.weightLbs} lbs exceeds slot weight rating (${slot.maxWeightLbs} lbs)`,
    };
  }

  // 3. Dimensional clearance constraints
  if (item.dimensions.heightIn > slot.dimensions.heightIn) {
    return {
      compatible: false,
      score: 0,
      isAlternative: false,
      reasons: [],
      violation: `Pallet height ${item.dimensions.heightIn}" exceeds slot vertical clearance (${slot.dimensions.heightIn}")`,
    };
  }

  if (item.dimensions.lengthIn > slot.dimensions.lengthIn || item.dimensions.widthIn > slot.dimensions.widthIn) {
    return {
      compatible: false,
      score: 0,
      isAlternative: false,
      reasons: [],
      violation: `Pallet footprint ${item.dimensions.lengthIn}x${item.dimensions.widthIn}" exceeds slot dimensions`,
    };
  }

  // 4. Ground-only constraint
  if (item.groundOnly && !slot.groundOnlyAllowed) {
    return {
      compatible: false,
      score: 0,
      isAlternative: false,
      reasons: [],
      violation: `Item requires slab-on-grade ground storage; cannot be elevated to Level ${slot.level}`,
    };
  }

  // Calculation of fit score and primary vs alternative classification
  let score = 70;
  let isAlternative = false;

  // Dedicated environment matching boosts
  if (item.environmentalClass === 'chilled' || item.environmentalClass === 'frozen') {
    score += 25;
    reasons.push('Direct temperature-controlled vault allocation');
  } else if (item.environmentalClass === 'hazmat') {
    score += 25;
    reasons.push('Certified HazMat spill-containment berth');
  } else {
    // Ambient goods
    if (slot.type === 'rack_bin') {
      score += 20;
      reasons.push(`Optimal high-bay rack storage (Level ${slot.level})`);

      // Weight tier matching: heavier items prefer Level 1
      if (item.weightLbs > 2000 && slot.level === 1) {
        score += 10;
        reasons.push('Heavy tier placed on lower ground beam');
      }
    } else if (slot.type === 'floor_bulk') {
      // Diverted to bulk floor
      isAlternative = true;
      score += 5;
      reasons.push('Allocated to slab-on-grade bulk floor (accommodates high mass/clearance)');
    } else if (slot.type === 'yard_slot') {
      // Overflow yard container
      isAlternative = true;
      score -= 15;
      reasons.push('Assigned to exterior yard container staging (overflow capacity)');
    }
  }

  return {
    compatible: true,
    score,
    isAlternative,
    reasons,
  };
}

/** Unknown occupied/reserved mass consumes the full position rating, never zero. */
export function bayCapacityForSlot(slot: LocationSlot, allSlots: LocationSlot[], plannedWeights: ReadonlyMap<string, number> = new Map()) {
  if (slot.type !== 'rack_bin' || !slot.aisle || !slot.bay || !slot.bayMaxWeightLbs) return null;
  const key = `${slot.zoneId}/${slot.aisle}/${slot.bay}`;
  const peers = allSlots.filter(peer => peer.type === 'rack_bin' && peer.zoneId === slot.zoneId && peer.aisle === slot.aisle && peer.bay === slot.bay);
  const maxWeightLbs = Math.min(...peers.map(peer => peer.bayMaxWeightLbs ?? slot.bayMaxWeightLbs!));
  let unknownMassCount = 0;
  const usedWeightLbs = peers.reduce((sum, peer) => {
    if (plannedWeights.has(peer.id)) return sum + plannedWeights.get(peer.id)!;
    if (peer.status === 'available') return sum;
    const declared = peer.status === 'reserved_inbound' ? peer.reservedWeightLbs : peer.currentWeightLbs;
    if (typeof declared === 'number' && Number.isFinite(declared) && declared >= 0) return sum + declared;
    unknownMassCount++;
    return sum + peer.maxWeightLbs;
  }, 0);
  return { key, maxWeightLbs, usedWeightLbs, unknownMassCount };
}
