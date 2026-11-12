import React, { useState } from 'react';
import { IconRotateCw, IconX } from './icons';
import {
  matchCrossDockPallets,
  CrossDockMatchRecord,
  type InboundReceiptPallet,
  type OutboundDepartureOrder,
} from '../engine/crossDockMatching';

export interface CrossDockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmMatches?: (matches: CrossDockMatchRecord[]) => void;
  inboundPallets?: InboundReceiptPallet[];
  outboundOrders?: OutboundDepartureOrder[];
}

export const CrossDockModal: React.FC<CrossDockModalProps> = ({
  isOpen,
  onClose,
  onConfirmMatches,
  inboundPallets,
  outboundOrders,
}) => {
  const [maxDepartureHours, setMaxDepartureHours] = useState<number>(4.0);

  if (!isOpen) return null;

  const summary = matchCrossDockPallets(inboundPallets ?? [], outboundOrders ?? [], maxDepartureHours);

  const handleConfirm = () => {
    if (onConfirmMatches) {
      onConfirmMatches(summary.matches);
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cross-dock-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(2, 6, 23, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '750px',
          backgroundColor: '#0b1329',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#f8fafc',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, #0b1329 0%, #111e38 100%)',
          }}
        >
          <div>
            <h3
              id="cross-dock-title"
              style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <IconRotateCw size={16} />
              Inbound-to-Outbound Cross-Dock Direct Allocation
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#94a3b8' }}>
              Scenario matching only. No stock movement or operational dispatch occurs here.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(!inboundPallets?.length || !outboundOrders?.length) && <p>No inbound pallets or outbound orders supplied. Matching is unavailable.</p>}
          {/* Summary KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '10px',
              background: '#0f172a',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid #1e293b',
            }}
          >
            <div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>CROSS-DOCK RATIO:</span>
              <div style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'monospace', color: '#10b981' }}>
                {summary.crossDockRatioPct}%
              </div>
              <span style={{ fontSize: '10px', color: '#64748b' }}>
                {summary.crossDockEligibleCount} / {summary.totalInboundPallets} Pallets
              </span>
            </div>

            <div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>LABOR SAVINGS:</span>
              <div style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'monospace', color: '#38bdf8' }}>
                ${summary.totalLaborSavingsDollars.toFixed(2)}
              </div>
              <span style={{ fontSize: '10px', color: '#64748b' }}>$24.00 / Pallet</span>
            </div>

            <div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>PUTAWAY REQUIRED:</span>
              <div style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'monospace', color: '#f59e0b' }}>
                {summary.putawayRequiredCount} Pallets
              </div>
              <span style={{ fontSize: '10px', color: '#64748b' }}>Storage racks</span>
            </div>

            <div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>AVG DWELL TIME:</span>
              <div style={{ fontSize: '18px', fontWeight: 900, fontFamily: 'monospace', color: '#f8fafc' }}>
                {summary.averageDwellMinutes} min
              </div>
              <span style={{ fontSize: '10px', color: '#64748b' }}>Gate to departure</span>
            </div>
          </div>

          {/* Departure Window Slider */}
          <div
            style={{
              background: '#090d1c',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc' }}>
                Maximum Outbound Departure Window:
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>
                Matches inbound receipts with orders departing within this window.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="range"
                min="1.0"
                max="8.0"
                step="0.5"
                value={maxDepartureHours}
                onChange={(e) => setMaxDepartureHours(parseFloat(e.target.value) || 4.0)}
                style={{ width: '120px' }}
              />
              <strong style={{ fontSize: '13px', fontFamily: 'monospace', color: '#38bdf8', width: '50px' }}>
                {maxDepartureHours.toFixed(1)} hrs
              </strong>
            </div>
          </div>

          {/* Matched Cross-Dock Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              DIRECT CROSS-DOCK TRANSFER DIRECTIVES:
            </span>

            {summary.matches.map((m) => (
              <div
                key={m.matchId}
                style={{
                  background: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontWeight: 800,
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        color: '#10b981',
                        fontFamily: 'monospace',
                      }}
                    >
                      {m.inboundDoor} -&gt; {m.outboundDoor}
                    </span>
                    <strong style={{ fontSize: '13px', color: '#f8fafc' }}>{m.inboundPalletId}</strong>
                    <span style={{ fontSize: '11px', color: '#38bdf8' }}>({m.sku})</span>
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '11px', color: '#cbd5e1' }}>
                    Staging Buffer: <strong>{m.transferBufferLane}</strong> · Units: <strong>{m.matchedQuantityUnits} cases</strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                    +${m.laborSavingsDollars.toFixed(2)} Saved
                  </div>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>
                    Dwell: {m.transitDwellMinutes} min
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            background: '#090d1c',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1e293b',
              border: 'none',
              borderRadius: '6px',
              color: '#94a3b8',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            disabled={!onConfirmMatches || summary.matches.length === 0}
            onClick={handleConfirm}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0284c7',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Review matches ({summary.crossDockEligibleCount} Pallets)
          </button>
        </div>
      </div>
    </div>
  );
};
