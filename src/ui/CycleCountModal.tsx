import React, { useState } from 'react';
import { runCycleCount, cycleCountSummary, CycleCountItem } from '../engine/cycleCount';

export interface CycleCountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CycleCountModal: React.FC<CycleCountModalProps> = ({ isOpen, onClose }) => {
  const [slotId, setSlotId] = useState('SLOT-A1');
  const [expectedPallet, setExpectedPallet] = useState('PLT-001');
  const [actualPallet, setActualPallet] = useState('PLT-001');
  const [results, setResults] = useState<CycleCountItem[] | null>(null);

  if (!isOpen) return null;

  const handleRun = () => {
    const items = runCycleCount(
      [{ slotId, occupantId: expectedPallet || null, weightLbs: 100 }],
      [{ slotId, palletId: actualPallet || null, weightLbs: 100 }],
      'operator'
    );
    setResults(items);
  };

  const summary = results ? cycleCountSummary(results) : null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cycle-count-title" style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(2,6,23,0.75)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:600, background:'#0b1329', border:'1px solid #1e293b', borderRadius:12, padding:20, fontFamily:'system-ui,sans-serif', color:'#e2e8f0' }}>
        <h2 id="cycle-count-title" style={{ margin:'0 0 12px' }}>Cycle Count & Physical Inventory</h2>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          <input aria-label="Slot id" value={slotId} onChange={e=>setSlotId(e.target.value)} placeholder="Slot id" style={{ padding:6, background:'#0f172a', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6 }} />
          <input aria-label="Expected pallet" value={expectedPallet} onChange={e=>setExpectedPallet(e.target.value)} placeholder="Expected pallet" style={{ padding:6, background:'#0f172a', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6 }} />
          <input aria-label="Actual pallet" value={actualPallet} onChange={e=>setActualPallet(e.target.value)} placeholder="Actual pallet" style={{ padding:6, background:'#0f172a', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6 }} />
          <button onClick={handleRun} style={{ padding:'6px 12px', background:'#0369a1', color:'#fff', border:'none', borderRadius:6, fontWeight:600 }}>Run Count</button>
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