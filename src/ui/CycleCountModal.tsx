import React, { useEffect, useState } from 'react';
import { runCycleCount, cycleCountSummary, CycleCountItem, resolveManualCountObservation } from '../engine/cycleCount';
import { getAllSlots } from '../engine/spatialModel';
import type { Facility } from '../engine/types';

export interface CycleCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional workspace facility snapshot — seeds slot/occupant choices from real state. */
  facility?: Facility | null;
}

export const CycleCountModal: React.FC<CycleCountModalProps> = ({ isOpen, onClose, facility }) => {
  const [slotId, setSlotId] = useState('SLOT-A1');
  const [expectedPallet, setExpectedPallet] = useState('PLT-001');
  const [actualPallet, setActualPallet] = useState('');
  const [explicitlyEmpty, setExplicitlyEmpty] = useState(false);
  const [results, setResults] = useState<CycleCountItem[] | null>(null);

  const slots = facility ? getAllSlots(facility) : [];
  useEffect(() => {
    if (!isOpen || !facility) return;
    const first = slots.find(s => s.currentOccupantId || s.reservedPalletId || s.status !== 'available') ?? slots[0];
    if (first) {
      setSlotId(first.code ?? first.id);
      const expected = first.currentOccupantId ?? first.reservedPalletId ?? '';
      setExpectedPallet(expected);
      setActualPallet('');
      setExplicitlyEmpty(false);
      setResults(null);
    }
  }, [isOpen, facility]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleRun = () => {
    const observation = resolveManualCountObservation(actualPallet, explicitlyEmpty);
    if (!observation || !slotId.trim()) return;
    const slot = facility ? slots.find(s => s.code === slotId || s.id === slotId) : null;
    const weight = slot?.currentWeightLbs ?? slot?.reservedWeightLbs ?? 100;
    const items = runCycleCount(
      [{ slotId: slot?.code ?? slotId, occupantId: expectedPallet || null, weightLbs: weight }],
      [{ slotId: slot?.code ?? slotId, palletId: observation.palletId, weightLbs: null }],
      'operator'
    );
    setResults(items);
  };

  const summary = results ? cycleCountSummary(results) : null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cycle-count-title" style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(2,6,23,0.75)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:600, background:'#0b1329', border:'1px solid #1e293b', borderRadius:12, padding:20, fontFamily:'system-ui,sans-serif', color:'#e2e8f0' }}>
        <h2 id="cycle-count-title" style={{ margin:'0 0 12px' }}>Cycle Count & Physical Inventory</h2>
        <p style={{ margin:'0 0 12px', fontSize:12, color:'#94a3b8' }}>
          {facility ? `Using workspace snapshot: ${facility.name} (${slots.length} slots).` : 'Manual count entry (no workspace loaded).'} Enter the actual occupant or explicitly mark the slot empty. Manual entry does not prove a physical scan.
        </p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          {facility && slots.length > 0 ? (
            <select aria-label="Slot" value={slotId} onChange={e => { const v=e.target.value; setSlotId(v); const s=slots.find(x=>x.code===v||x.id===v); const exp=s?.currentOccupantId ?? s?.reservedPalletId ?? ''; setExpectedPallet(exp); setActualPallet(''); setExplicitlyEmpty(false); setResults(null); }} style={{ padding:6, background:'#0f172a', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6, maxWidth:220 }}>
              {slots.map(s => <option key={s.id} value={s.code ?? s.id}>{s.code ?? s.id} · {s.status}{s.currentOccupantId ? ` · ${s.currentOccupantId}` : s.reservedPalletId ? ` · res ${s.reservedPalletId}` : ''}</option>)}
            </select>
          ) : (
            <input aria-label="Slot id" value={slotId} onChange={e=>{setSlotId(e.target.value); setResults(null);}} placeholder="Slot id" style={{ padding:6, background:'#0f172a', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6 }} />
          )}
          <input aria-label="Expected pallet" value={expectedPallet} onChange={e=>{setExpectedPallet(e.target.value); setResults(null);}} placeholder="Expected pallet" style={{ padding:6, background:'#0f172a', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6 }} />
          <input aria-label="Actual pallet" value={actualPallet} disabled={explicitlyEmpty} onChange={e=>{setActualPallet(e.target.value); setResults(null);}} placeholder="Actual pallet (manual entry)" style={{ padding:6, background:'#0f172a', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6 }} />
          <label><input type="checkbox" checked={explicitlyEmpty} onChange={e=>{setExplicitlyEmpty(e.target.checked); setActualPallet(''); setResults(null);}} /> Slot is empty</label>
          <button disabled={!slotId.trim() || !resolveManualCountObservation(actualPallet, explicitlyEmpty)} onClick={handleRun} style={{ padding:'6px 12px', background:'#0369a1', color:'#fff', border:'none', borderRadius:6, fontWeight:600 }}>Run Count</button>
        </div>
        {summary && (
          <div>
            <p>Total {summary.total} · Match {summary.match} · Mismatch {summary.mismatch} · Missing {summary.missing} · Unexpected {summary.unexpected} · Accuracy {summary.accuracyPercent}%</p>
            <ul style={{ margin:0, paddingLeft:18, fontSize:13 }}>
              {results!.map(r => <li key={r.slotId}>{r.slotId}: {r.status} (expected {r.expectedPalletId ?? '—'}, actual {r.actualPalletId ?? '—'})</li>)}
            </ul>
          </div>
        )}
        <div style={{ marginTop:12, textAlign:'right' }}>
          <button onClick={onClose} style={{ padding:'6px 12px', background:'#334155', color:'#e2e8f0', border:'none', borderRadius:6 }}>Close</button>
        </div>
      </div>
    </div>
  );
};
