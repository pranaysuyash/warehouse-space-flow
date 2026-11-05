import React, { useState, useMemo } from 'react';
import {
  Facility,
  InboundManifest,
  LocationSlot,
  PutawaySolveSummary,
  PutawayRecommendation,
  EpcisEvent,
  DiscrepancyReport,
  MoveableEntity,
} from '../engine/types';
import {
  createCanonicalFacility,
  createSeedMoveableEntities,
  computeFacilityMetrics,
  findSlotById,
  findZoneBySlotId,
} from '../engine/spatialModel';
import { createCanonical40PalletManifest } from '../engine/inboundManifest';
import { solvePutawayManifest } from '../engine/putawayEngine';
import { executeScanVerification } from '../engine/verificationEngine';
import { useShipmentSession } from '../suite/ShipmentSession';
import { useShipmentDraft } from '../suite/useShipmentDraft';
import { facilityForShipment, inboundForShipment, planningFacility, resultForReceivingPlan } from '../engine/shipmentAdapter';
import type { Shipment } from '../suite/types';
import { ReceivingTask } from './ReceivingTask';
import {
  CargoFitVehicleLoad,
  translateCargoFitLoadToInboundManifest,
} from '../engine/cargoFitBridge';

export const Warehouse2DPlanner: React.FC = () => {
  const session = useShipmentSession();
  const [facility, setFacility] = useState<Facility>(() => createCanonicalFacility());
  const [manifest, setManifest] = useState<InboundManifest>(() => createCanonical40PalletManifest());
  const [entities] = useState<MoveableEntity[]>(() => createSeedMoveableEntities());
  const [solverResult, setSolverResult] = useState<PutawaySolveSummary | null>(() =>
    solvePutawayManifest(createCanonicalFacility(), createCanonical40PalletManifest())
  );

  const [selectedPalletId, setSelectedPalletId] = useState<string | null>('PLT-INB-01');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'proposed' | 'alternative' | 'conflict'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [rightPanelTab, setRightPanelTab] = useState<'queue' | 'epcis' | 'yard'>('queue');
  const [hoveredSlot, setHoveredSlot] = useState<LocationSlot | null>(null);

  // EPCIS audit stream
  const [epcisEvents, setEpcisEvents] = useState<EpcisEvent[]>(session?.selectedId ? [] : [
    {
      eventId: 'urn:uuid:evt-seed-receiving-01',
      eventType: 'ObjectEvent',
      eventTime: new Date(Date.now() - 3600000).toISOString(),
      action: 'OBSERVE',
      bizStep: 'urn:epcglobal:cbv:bizstep:receiving',
      disposition: 'urn:epcglobal:cbv:disp:in_progress',
      epcList: ['urn:epc:id:sscc:0614141.000109283740000001'],
      readPoint: 'urn:epc:id:sgln:0614141.00001.DOCK-02',
      bizLocation: 'urn:epc:id:sgln:0614141.00001.ZD-REC',
      verificationEvidence: {
        scanType: 'BARCODE_2D_DATAMATRIX',
        operatorId: 'OPR-RECEIVING-D02',
        verifiedTimestamp: new Date(Date.now() - 3600000).toISOString(),
        notes: 'Inbound trailer DO-CHI-884910 docked and seal intact.',
      },
      verificationStatus: 'simulated',
    },
  ]);

  const [discrepancies, setDiscrepancies] = useState<DiscrepancyReport[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'warn'; message: string } | null>(null);
  function importShared(shipment: Shipment) {
    const incoming = inboundForShipment(shipment);
    const nextFacility = facilityForShipment(shipment, session?.resources ?? null);
    const saved = shipment.results.warehouse;
    const records = saved?.inputRevision === shipment.inputRevision ? saved.details.recommendations as PutawaySolveSummary['recommendations'] | undefined : undefined;
    return { facility: nextFacility, manifest: incoming, solverResult: records ? { totalExpected: incoming.items.length, proposedCount: records.filter(item => item.status === 'proposed').length, alternativeCount: records.filter(item => item.status === 'alternative').length, conflictCount: records.filter(item => item.status === 'conflict').length, recommendations: records, computedAt: saved!.recordedAt } : solvePutawayManifest(planningFacility(nextFacility, shipment, session?.resources ?? null), incoming) };
  }
  const draft = useShipmentDraft<{ facility: Facility; manifest: InboundManifest; solverResult: PutawaySolveSummary | null }>({
    value: { facility, manifest, solverResult }, importValue: importShared,
    applyValue: value => { setFacility(value.facility); setManifest(value.manifest); setSolverResult(value.solverResult); setSelectedPalletId(value.manifest.items[0]?.palletId ?? null); setSelectedSlotId(null); setEpcisEvents([]); setDiscrepancies([]); },
  });
  const publication = useMemo(() => {
    if (!session?.shipment || !solverResult) return { result: null, error: '' };
    try { return { result: resultForReceivingPlan(session.shipment, facility, manifest, solverResult, session.resources), error: '' }; }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : 'Receiving plan could not be reviewed.' }; }
  }, [session?.shipment, session?.resources, facility, manifest, solverResult]);

  // Saved reservations/receipt are a projection; editable capacity remains native.
  const displayedFacility = useMemo(() => {
    const shipment = session?.shipment;
    if (session?.selectedId && shipment && shipment.results.warehouse?.inputRevision === shipment.inputRevision && !draft.dirty && !draft.incoming) return facilityForShipment(shipment, session.resources);
    return facility;
  }, [session?.shipment, session?.resources, session?.selectedId, draft.dirty, draft.incoming, facility]);
  // Facility Metrics
  const metrics = useMemo(() => computeFacilityMetrics(displayedFacility), [displayedFacility]);

  // Filtered Recommendations
  const filteredRecommendations = useMemo(() => {
    if (!solverResult) return [];
    return solverResult.recommendations.filter((rec) => {
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          rec.palletId.toLowerCase().includes(q) ||
          rec.sku.toLowerCase().includes(q) ||
          rec.description.toLowerCase().includes(q) ||
          rec.targetLocationCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [solverResult, statusFilter, searchQuery]);

  // Selected item and slot
  const selectedRecommendation = useMemo(() => {
    if (!solverResult || !selectedPalletId) return null;
    return solverResult.recommendations.find((r) => r.palletId === selectedPalletId) || null;
  }, [solverResult, selectedPalletId]);

  const activeSlot = useMemo(() => {
    if (selectedSlotId) return findSlotById(displayedFacility, selectedSlotId);
    if (selectedRecommendation?.targetSlotId) {
      return findSlotById(displayedFacility, selectedRecommendation.targetSlotId);
    }
    return null;
  }, [displayedFacility, selectedSlotId, selectedRecommendation]);

  // Run Solver Action
  const handleRunSolver = () => {
    const nextFacility = session?.shipment && session.selectedId ? planningFacility(facility, session.shipment, session.resources) : facility;
    const res = solvePutawayManifest(nextFacility, manifest);
    setFacility(nextFacility);
    setSolverResult(res);
    setNotification({
      type: 'success',
      message: `Putaway Engine Solved: ${res.proposedCount} Proposed · ${res.alternativeCount} Alternative · ${res.conflictCount} Conflicts.`,
    });
  };

  // Commit Reservations
  const handleCommitReservations = () => {
    if (!solverResult) return;
    const newFacility = JSON.parse(JSON.stringify(facility)) as Facility;
    let committed = 0;

    solverResult.recommendations.forEach((rec) => {
      if (rec.targetSlotId && (rec.status === 'proposed' || rec.status === 'alternative')) {
        const slot = findSlotById(newFacility, rec.targetSlotId);
        if (slot && slot.status === 'available') {
          slot.status = 'reserved_inbound';
          slot.reservedPalletId = rec.palletId;
          slot.reservedWeightLbs = rec.weightLbs;
          committed++;
        }
      }
    });

    setFacility(newFacility);
    setNotification({
      type: 'success',
      message: `Locked in ${committed} inbound slot reservations. Bins are held on putaway work orders.`,
    });
  };

  // Scan & Putaway Verification
  const handleVerifyPutaway = (rec: PutawayRecommendation, simulateError = false) => {
    const targetCode = simulateError ? 'WRONG-SLOT-99' : rec.targetLocationCode;
    const newFacility = JSON.parse(JSON.stringify(facility)) as Facility;

    const result = executeScanVerification(newFacility, rec, targetCode, 'OPR-FORKLIFT-01');

    if (result.success && result.slotUpdated && result.eventGenerated) {
      setFacility(newFacility);
      setEpcisEvents((prev) => [result.eventGenerated!, ...prev]);
      setNotification({ type: 'success', message: result.message });
    } else {
      if (result.discrepancyReport) {
        setDiscrepancies((prev) => [result.discrepancyReport!, ...prev]);
      }
      setNotification({ type: 'warn', message: result.message });
    }
  };

  // Import Load from P01 Cargo Fit Bridge
  const handleImportCargoFit = () => {
    const mockCargoFitLoad: CargoFitVehicleLoad = {
      loadId: 'CF-LOAD-ORD-992',
      vehicleType: '53ft Semi-Trailer (Dry Van)',
      carrier: 'J.B. Hunt Dedicated',
      trailerNumber: 'JB-53-8821',
      destinationFacilityId: 'FACILITY-DC-04',
      totalWeightLbs: 38200,
      packedItems: [
        {
          itemId: 'BEARING-SKID-01',
          description: 'High-Precision Tapered Roller Bearings',
          lengthIn: 48,
          widthIn: 40,
          heightIn: 52,
          weightLbs: 1950,
          temperatureClass: 'ambient',
        },
        {
          itemId: 'PHARMA-VACCINE-02',
          description: 'Temperature-Sensitive Biological Totes',
          lengthIn: 48,
          widthIn: 40,
          heightIn: 56,
          weightLbs: 1250,
          temperatureClass: 'chilled',
        },
        {
          itemId: 'CHEMICAL-SOLVENT-03',
          description: '4x 55-Gal Steel Drums (Class 3 Solvent)',
          lengthIn: 48,
          widthIn: 48,
          heightIn: 55,
          weightLbs: 2350,
          isHazmat: true,
        },
        {
          itemId: 'HYDRAULIC-VALVE-04',
          description: 'Solid Bronze Hydraulic Valve Castings',
          lengthIn: 52,
          widthIn: 46,
          heightIn: 48,
          weightLbs: 3300,
          groundOnly: true,
        },
      ],
    };

    const newManifest = translateCargoFitLoadToInboundManifest(mockCargoFitLoad, 'DOCK-03', 'STG-C');
    setManifest(newManifest);
    const newSolution = solvePutawayManifest(facility, newManifest);
    setSolverResult(newSolution);
    setSelectedPalletId(newManifest.items[0]?.palletId || null);
    setNotification({
      type: 'success',
      message: ' Loaded four built-in demonstration items. Use the connected shipment workspace for real cross-product record intake.',
    });
  };

  return (
    <div className="planner-container">
      {session?.selectedId && <section className="execution-task" aria-labelledby="receiving-plan-title">
        <div className="execution-task-heading"><div><span className="execution-eyebrow">DESTINATION RECEIVING · DECLARED LOCAL FACILITY</span><h2 id="receiving-plan-title">Review receiving space</h2></div><button onClick={() => session.inspect('stage:warehouse')}>Inspect saved receiving plan</button></div>
        <p>{session.shipment?.reference ?? 'Loading selected shipment'} · {manifest.items.length} identified handling units · {facility.name}</p>
        <p className="execution-task-note">The native solver uses the declared facility, exact shipment manifest and current shared reservations. Unknown occupied rack mass consumes its full position rating. This is capacity planning for a local scenario.</p>
        {draft.incoming && <p role="status">Shared planning changed. Your reviewed plan is retained. <button onClick={draft.loadCurrent}>Load current shipment</button></p>}
        {(publication.error || draft.error) && <p role="status">{publication.error || draft.error}</p>}
        {session.shipment && session.shipment.status !== 'draft' && <p>Planning is locked after dispatch. Accepted locations and receipt evidence remain inspectable.</p>}
        <div className="execution-actions"><button disabled={!draft.canPublish || !publication.result} onClick={async () => { if (!publication.result || !draft.basis) return; const next = await session.submit('evaluate', { stage: 'warehouse', result: publication.result }, draft.basis.revision); if (next) { draft.acknowledge(next, { facility, manifest, solverResult }); setNotification({ type: 'success', message: 'Reviewed receiving plan saved with original unit identities and locations.' }); } }}>Publish reviewed receiving plan</button><a href={session.productUrl('product-07-yard-dock')}>Review dock allocation</a><button onClick={() => session.inspect('shipment')}>Inspect shipment and units</button></div>
      </section>}
      {draft.detached && <p className="execution-task-note">Detached receiving draft retained. Native edits affect this independent workbench.</p>}
      <ReceivingTask />
      {/* Platform & Bridge Status Bar */}
      <div className="status-strip">
        <div className="strip-group">
          <span className="strip-label">FACILITY:</span>
          <span className="strip-value">{facility.name} ({facility.code})</span>
          <span className="strip-badge-live">{session?.selectedId ? 'DECLARED SCENARIO FACILITY' : 'INDEPENDENT FACILITY SIMULATOR'}</span>
        </div>

        <div className="strip-group">
          <span className="strip-label">CROSS-PRODUCT BRIDGE:</span>
          <button className="bridge-button" disabled={Boolean(session?.selectedId)} onClick={handleImportCargoFit} title="Load a demonstration manifest in standalone mode">
             Import from P01 Cargo Fit (OLLP-v1)
          </button>
        </div>

        <div className="metrics-pills">
          <div className="pill">
            <span className="pill-num">{metrics.totalSlots}</span>
            <span className="pill-txt">Total Slots</span>
          </div>
          <div className="pill">
            <span className="pill-num text-emerald">{metrics.availableSlots}</span>
            <span className="pill-txt">Available</span>
          </div>
          <div className="pill">
            <span className="pill-num text-amber">{metrics.reservedSlots}</span>
            <span className="pill-txt">Reserved Inbound</span>
          </div>
          <div className="pill">
            <span className="pill-num text-cyan">{metrics.occupancyPercent}%</span>
            <span className="pill-txt">Capacity Occupied</span>
          </div>
        </div>
      </div>

      {notification && (
        <div className={`notification-bar ${notification.type}`}>
          <span>{notification.message}</span>
          <button className="close-notif" onClick={() => setNotification(null)}></button>
        </div>
      )}

      {/* Main 3-Column Operational Layout */}
      <div className="operational-grid">
        {/* Left Column: Inbound Manifest & Multi-Constraint Solver */}
        <div className="col-panel manifest-panel">
          <div className="panel-header">
            <div>
              <h3>Inbound Shipment</h3>
              <p className="subtext">{manifest.deliveryOrderNumber} · {manifest.carrierName}</p>
            </div>
            <span className="badge-dock">{manifest.dockAssigned}</span>
          </div>

          {/* Workflow Stepper HUD */}
          {solverResult && (
            <div className="solver-stepper-card">
              <div className="stepper-title-row">
                <span className="stepper-title">Putaway Optimization Plan</span>
                <span className="stepper-total">{solverResult.totalExpected} Pallets Expected</span>
              </div>

              <div className="stepper-stats-grid">
                <div
                  className={`stat-box proposed ${statusFilter === 'proposed' ? 'active' : ''}`}
                  onClick={() => setStatusFilter(statusFilter === 'proposed' ? 'all' : 'proposed')}
                >
                  <span className="stat-count">{solverResult.proposedCount}</span>
                  <span className="stat-label">Positions Proposed</span>
                </div>

                <div
                  className={`stat-box alternative ${statusFilter === 'alternative' ? 'active' : ''}`}
                  onClick={() => setStatusFilter(statusFilter === 'alternative' ? 'all' : 'alternative')}
                >
                  <span className="stat-count">{solverResult.alternativeCount}</span>
                  <span className="stat-label">Need Alternative</span>
                </div>

                <div
                  className={`stat-box conflict ${statusFilter === 'conflict' ? 'active' : ''}`}
                  onClick={() => setStatusFilter(statusFilter === 'conflict' ? 'all' : 'conflict')}
                >
                  <span className="stat-count">{solverResult.conflictCount}</span>
                  <span className="stat-label">Constraint Conflicts</span>
                </div>
              </div>

              <div className="stepper-actions">
                <button className="btn-action primary" disabled={Boolean(session?.selectedId && (!draft.canPublish || !session.resources))} onClick={handleRunSolver}>
                   Re-solve Putaway
                </button>
                {!session?.selectedId && <button className="btn-action secondary" onClick={handleCommitReservations}>
                   Reserve All Proposed
                </button>}
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="filter-search-row">
            <input
              type="text"
              placeholder="Search SKU, Pallet ID, Slot..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {statusFilter !== 'all' && (
              <button className="clear-filter-btn" onClick={() => setStatusFilter('all')}>
                Filter: {statusFilter} 
              </button>
            )}
          </div>

          {/* Pallet Items Queue */}
          <div className="pallet-list-container">
            {filteredRecommendations.map((rec) => {
              const isSelected = rec.palletId === selectedPalletId;
              return (
                <div
                  key={rec.palletId}
                  className={`pallet-card ${rec.status} ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedPalletId(rec.palletId);
                    if (rec.targetSlotId) setSelectedSlotId(rec.targetSlotId);
                  }}
                >
                  <div className="pallet-card-top">
                    <span className="pallet-id">{rec.palletId}</span>
                    <span className={`status-pill ${rec.status}`}>{rec.status.toUpperCase()}</span>
                  </div>

                  <div className="pallet-desc">{rec.description}</div>

                  <div className="pallet-meta-row">
                    <span>{rec.dimensions.lengthIn}x{rec.dimensions.widthIn}x{rec.dimensions.heightIn}"</span>
                    <span>{rec.weightLbs} lbs</span>
                    <span className={`env-tag ${rec.environmentalClass}`}>{rec.environmentalClass.toUpperCase()}</span>
                  </div>

                  <div className="pallet-assigned-row">
                    <span className="assigned-label">Slot:</span>
                    <span className="assigned-code">{rec.targetLocationCode}</span>
                    <span className="fit-score">{rec.suitabilityScore}% Fit</span>
                  </div>

                  {rec.violations && rec.violations.length > 0 && (
                    <div className="violations-alert">
                      ️ {rec.violations[0]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Column: 2D Interactive Facility Map */}
        <div className="col-panel map-panel">
          <div className="panel-header">
            <div>
              <h3>2D Facility Spatial Map</h3>
              <p className="subtext">Click any zone or slot for rack inspection and beam load ratings</p>
            </div>
            <div className="map-legend">
              <span className="legend-item"><span className="swatch available"></span> Available</span>
              <span className="legend-item"><span className="swatch reserved"></span> Reserved</span>
              <span className="legend-item"><span className="swatch occupied"></span> Occupied</span>
              <span className="legend-item"><span className="swatch target"></span> Target Slot</span>
            </div>
          </div>

          {/* SVG Floorplan Canvas */}
          <div className="canvas-wrapper">
            <svg
              viewBox="0 0 1020 420"
              className="facility-svg"
            >
              {/* Facility Outer Perimeter */}
              <rect x="10" y="5" width="1000" height="405" rx="8" fill="#0b1324" stroke="#1e293b" strokeWidth="2" />

              {/* Zones Rendering */}
              {displayedFacility.zones.map((zone) => {
                const b = zone.canvasBounds;
                return (
                  <g key={zone.id} className="zone-group">
                    <rect
                      x={b.x}
                      y={b.y}
                      width={b.width}
                      height={b.height}
                      rx="6"
                      fill={`${zone.color}10`}
                      stroke={zone.color}
                      strokeWidth="1.2"
                      strokeDasharray="4 2"
                    />
                    <text
                      x={b.x + 8}
                      y={b.y + 14}
                      fill={zone.color}
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="sans-serif"
                    >
                      {zone.name.toUpperCase()}
                    </text>

                    {/* Slots in Zone */}
                    {zone.slots.map((slot) => {
                      const c = slot.canvasCoords;
                      const isTarget = selectedRecommendation?.targetSlotId === slot.id;
                      const isSelected = selectedSlotId === slot.id;

                      let fill = '#131e35';
                      let stroke = '#334155';

                      if (slot.status === 'occupied') {
                        fill = '#1d4ed8'; // Blue
                        stroke = '#3b82f6';
                      } else if (slot.status === 'reserved_inbound') {
                        fill = '#b45309'; // Amber
                        stroke = '#f59e0b';
                      }

                      if (isTarget) {
                        stroke = '#10b981'; // Emerald highlight for target
                        fill = '#065f46';
                      }

                      if (isSelected) {
                        stroke = '#38bdf8'; // Cyan border for active inspection
                      }

                      return (
                        <g
                          key={slot.id}
                          className="slot-node"
                          onClick={() => setSelectedSlotId(slot.id)}
                          onMouseEnter={() => setHoveredSlot(slot)}
                          onMouseLeave={() => setHoveredSlot(null)}
                          style={{ cursor: 'pointer' }}
                        >
                          <rect
                            x={c.x}
                            y={c.y}
                            width={c.width}
                            height={c.height}
                            rx="3"
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={isTarget || isSelected ? 2 : 1}
                          />
                          <text
                            x={c.x + c.width / 2}
                            y={c.y + c.height / 2 + 3}
                            fill="#f8fafc"
                            fontSize="8"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            {slot.code}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredSlot && (
              <div className="hover-tooltip">
                <strong>{hoveredSlot.code}</strong> · {hoveredSlot.type.replace('_', ' ')}
                <div>Status: <span className={`text-${hoveredSlot.status}`}>{hoveredSlot.status}</span></div>
                <div>Capacity: {hoveredSlot.dimensions.lengthIn}x{hoveredSlot.dimensions.widthIn}x{hoveredSlot.dimensions.heightIn}" · Max: {hoveredSlot.maxWeightLbs} lbs</div>
                {hoveredSlot.currentOccupantId && <div>Occupant: {hoveredSlot.currentOccupantId}</div>}
                {hoveredSlot.reservedPalletId && <div>Reserved for: {hoveredSlot.reservedPalletId}</div>}
              </div>
            )}
          </div>

          {/* Active Slot Detailed Inspection Panel */}
          {activeSlot && (
            <div className="slot-detail-bar">
              <div className="slot-detail-header">
                <span className="slot-title">SLOT INSPECTION: <strong>{activeSlot.code}</strong></span>
                <span className={`slot-status-badge ${activeSlot.status}`}>{activeSlot.status.toUpperCase()}</span>
              </div>
              <div className="slot-props-grid">
                <div><span>Zone:</span> {findZoneBySlotId(displayedFacility, activeSlot.id)?.name}</div>
                <div><span>Dimensions:</span> {activeSlot.dimensions.lengthIn}" L x {activeSlot.dimensions.widthIn}" W x {activeSlot.dimensions.heightIn}" H</div>
                <div><span>Max Weight:</span> {activeSlot.maxWeightLbs} lbs</div>
                <div><span>Level:</span> {activeSlot.level ? `Tier L${activeSlot.level}` : 'Floor / Ground'}</div>
                <div><span>Allowed:</span> {activeSlot.allowedClasses.join(', ')}</div>
                <div><span>Current Occupant:</span> {activeSlot.currentOccupantId || 'None'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Work Queue, Scan Verification & EPCIS Stream */}
        <div className="col-panel execution-panel">
          {/* Tab Navigation */}
          <div className="panel-tabs">
            <button
              className={`tab-btn ${rightPanelTab === 'queue' ? 'active' : ''}`}
              onClick={() => setRightPanelTab('queue')}
            >
              Putaway Queue
            </button>
            <button
              className={`tab-btn ${rightPanelTab === 'epcis' ? 'active' : ''}`}
              onClick={() => setRightPanelTab('epcis')}
            >
              EPCIS 2.0 Stream ({epcisEvents.length})
            </button>
            <button
              className={`tab-btn ${rightPanelTab === 'yard' ? 'active' : ''}`}
              onClick={() => setRightPanelTab('yard')}
            >
              Dual-Role Containers
            </button>
          </div>

          {/* Tab 1: Putaway Work Queue & Scan Verification */}
          {rightPanelTab === 'queue' && (
            <div className="queue-content">
              {selectedRecommendation ? (
                <div className="scanner-simulator-card">
                  <h4>Handheld Terminal Putaway Task</h4>
                  <div className="barcode-display">
                    <span className="barcode-font">||||| | |||| ||| |||||||</span>
                    <span className="barcode-txt">SSCC: {selectedRecommendation.barcode}</span>
                  </div>

                  <div className="scan-item-info">
                    <div><strong>Pallet:</strong> {selectedRecommendation.palletId}</div>
                    <div><strong>SKU:</strong> {selectedRecommendation.sku}</div>
                    <div><strong>Assigned Bin:</strong> <span className="highlight-code">{selectedRecommendation.targetLocationCode}</span></div>
                    <div><strong>Weight:</strong> {selectedRecommendation.weightLbs} lbs</div>
                  </div>

                  {!session?.selectedId ? <div className="scan-action-buttons">
                    <button
                      className="btn-scan-confirm"
                      disabled={!selectedRecommendation.targetSlotId}
                      onClick={() => handleVerifyPutaway(selectedRecommendation, false)}
                    >
                       Scan Barcode & Confirm Putaway
                    </button>
                    <button
                      className="btn-scan-error"
                      disabled={!selectedRecommendation.targetSlotId}
                      onClick={() => handleVerifyPutaway(selectedRecommendation, true)}
                    >
                      ️ Simulate Scan Discrepancy
                    </button>
                  </div> : <p className="execution-task-note">Use the manual shipment receipt task above. <button onClick={() => session.inspect(`unit:${selectedRecommendation.palletId}`)}>Inspect original handling unit</button></p>}

                  {discrepancies.length > 0 && (
                    <div className="discrepancy-box">
                      <h5>Active Discrepancies ({discrepancies.length})</h5>
                      {discrepancies.map((d) => (
                        <div key={d.id} className="disc-item">
                          <span>{d.palletId}: Scanned <strong>{d.actualLocationId}</strong> vs Expected <strong>{d.expectedLocationId}</strong></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state">Select a pallet from the left manifest to begin putaway execution.</div>
              )}
            </div>
          )}

          {/* Tab 2: GS1 EPCIS 2.0 Audit Ledger */}
          {rightPanelTab === 'epcis' && (
            <div className="epcis-content">
              <h4>GS1 EPCIS 2.0 Event Audit Log</h4>
              <p className="subtext">Immutable chain of custody across spatial transitions</p>
              <div className="epcis-list">
                {epcisEvents.map((evt) => (
                  <div key={evt.eventId} className="epcis-card">
                    <div className="epcis-top">
                      <span className="epcis-type">{evt.eventType} · {evt.action}</span>
                      <span className="epcis-time">{new Date(evt.eventTime).toLocaleTimeString()}</span>
                    </div>
                    <div className="epcis-row"><span>bizStep:</span> <code>{evt.bizStep.split(':').pop()}</code></div>
                    <div className="epcis-row"><span>disposition:</span> <code>{evt.disposition.split(':').pop()}</code></div>
                    <div className="epcis-row"><span>readPoint:</span> {evt.readPoint.split('.').pop()}</div>
                    <div className="epcis-row"><span>Evidence:</span> {evt.verificationEvidence.notes}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Dual-Role Moveable Container Inspector */}
          {rightPanelTab === 'yard' && (
            <div className="yard-content">
              <h4>Dual-Role Container Hierarchy</h4>
              <p className="subtext">Demonstrates intermodal containers acting as both assets and storage spaces</p>
              {entities.filter((e) => e.isStorageContainer).map((cont) => (
                <div key={cont.id} className="container-card">
                  <div className="container-header">
                    <span> {cont.label}</span>
                    <span className="yard-slot-tag">Parked at: {cont.parentLocationId}</span>
                  </div>
                  <div className="container-body">
                    <div>Dimensions: {cont.dimensions.lengthIn}" L x {cont.dimensions.widthIn}" W</div>
                    <div>Tare Weight: {cont.weightLbs} lbs</div>
                    <div className="nested-pallets-title">Contained Pallets ({cont.containedEntityIds?.length}):</div>
                    {entities.filter((e) => e.parentLocationId === cont.id).map((p) => (
                      <div key={p.id} className="nested-pallet-item">
                        <span> {p.label}</span>
                        <span>{p.weightLbs} lbs</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
