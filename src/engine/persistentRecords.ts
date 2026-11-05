/**
 * Persistent Operational Records (P06) — A8
 * Reservations and events persisted to localStorage with revision handling.
 * Replaces React-state-only storage. Server-authoritative reconciliation
 * remains a future infra task (F2/F3).
 */

const RESERVATIONS_KEY = 'p06-reservations-v1';
const EVENTS_KEY = 'p06-epcis-events-v1';

export interface PersistedReservation {
  slotId: string;
  palletId: string;
  revision: number;
  reservedAt: string;
}

export interface PersistedEvent {
  eventId: string;
  revision: number;
  payload: unknown;
  recordedAt: string;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function loadReservations(): PersistedReservation[] {
  if (typeof localStorage === 'undefined') return [];
  return safeParse<PersistedReservation[]>(localStorage.getItem(RESERVATIONS_KEY), []);
}

export function saveReservations(list: PersistedReservation[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(list));
}

export function addReservation(slotId: string, palletId: string): PersistedReservation {
  const list = loadReservations();
  const existing = list.find(r => r.slotId === slotId);
  const revision = existing ? existing.revision + 1 : 1;
  const rec: PersistedReservation = { slotId, palletId, revision, reservedAt: new Date().toISOString() };
  const filtered = list.filter(r => r.slotId !== slotId);
  filtered.push(rec);
  saveReservations(filtered);
  return rec;
}

export function removeReservation(slotId: string): void {
  const list = loadReservations().filter(r => r.slotId !== slotId);
  saveReservations(list);
}

export function loadEvents(): PersistedEvent[] {
  if (typeof localStorage === 'undefined') return [];
  return safeParse<PersistedEvent[]>(localStorage.getItem(EVENTS_KEY), []);
}

export function saveEvents(list: PersistedEvent[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(EVENTS_KEY, JSON.stringify(list));
}

export function appendEvent(eventId: string, payload: unknown): PersistedEvent {
  const list = loadEvents();
  const rec: PersistedEvent = { eventId, revision: list.length + 1, payload, recordedAt: new Date().toISOString() };
  list.push(rec);
  saveEvents(list);
  return rec;
}

export function clearAll(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(RESERVATIONS_KEY);
  localStorage.removeItem(EVENTS_KEY);
}
