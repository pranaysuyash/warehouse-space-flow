import React, { useState, useMemo } from 'react';
import {
  optimizeWavePickPath,
  SAMPLE_OUTBOUND_WAVE_ITEMS,
  PickItem,
  TspOptimizationResult,
} from '../engine/wavePickingTsp';

interface WavePickingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WavePickingModal: React.FC<WavePickingModalProps> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<PickItem[]>(SAMPLE_OUTBOUND_WAVE_ITEMS);
  const activeWaveId = 'WAVE-2026-1030';

  const tspResult: TspOptimizationResult = useMemo(() => {
    return optimizeWavePickPath(items, activeWaveId);
  }, [items, activeWaveId]);

  const toggleQuarantine = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, isQuarantined: !it.isQuarantined } : it))
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="camera-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wave-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="camera-modal-content"
        style={{
          maxWidth: 780,
          background: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #334155',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          style={{
            background: '#1e293b',
            borderBottom: '1px solid #334155',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 id="wave-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
              Outbound Wave Picking &amp; TSP Pick-Path Optimizer
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Sample wave {activeWaveId}. The route and lot check are illustrative; no stock is picked or released.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '4px 8px',
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '20px', maxHeight: '74vh', overflowY: 'auto' }}>
          {/* TSP Metrics Comparison Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            <div style={{ background: '#1e293b', padding: 12, borderRadius: 8, border: '1px solid #334155', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Optimized Distance</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>
                {tspResult.optimizedDistanceFt} <span style={{ fontSize: '0.75rem' }}>ft</span>
              </div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Unoptimized: {tspResult.unoptimizedDistanceFt} ft</div>
            </div>

            <div style={{ background: '#1e293b', padding: 12, borderRadius: 8, border: '1px solid #334155', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Transit Distance Saved</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#22c55e' }}>
                -{tspResult.distanceReductionPct}%
              </div>
              <div style={{ fontSize: '0.65rem', color: '#4ade80' }}>Saved: {tspResult.distanceSavedFt} ft</div>
            </div>

            <div style={{ background: '#1e293b', padding: 12, borderRadius: 8, border: '1px solid #334155', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Est. Pick Tour Time</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>
                {tspResult.estimatedPickDurationMinutes} <span style={{ fontSize: '0.75rem' }}>min</span>
              </div>
              <div style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>Walking + Scan Dwell</div>
            </div>

            <div style={{ background: '#1e293b', padding: 12, borderRadius: 8, border: '1px solid #334155', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>FEFO Lot Audit</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: tspResult.fefoAuditPassed ? '#22c55e' : '#ef4444' }}>
                {tspResult.fefoAuditPassed ? 'PASSED' : 'HOLD'}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{tspResult.totalItemsCount} line items</div>
            </div>
          </div>

          {/* Quarantine Warning */}
          {!tspResult.fefoAuditPassed && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                borderLeft: '4px solid #ef4444',
                padding: '10px 14px',
                borderRadius: 6,
                marginBottom: 16,
                color: '#fca5a5',
                fontSize: '0.8rem',
              }}
            >
              {tspResult.fefoWarnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}

          {/* Pick Sequence Table */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#38bdf8' }}>
              TSP-Sequenced Aisle Pick Path (Turn-by-Turn Order):
            </h4>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              Depot Staging (0,0) ➔ Aisle Sequence ➔ Dispatch Dock Door
            </span>
          </div>

          <div style={{ background: '#1e293b', borderRadius: 8, overflow: 'hidden', border: '1px solid #334155', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>Stop #</th>
                  <th style={{ padding: '8px 12px' }}>Rack Location</th>
                  <th style={{ padding: '8px 12px' }}>SKU &amp; Description</th>
                  <th style={{ padding: '8px 12px' }}>Qty / Wt</th>
                  <th style={{ padding: '8px 12px' }}>Lot &amp; Expiry (FEFO)</th>
                  <th style={{ padding: '8px 12px' }}>Quarantine</th>
                </tr>
              </thead>
              <tbody>
                {tspResult.orderedPickSequence.map((it, idx) => (
                  <tr
                    key={it.id}
                    style={{
                      borderBottom: '1px solid #334155',
                      background: it.isQuarantined ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: '#38bdf8' }}>
                      #{idx + 1}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                      <span style={{ background: '#0f172a', padding: '2px 6px', borderRadius: 4, border: '1px solid #475569' }}>
                        {it.locationCode}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <strong style={{ color: '#f8fafc' }}>{it.sku}</strong>
                      <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{it.description}</div>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {it.qty} cases ({it.weightLb} lbs)
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ color: '#f59e0b' }}>{it.lotNumber}</span>
                      <div style={{ color: '#64748b', fontSize: '0.65rem' }}>Exp: {it.expirationDate}</div>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <button
                        type="button"
                        onClick={() => toggleQuarantine(it.id)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: it.isQuarantined ? '#ef4444' : '#334155',
                          color: it.isQuarantined ? '#ffffff' : '#94a3b8',
                        }}
                      >
                        {it.isQuarantined ? 'Quarantined 🚫' : 'Clear ✓'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div
          style={{
            background: '#1e293b',
            borderTop: '1px solid #334155',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              border: 'none',
              background: '#0284c7',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close sample wave
          </button>
        </div>
      </div>
    </div>
  );
};
