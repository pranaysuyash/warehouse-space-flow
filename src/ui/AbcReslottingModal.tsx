import React, { useState } from 'react';
import { classifyVelocity, generateReslotQueue, SlotMove } from '../engine/abcReslotting';

export interface AbcReslottingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AbcReslottingModal: React.FC<AbcReslottingModalProps> = ({ isOpen, onClose }) => {
  const [pickCount, setPickCount] = useState<number>(40);
  const [totalPicks, setTotalPicks] = useState<number>(100);
  const [moves, setMoves] = useState<SlotMove[] | null>(null);

  if (!isOpen) return null;

  const vClass = classifyVelocity(pickCount, totalPicks);

  const handleRun = () => {
    const items = [{ palletId: 'PLT-1', sku: 'SKU-A', currentSlotId: 'REAR-01', velocityClass: vClass }];
    const q = generateReslotQueue(items, ['FRONT-01', 'FRONT-02'], ['REAR-01', 'REAR-02']);
    setMoves(q);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="abc-title" style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(2,6,23,0.75)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:600, background:'#0b1329', border:'1px solid #1e293b', borderRadius:12, padding:20, fontFamily:'system-ui,sans-serif', color:'#e2e8f0' }}>
        <h2 id="abc-title" style={{ margin:'0 0 12px' }}>ABC Velocity Re-Slotting</h2>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          <input aria-label="Pick count" type="number" value={pickCount} onChange={e=>setPickCount(Number(e.target.value)||0)} placeholder="Pick count" style={{ padding:6, background:'#0f172a', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6, width:100 }} />
          <input aria-label="Total picks" type="number" value={totalPicks} onChange={e=>setTotalPicks(Number(e.target.value)||0)} placeholder="Total picks" style={{ padding:6, background:'#0f172a', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6, width:100 }} />
          <span style={{ alignSelf:'center' }}>Class: <strong>{vClass}</strong></span>
          <button onClick={handleRun} style={{ padding:'6px 12px', background:'#0369a1', color:'#fff', border:'none', borderRadius:6, fontWeight:600 }}>Generate Queue</button>
        </div>
        {moves && (
          <div>
            {moves.length === 0 ? <p>No moves required.</p> : (
              <ul style={{ margin:0, paddingLeft:18, fontSize:13 }}>
                {moves.map((m, i) => <li key={i}>{m.palletId} ({m.sku}): {m.fromSlotId} → {m.toSlotId} — {m.reason}</li>)}
              </ul>
            )}
          </div>
        )}
        <div style={{ marginTop:12, textAlign:'right' }}>
          <button onClick={onClose} style={{ padding:'6px 12px', background:'#334155', color:'#e2e8f0', border:'none', borderRadius:6 }}>Close</button>
        </div>
      </div>
    </div>
  );
};