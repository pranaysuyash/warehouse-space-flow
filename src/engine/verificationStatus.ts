/**
 * Verification Status State Machine (P06) — I9
 * Transitions: simulated -> observed -> published
 * An external publisher port is the only path to 'published'.
 */

export type VerificationStatus = 'simulated' | 'observed' | 'published';

const ALLOWED_TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  simulated: ['observed'],
  observed: ['published'],
  published: [],
};

export function canTransition(from: VerificationStatus, to: VerificationStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionStatus(current: VerificationStatus, next: VerificationStatus): VerificationStatus {
  if (!canTransition(current, next)) {
    throw new Error(`Invalid verification status transition: ${current} -> ${next}`);
  }
  return next;
}

export interface VerificationPublisher {
  publish(eventId: string, payload: unknown): Promise<{ success: boolean; publishedAt?: string; error?: string }>;
}

export async function publishIfObserved(
  status: VerificationStatus,
  eventId: string,
  payload: unknown,
  publisher: VerificationPublisher
): Promise<{ status: VerificationStatus; result: { success: boolean; publishedAt?: string; error?: string } | null }> {
  if (status !== 'observed') {
    return { status, result: null };
  }
  const result = await publisher.publish(eventId, payload);
  if (result.success) {
    return { status: 'published', result };
  }
  return { status: 'observed', result };
}
