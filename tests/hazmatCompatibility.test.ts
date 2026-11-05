import { describe, it, expect } from 'vitest';
import { areHazmatClassesCompatible, checkHazmatCompatibility } from '../src/engine/hazmatCompatibility';

describe('P06 HazMat Compatibility', () => {
  it('flags explosives with oxidizers as incompatible', () => {
    const r = areHazmatClassesCompatible('1', '5.1');
    expect(r.compatible).toBe(false);
    expect(r.minSeparationFt).toBe(20);
  });

  it('same class is compatible', () => {
    const r = areHazmatClassesCompatible('3', '3');
    expect(r.compatible).toBe(true);
  });

  it('checkHazmatCompatibility aggregates conflicts', () => {
    const r = checkHazmatCompatibility('3', ['5.1', '8']);
    expect(r.compatible).toBe(false);
    expect(r.conflicts.length).toBe(1);
  });

  it('site policy forbids additional pairs', () => {
    const r = checkHazmatCompatibility('3', ['9'], { forbiddenPairs: [['3','9']] });
    expect(r.compatible).toBe(false);
  });

  it('no conflicts when compatible', () => {
    const r = checkHazmatCompatibility('3', ['9']);
    expect(r.compatible).toBe(true);
  });
});
