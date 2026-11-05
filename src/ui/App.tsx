import { useState } from 'react';
import { SuiteDock } from './SuiteDock';
import { Warehouse2DPlanner } from './Warehouse2DPlanner';
import { WarehouseIsometricCanvas } from './WarehouseIsometricCanvas';
import { createCanonicalFacility } from '../engine/spatialModel';
import { WavePickingModal } from './WavePickingModal';
import { CrossDockModal } from './CrossDockModal';
import { CycleCountModal } from './CycleCountModal';
import { AbcReslottingModal } from './AbcReslottingModal';
import { GoodsLedgerModal } from './GoodsLedgerModal';

export function App() {
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [isWaveModalOpen, setIsWaveModalOpen] = useState<boolean>(false);
  const [isCrossDockModalOpen, setIsCrossDockModalOpen] = useState<boolean>(false);
  const [isCycleCountModalOpen, setIsCycleCountModalOpen] = useState<boolean>(false);
  const [isAbcModalOpen, setIsAbcModalOpen] = useState<boolean>(false);
  const [isGoodsLedgerModalOpen, setIsGoodsLedgerModalOpen] = useState<boolean>(false);

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
               3D Axonometric Digital Twin
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
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
              }}
            >
              Cross-Dock Allocation 🔄
            </button>
            <button className="toggle-btn" onClick={() => setIsCycleCountModalOpen(true)} style={{ background:'#7c3aed', color:'#fff', border:'none', fontWeight:600 }}>Cycle Count</button>
            <button className="toggle-btn" onClick={() => setIsAbcModalOpen(true)} style={{ background:'#d97706', color:'#fff', border:'none', fontWeight:600 }}>ABC Re-Slotting</button>
            <button className="toggle-btn" onClick={() => setIsGoodsLedgerModalOpen(true)} style={{ background:'#0f766e', color:'#fff', border:'none', fontWeight:600 }}>Goods Ledger</button>
          </div>
        </header>

        {/* Dynamic Operational Content */}
        <div hidden={viewMode !== '2d'}><Warehouse2DPlanner /></div>
        {viewMode === '3d' && <><p className="execution-task-note">Independent facility geometry study. This demonstration does not change shipment reservations or establish physical occupancy.</p><WarehouseIsometricCanvas facility={createCanonicalFacility()} /></>}
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
      />

      <AbcReslottingModal
        isOpen={isAbcModalOpen}
        onClose={() => setIsAbcModalOpen(false)}
      />

      <GoodsLedgerModal
        isOpen={isGoodsLedgerModalOpen}
        onClose={() => setIsGoodsLedgerModalOpen(false)}
      />
    </div>
  );
}
