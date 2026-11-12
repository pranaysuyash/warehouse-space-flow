import { useState } from 'react';
import { SuiteDock } from './SuiteDock';
import { IconRotateCw } from './icons';
import { Warehouse2DPlanner } from './Warehouse2DPlanner';
import { WarehouseIsometricCanvas } from './WarehouseIsometricCanvas';
import { useShipmentSession } from '../suite/ShipmentSession';
import { facilityForShipment } from '../engine/shipmentAdapter';
import { WavePickingModal } from './WavePickingModal';
import { CrossDockModal } from './CrossDockModal';
import { CycleCountModal } from './CycleCountModal';
import { AbcReslottingModal } from './AbcReslottingModal';
import { GoodsLedgerModal } from './GoodsLedgerModal';
import type { Facility, InboundManifest } from '../engine/types';

export function App() {
  const session = useShipmentSession();
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [isWaveModalOpen, setIsWaveModalOpen] = useState<boolean>(false);
  const [isCrossDockModalOpen, setIsCrossDockModalOpen] = useState<boolean>(false);
  const [isCycleCountModalOpen, setIsCycleCountModalOpen] = useState<boolean>(false);
  const [isAbcModalOpen, setIsAbcModalOpen] = useState<boolean>(false);
  const [isGoodsLedgerModalOpen, setIsGoodsLedgerModalOpen] = useState<boolean>(false);
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<{ facility: Facility | null; manifest: InboundManifest | null } | null>(null);

  const sessionFacility = session?.selectedId && session.shipment
    ? facilityForShipment(session.shipment, session.resources)
    : null;
  const modalFacility = workspaceSnapshot?.facility ?? sessionFacility;
  const modalManifest = workspaceSnapshot?.manifest ?? null;

  return (
    <div className="subproduct-root warehouse-app-container">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <SuiteDock currentProductId="product-06-warehouse-space-flow" />

      {/* Main Header */}
      <main id="main-content" className="warehouse-main-content" tabIndex={-1}>
        <header className="warehouse-header">
          <div className="brand-group">
            <span className="brand-icon"></span>
            <div>
              <div className="badge-row">
                <span className="product-badge">PRODUCT 06</span>
                <span className="port-badge">PORT 5178</span>
                <span className="bridge-badge">CARGO FIT COMPATIBLE</span>
              </div>
              <h1 className="header-title">Warehouse Space & Flow Planner</h1>
              <p className="header-subtitle">
                Constraint-aware inbound space planning, dual-role moveable container tracking & GS1 EPCIS scan verification
              </p>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="view-mode-toggle">
            <button
              className={`toggle-btn ${viewMode === '2d' ? 'active' : ''}`}
              onClick={() => setViewMode('2d')}
            >
              ️ 2D Inbound Space & Flow HUD
            </button>
            <button
              className={`toggle-btn ${viewMode === '3d' ? 'active' : ''}`}
              onClick={() => setViewMode('3d')}
            >
               3D Warehouse View
            </button>
            <button
              className="toggle-btn"
              onClick={() => setIsWaveModalOpen(true)}
              style={{
                background: '#0369a1',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
              }}
            >
              Wave Picking TSP
            </button>
            <button
              className="toggle-btn"
              onClick={() => setIsCrossDockModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
              }}
            >
              <IconRotateCw size={13} />
              Cross-Dock Allocation
            </button>
            <button className="toggle-btn" onClick={() => setIsCycleCountModalOpen(true)} style={{ background:'#0e7490', color:'#fff', border:'none', fontWeight:600 }}>Cycle Count</button>
            <button className="toggle-btn" onClick={() => setIsAbcModalOpen(true)} style={{ background:'#d97706', color:'#fff', border:'none', fontWeight:600 }}>ABC Re-Slotting</button>
            <button className="toggle-btn" onClick={() => setIsGoodsLedgerModalOpen(true)} style={{ background:'#0f766e', color:'#fff', border:'none', fontWeight:600 }}>Goods Ledger</button>
          </div>
        </header>

        {/* Dynamic Operational Content */}
        <div hidden={viewMode !== '2d'}><Warehouse2DPlanner onWorkspaceChange={(snapshot) => setWorkspaceSnapshot(snapshot)} /></div>
        {viewMode === '3d' && (
          modalFacility ? (
            <><p className="execution-task-note">The 3D view uses the current facility's workspace locations and status. Positions follow its 2D layout; heights are schematic.</p><WarehouseIsometricCanvas facility={modalFacility} /></>
          ) : (
            <div className="execution-task-note" style={{ padding: 24 }}>
              <h3 style={{ marginTop: 0 }}>3D Warehouse View</h3>
              <p>Open a facility in the 2D planner or connect a shipment to view its warehouse locations.</p>
            </div>
          )
        )}
      </main>

      <WavePickingModal
        isOpen={isWaveModalOpen}
        onClose={() => setIsWaveModalOpen(false)}
      />

      <CrossDockModal
        isOpen={isCrossDockModalOpen}
        onClose={() => setIsCrossDockModalOpen(false)}
      />

      <CycleCountModal
        isOpen={isCycleCountModalOpen}
        onClose={() => setIsCycleCountModalOpen(false)}
        facility={modalFacility}
      />

      <AbcReslottingModal
        isOpen={isAbcModalOpen}
        onClose={() => setIsAbcModalOpen(false)}
        facility={modalFacility}
        manifest={modalManifest}
      />

      <GoodsLedgerModal
        isOpen={isGoodsLedgerModalOpen}
        onClose={() => setIsGoodsLedgerModalOpen(false)}
        manifest={modalManifest}
        scenarioReceipt={session?.shipment?.delivery}
      />
    </div>
  );
}
