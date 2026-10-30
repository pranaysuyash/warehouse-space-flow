import { useState } from 'react';
import { SuiteDock } from './SuiteDock';
import { Warehouse2DPlanner } from './Warehouse2DPlanner';
import { WarehouseIsometricCanvas } from './WarehouseIsometricCanvas';

export function App() {
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

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
          </div>
        </header>

        {/* Dynamic Operational Content */}
        <div hidden={viewMode !== '2d'}><Warehouse2DPlanner /></div>
        {viewMode === '3d' && <><p className="execution-task-note">Independent facility geometry study. This demonstration does not change shipment reservations or establish physical occupancy.</p><WarehouseIsometricCanvas /></>}
      </main>
    </div>
  );
}
