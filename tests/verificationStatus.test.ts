import { describe, it, expect } from 'vitest';
import { canTransition, transitionStatus, publishIfObserved } from '../src/engine/verificationStatus';

describe('P06 Verification Status State Machine', () => {
  it('allows simulated -> observed', () => {
    expect(canTransition('simulated', 'observed')).toBe(true);
  });

  it('allows observed -> published', () => {
    expect(canTransition('observed', 'published')).toBe(true);
  });

  it('rejects published -> anything', () => {
    expect(canTransition('published', 'simulated')).toBe(false);
    expect(canTransition('published', 'observed')).toBe(false);
  });

  it('rejects skipping observed', () => {
    expect(canTransition('simulated', 'published')).toBe(false);
  });

  it('transitionStatus throws on invalid', () => {
    expect(() => transitionStatus('simulated', 'published')).toThrow();
  });

  it('transitionStatus returns next on valid', () => {
    expect(transitionStatus('simulated', 'observed')).toBe('observed');
  });

  it('publishIfObserved publishes when observed', async () => {
    const publisher = { publish: async () => ({ success: true, publishedAt: '2026-01-01' }) };
    const r = await publishIfObserved('observed', 'evt-1', {}, publisher);
    expect(r.status).toBe('published');
    expect(r.result?.success).toBe(true);
  });

  it('publishIfObserved no-op when not observed', async () => {
    const publisher = { publish: async () => ({ success: true }) };
    const r = await publishIfObserved('simulated', 'evt-1', {}, publisher);
    expect(r.status).toBe('simulated');
    expect(r.result).toBeNull();
  });

  it('publishIfObserved stays observed on failure', async () => {
    const publisher = { publish: async () => ({ success: false, error: 'network' }) };
    const r = await publishIfObserved('observed', 'evt-1', {}, publisher);
    expect(r.status).toBe('observed');
  });
});
