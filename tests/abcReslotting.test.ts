import { describe, it, expect } from 'vitest';
import { classifyVelocity, generateReslotQueue } from '../src/engine/abcReslotting';

describe('P06 ABC Re-Slotting', () => {
  it('classifies velocity', () => {
    expect(classifyVelocity(25, 100)).toBe('A');
    expect(classifyVelocity(8, 100)).toBe('B');
    expect(classifyVelocity(2, 100)).toBe('C');
  });
  it('generates moves for A-class in rear slots', () => {
    const items = [{ palletId: 'P1', sku: 'S1', currentSlotId: 'REAR-1', velocityClass: 'A' as const }];
    const moves = generateReslotQueue(items, ['FRONT-1'], ['REAR-1']);
    expect(moves.length).toBe(1);
    expect(moves[0].toSlotId).toBe('FRONT-1');
  });
  it('generates moves for C-class in front slots', () => {
    const items = [{ palletId: 'P2', sku: 'S2', currentSlotId: 'FRONT-1', velocityClass: 'C' as const }];
    const moves = generateReslotQueue(items, ['FRONT-1'], ['REAR-1']);
    expect(moves.length).toBe(1);
    expect(moves[0].toSlotId).toBe('REAR-1');
  });
  it('no moves when already optimal', () => {
    const items = [{ palletId: 'P1', sku: 'S1', currentSlotId: 'FRONT-1', velocityClass: 'A' as const }];
    const moves = generateReslotQueue(items, ['FRONT-1'], ['REAR-1']);
    expect(moves.length).toBe(0);
  });
});
