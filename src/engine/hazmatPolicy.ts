/**
 * Data-Driven HazMat Policy (P06) — I11
 * Site-specific HazMat rules loaded from JSON config instead of hardcoded matrix.
 */

import { HazmatClass } from './hazmatCompatibility';

export interface HazmatPolicyConfig {
  siteId: string;
  forbiddenPairs?: [HazmatClass, HazmatClass][];
  minSeparationFt?: number;
  maxQuantityByClass?: Partial<Record<HazmatClass, number>>;
  notes?: string;
}

export function parseHazmatPolicy(json: string): HazmatPolicyConfig {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error('Invalid HazMat policy JSON.'); }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('HazMat policy must be an object.');
  const cfg = parsed as HazmatPolicyConfig;
  if (!cfg.siteId || typeof cfg.siteId !== 'string') throw new Error('HazMat policy requires siteId.');
  if (cfg.forbiddenPairs) {
    for (const pair of cfg.forbiddenPairs) {
      if (!Array.isArray(pair) || pair.length !== 2) throw new Error('forbiddenPairs entries must be [classA, classB].');
    }
  }
  return cfg;
}

export function applyHazmatPolicy(
  incomingClass: HazmatClass,
  existingClasses: HazmatClass[],
  policy: HazmatPolicyConfig,
  incomingQuantity?: number
): { compatible: boolean; conflicts: string[] } {
  const conflicts: string[] = [];
  if (policy.forbiddenPairs) {
    for (const [a, b] of policy.forbiddenPairs) {
      if ((incomingClass === a && existingClasses.includes(b)) ||
          (incomingClass === b && existingClasses.includes(a))) {
        conflicts.push(`Site policy forbids ${a} with ${b}.`);
      }
    }
  }
  const cap = policy.maxQuantityByClass?.[incomingClass];
  if (cap !== undefined && incomingQuantity !== undefined && incomingQuantity > cap) {
    conflicts.push(`Site policy caps ${incomingClass} at ${cap}; incoming ${incomingQuantity} exceeds cap.`);
  }
  return { compatible: conflicts.length === 0, conflicts };
}
