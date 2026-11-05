import { describe, it, expect } from 'vitest';
import { parseHazmatPolicy, applyHazmatPolicy } from '../src/engine/hazmatPolicy';

describe('P06 Data-Driven HazMat Policy', () => {
  it('parses valid policy', () => {
    const p = parseHazmatPolicy(JSON.stringify({ siteId: 'S1', forbiddenPairs: [['3','5.1']] }));
    expect(p.siteId).toBe('S1');
    expect(p.forbiddenPairs?.length).toBe(1);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseHazmatPolicy('{bad')).toThrow();
  });

  it('requires siteId', () => {
    expect(() => parseHazmatPolicy(JSON.stringify({}))).toThrow();
  });

  it('applies forbidden pairs', () => {
    const p = parseHazmatPolicy(JSON.stringify({ siteId: 'S1', forbiddenPairs: [['3','5.1']] }));
    const r = applyHazmatPolicy('3', ['5.1'], p);
    expect(r.compatible).toBe(false);
    expect(r.conflicts.length).toBe(1);
  });

  it('compatible when no conflicts', () => {
    const p = parseHazmatPolicy(JSON.stringify({ siteId: 'S1' }));
    const r = applyHazmatPolicy('3', ['9'], p);
    expect(r.compatible).toBe(true);
  });

  it('enforces maxQuantityByClass cap', () => {
    const p = parseHazmatPolicy(JSON.stringify({ siteId: 'S1', maxQuantityByClass: { '3': 100 } }));
    const ok = applyHazmatPolicy('3', [], p, 50);
    expect(ok.compatible).toBe(true);
    const bad = applyHazmatPolicy('3', [], p, 150);
    expect(bad.compatible).toBe(false);
    expect(bad.conflicts[0]).toContain('caps 3 at 100');
  });
});
