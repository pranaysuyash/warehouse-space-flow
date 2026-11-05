import React, { useEffect, useState } from 'react';
import { GoodsLedger } from '../engine/goodsLedger';
import type { InboundManifest } from '../engine/types';

export interface GoodsLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifest?: InboundManifest | null;
}

export const GoodsLedgerModal: React.FC<GoodsLedgerModalProps> = ({ isOpen, onClose, manifest }) => {
  const [ledger] = useState(() => new GoodsLedger());
  const [customerId, setCustomerId] = useState('CUST-001');
  const [sku, setSku] = useState('SKU-001');
  const [quantity, setQuantity] = useState<number>(10);
  const [unit, setUnit] = useState('cases');
  const [log, setLog] = useState<string[]>([]);
  const [onHand, setOnHand] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !manifest?.items?.[0]) return;
    const item = manifest.items[0] as typeof manifest.items[number] & { cases?: number; quantity?: number; unit?: string; customerId?: string };
    setSku(item.sku);
    setCustomerId(item.customerId ?? 'CUST-001');
    setUnit(item.unit ?? 'cases');
    setQuantity(item.cases ?? item.quantity ?? 10);
  }, [isOpen, manifest]);

  if (!isOpen) return null;

  const handleReceipt = () => {
    try {
      ledger.recordReceipt({ receiptId: `R-${Date.now()}`, customerId, sku, description: sku, quantity, unit, condition: 'good', weightLbs: 0, receivedAt: new Date().toISOString(), slotId: 'SLOT-A1' });
      setLog(prev => [`Receipt +${quantity} ${unit} of ${sku} for ${customerId}`, ...prev]);
      setOnHand(ledger.onHand(customerId, sku));
    } catch (e) {
      setLog(prev => [`Error: ${(e as Error).message}`, ...prev]);
    }
  };

  const handleDispatch = () => {
    try {
      ledger.recordDispatch({ dispatchId: `D-${Date.now()}`, customerId, sku, quantity, unit, dispatchedAt: new Date().toISOString(), slotId: 'SLOT-A1' });
      setLog(prev => [`Dispatch -${quantity} ${unit} of ${sku} for ${customerId}`, ...prev]);
      setOnHand(ledger.onHand(customerId, sku));
    } catch (e) {
      setLog(prev => [`Error: ${(e as Error).message}`, ...prev]);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="goods-ledger-title" style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(2,6,23,0.75)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:640, background:'#0b1329', border:'1px solid #1e293b', borderRadius:12, padding:20, fontFamily:'system-ui,sans-serif', color:'#e2e8f0' }}>
        <h2 id="goods-ledger-title" style={{ margin:'0 0 12px' }}>Goods Ledger (Customer Stock)</h2>
        <p style={{ margin:'0 0 12px', fontSize:12, color:'#94a3b8' }}>
          {manifest ? `Prefilled from workspace manifest (${manifest.items.length} items). Entries are local to this modal session and are not saved to workspace/server state.` : 'Manual/local ledger entries. Not saved to workspace/server state.'}
        </p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          <input aria-label="Customer id" value={customerId} onChange={e=>setCustomerId(e.target.value)} placeholder="Customer id" style={{ padding:6, background:'#0f172a', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6 }} />
          <input aria-label="SKU" value={sku} onChange={e=>setSku(e.target.value)} placeholder="SKU" style={{ padding:6, background:'#0f172a', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6 }} />
          <input aria-label="Quantity" type="number" value={quantity} onChange={e=>setQuantity(Number(e.target.value)||0)} placeholder="Qty" style={{ padding:6, background:'#0f172a', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6, width:80 }} />
          <input aria-label="Unit" value={unit} onChange={e=>setUnit(e.target.value)} placeholder="Unit" style={{ padding:6, background:'#0f172a', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6, width:80 }} />
          <button onClick={handleReceipt} style={{ padding:'6px 12px', background:'#059669', color:'#fff', border:'none', borderRadius:6, fontWeight:600 }}>Receipt</button>
          <button onClick={handleDispatch} style={{ padding:'6px 12px', background:'#dc2626', color:'#fff', border:'none', borderRadius:6, fontWeight:600 }}>Dispatch</button>
        </div>
        {onHand !== null && <p>On hand ({customerId}/{sku}): <strong>{onHand}</strong></p>}
        <ul style={{ margin:0, paddingLeft:18, fontSize:13, maxHeight:160, overflow:'auto' }}>
          {log.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
        <div style={{ marginTop:12, textAlign:'right' }}>
          <button onClick={onClose} style={{ padding:'6px 12px', background:'#334155', color:'#e2e8f0', border:'none', borderRadius:6 }}>Close</button>
        </div>
      </div>
    </div>
  );
};