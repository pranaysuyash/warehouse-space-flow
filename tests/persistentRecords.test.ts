const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; },
};
(globalThis as any).localStorage = localStorageMock;

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadReservations, addReservation, removeReservation,
  loadEvents, appendEvent, clearAll,
} from '../src/engine/persistentRecords';

describe('P06 Persistent Records', () => {
  beforeEach(() => { localStorageMock.clear(); clearAll(); });

  it('starts empty', () => {
    expect(loadReservations()).toEqual([]);
    expect(loadEvents()).toEqual([]);
  });

  it('adds and loads reservations', () => {
    const r = addReservation('SLOT-1', 'PALLET-1');
    expect(r.slotId).toBe('SLOT-1');
    expect(r.revision).toBe(1);
    const loaded = loadReservations();
    expect(loaded.length).toBe(1);
    expect(loaded[0].palletId).toBe('PALLET-1');
  });

  it('increments revision on re-reserve', () => {
    addReservation('SLOT-1', 'PALLET-1');
    const r2 = addReservation('SLOT-1', 'PALLET-2');
    expect(r2.revision).toBe(2);
    expect(loadReservations().length).toBe(1);
    expect(loadReservations()[0].palletId).toBe('PALLET-2');
  });

  it('removes reservation', () => {
    addReservation('SLOT-1', 'PALLET-1');
    removeReservation('SLOT-1');
    expect(loadReservations()).toEqual([]);
  });

  it('appends events with revision', () => {
    const e1 = appendEvent('evt-1', { foo: 'bar' });
    const e2 = appendEvent('evt-2', { baz: 1 });
    expect(e1.revision).toBe(1);
    expect(e2.revision).toBe(2);
    expect(loadEvents().length).toBe(2);
  });

  it('clearAll empties both', () => {
    addReservation('S1', 'P1');
    appendEvent('e1', {});
    clearAll();
    expect(loadReservations()).toEqual([]);
    expect(loadEvents()).toEqual([]);
  });
});
