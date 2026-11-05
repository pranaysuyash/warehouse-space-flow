/**
 * HazMat Compatibility & Segregation Engine (P06)
 * Beyond broad 'hazmat' storage class: chemical compatibility, segregation
 * distances, and site-specific policies per DOT 49 CFR 177.848.
 */

export type HazmatClass =
  | '1' // Explosives
  | '2.1' // Flammable gas
  | '2.2' // Non-flammable gas
  | '2.3' // Poison gas
  | '3' // Flammable liquid
  | '4.1' // Flammable solid
  | '4.2' // Spontaneously combustible
  | '4.3' // Dangerous when wet
  | '5.1' // Oxidizer
  | '5.2' // Organic peroxide
  | '6.1' // Poison
  | '6.2' // Infectious
  | '7' // Radioactive
  | '8' // Corrosive
  | '9'; // Miscellaneous

export interface SegregationRule {
  classA: HazmatClass;
  classB: HazmatClass;
  compatible: boolean;
  minSeparationFt?: number;
  reason: string;
}

// Simplified segregation table (DOT 49 CFR 177.848). 'X' = must not be stored together.
const INCOMPATIBLE_PAIRS: [HazmatClass, HazmatClass, string][] = [
  ['1', '5.1', 'Explosives must not be stored with oxidizers'],
  ['1', '5.2', 'Explosives must not be stored with organic peroxides'],
  ['3', '5.1', 'Flammable liquids must be segregated from oxidizers'],
  ['3', '5.2', 'Flammable liquids must be segregated from organic peroxides'],
  ['4.2', '5.1', 'Spontaneously combustible with oxidizers'],
  ['4.3', '8', 'Dangerous-when-wet with corrosives'],
  ['5.1', '8', 'Oxidizers with corrosives may react'],
  ['2.1', '5.1', 'Flammable gas with oxidizer'],
  ['6.1', '1', 'Poison with explosives'],
];

export function areHazmatClassesCompatible(a: HazmatClass, b: HazmatClass): SegregationRule {
  if (a === b) {
    // Same class generally compatible with itself (with quantity limits)
    return { classA: a, classB: b, compatible: true, reason: 'Same hazard class; quantity limits apply.' };
  }
  for (const [ca, cb, reason] of INCOMPATIBLE_PAIRS) {
    if ((a === ca && b === cb) || (a === cb && b === ca)) {
      return { classA: a, classB: b, compatible: false, minSeparationFt: 20, reason };
    }
  }
  return { classA: a, classB: b, compatible: true, reason: 'No segregation conflict identified (verify site policy).' };
}

export function checkHazmatCompatibility(
  incomingClass: HazmatClass,
  existingClasses: HazmatClass[],
  sitePolicy?: { forbiddenPairs?: [HazmatClass, HazmatClass][] }
): { compatible: boolean; conflicts: SegregationRule[] } {
  const conflicts: SegregationRule[] = [];
  for (const existing of existingClasses) {
    const rule = areHazmatClassesCompatible(incomingClass, existing);
    if (!rule.compatible) conflicts.push(rule);
  }
  if (sitePolicy?.forbiddenPairs) {
    for (const [ca, cb] of sitePolicy.forbiddenPairs) {
      if ((incomingClass === ca && existingClasses.includes(cb)) ||
          (incomingClass === cb && existingClasses.includes(ca))) {
        conflicts.push({ classA: incomingClass, classB: incomingClass === ca ? cb : ca, compatible: false, reason: 'Site-specific policy forbids this combination.' });
      }
    }
  }
  return { compatible: conflicts.length === 0, conflicts };
}
