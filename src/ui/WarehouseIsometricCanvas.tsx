import React, { useState, useEffect, useRef, useMemo } from 'react';
import { computeFacilityMetrics } from '../engine/spatialModel';
import { buildFacilityScene } from '../engine/facilityScene';
import {
  type CameraConfig,
  projectSceneFaces,
} from '../engine/warehouseIsometric';

export interface WarehouseIsometricCanvasProps {
  /** Active workspace facility. */
  facility?: import('../engine/types').Facility;
  /** Pre-computed metrics. When omitted, computed from facility. */
  metrics?: import('../engine/spatialModel').FacilityMetrics;
}

export const WarehouseIsometricCanvas: React.FC<WarehouseIsometricCanvasProps> = ({ facility, metrics: metricsProp }) => {
  const [camera, setCamera] = useState<CameraConfig>({
    azimuthDeg: 40,
    elevationDeg: 32,
    scale: 9.8,
    originX: 470,
    originY: 260,
    centerTarget: [0, 4, 2],
    lightAzimuthDeg: 55,
    lightElevationDeg: 45,
    ambientLight: 0.38,
    enableBackfaceCulling: true,
    renderMode: 'shaded',
  });

  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showRacks, setShowRacks] = useState<boolean>(true);
  const [showDocks, setShowDocks] = useState<boolean>(true);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);
  const derivedMetrics = useMemo(() => {
    if (metricsProp) return metricsProp;
    if (facility) {
      return computeFacilityMetrics(facility);
    }
    return null;
  }, [facility, metricsProp]);

  // Drag Orbit Handling
  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);
  const pointerCapturedRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    pointerCapturedRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    if (dx === 0 && dy === 0) return;
    if (!pointerCapturedRef.current && svgRef.current) {
      svgRef.current.setPointerCapture(e.pointerId);
      pointerCapturedRef.current = true;
    }

    setCamera((prev) => {
      let newAzimuth = (prev.azimuthDeg - dx * 0.45) % 360;
      if (newAzimuth < 0) newAzimuth += 360;
      const newElevation = Math.max(15, Math.min(80, prev.elevationDeg + dy * 0.35));
      return {
        ...prev,
        azimuthDeg: Math.round(newAzimuth),
        elevationDeg: Math.round(newElevation),
      };
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      if (svgRef.current && pointerCapturedRef.current) {
        svgRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    pointerCapturedRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.6 : -0.6;
    setCamera((prev) => ({
      ...prev,
      scale: Math.max(6, Math.min(18, prev.scale + zoomDelta)),
    }));
  };

  // 60 FPS Turntable Loop
  useEffect(() => {
    if (!autoRotate) return;
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      setCamera((prev) => ({
        ...prev,
        azimuthDeg: (prev.azimuthDeg + 18 * dt) % 360,
      }));
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [autoRotate]);

  // Project Scene Faces
  const scene = useMemo(() => facility ? buildFacilityScene(facility, { showRacks, showDocks }) : null, [facility, showRacks, showDocks]);
  const projectedFaces = useMemo(() => projectSceneFaces(scene?.faces ?? [], camera), [scene, camera]);
  const selectedSlot = scene?.slots.find(item => item.slot.id === selectedSlotId)?.slot;

  const isBlueprint = camera.renderMode === 'blueprint';

  return (
    <div className="wh-vector-root">
      {/* Top Controls Bar */}
      <div className="wh-hud-bar">
        <div className="hud-left">
          <span className="badge-tech">{facility?.name ?? 'WAREHOUSE VIEW'}</span>
          <span className="hud-sub">
            Azimuth: {camera.azimuthDeg}° · Elevation: {camera.elevationDeg}° · {projectedFaces.length} Faces
          </span>
          {hoveredPart && (
            <span className="part-inspect-tag">
              Part: <strong>{hoveredPart}</strong>
            </span>
          )}
        </div>

        <div className="hud-right">
          {/* Render Mode */}
          <div className="btn-group">
            <button
              className={`btn-pill ${camera.renderMode === 'shaded' ? 'active' : ''}`}
              onClick={() => setCamera((c) => ({ ...c, renderMode: 'shaded' }))}
            >
               Shaded
            </button>
            <button
              className={`btn-pill ${camera.renderMode === 'blueprint' ? 'active cyan' : ''}`}
              onClick={() => setCamera((c) => ({ ...c, renderMode: 'blueprint' }))}
            >
               Blueprint
            </button>
            <button
              className={`btn-pill ${autoRotate ? 'active amber' : ''}`}
              onClick={() => setAutoRotate(!autoRotate)}
            >
              {autoRotate ? '️ Stop' : ' Turntable'}
            </button>
          </div>

          {/* Layer Visibility Toggles */}
          <div className="btn-group">
            <button
              className={`btn-pill ${showRacks ? 'active' : ''}`}
              onClick={() => setShowRacks(!showRacks)}
              title="Toggle Pallet Racks"
            >
               Racks
            </button>
            <button
              className={`btn-pill ${showDocks ? 'active' : ''}`}
              onClick={() => setShowDocks(!showDocks)}
              title="Toggle Loading Docks"
            >
               Docks
            </button>
            <button
              className="btn-pill"
              disabled
              title="Equipment positions are not provided by this workspace"
            >
               Equipment positions unavailable
            </button>
          </div>

          {/* Velocity Class Filters */}
          <div className="btn-group">
            <span className="filter-label">VELOCITY DATA NOT PROVIDED:</span>
            <button
              className="btn-filter active"
              disabled
            >
              All
            </button>
            <button
              className="btn-filter"
              disabled
            >
              Class A (Fast)
            </button>
            <button
              className="btn-filter"
              disabled
            >
              Class B
            </button>
            <button
              className="btn-filter"
              disabled
            >
              Class C
            </button>
          </div>
        </div>
      </div>

      <p>Positions follow the facility's 2D workspace layout. Heights are schematic; slot ratings and occupancy are declared workspace data.</p>
      {scene && scene.invalidSlotIds.length > 0 && <p role="status">{scene.invalidSlotIds.length} location(s) have missing or invalid 2D coordinates and are not shown.</p>}
      {scene && scene.slots.length > 0 && <label>Inspect location <select aria-label="Inspect warehouse location" value={selectedSlot ? selectedSlotId : ''} onChange={event => setSelectedSlotId(event.target.value)}><option value="">Select a location</option>{scene.slots.map(({ slot }) => <option key={slot.id} value={slot.id}>{slot.code} · {slot.status.replaceAll('_', ' ')}</option>)}</select></label>}

      {/* Main Vector SVG Area */}
      <div className="wh-svg-container" onWheel={handleWheel}>
        <svg
          ref={svgRef}
          viewBox="0 0 940 500"
          className={`wh-svg ${isBlueprint ? 'blueprint-canvas' : ''}`}
          role="img"
          aria-label={`3D layout for ${facility?.name ?? 'warehouse'}`}
          xmlns="http://www.w3.org/2000/svg"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <defs>
            {/* Blueprint Grid */}
            <pattern id="whGridSmall" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="0.8" />
            </pattern>
            <pattern id="whGridLarge" width="100" height="100" patternUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="url(#whGridSmall)" />
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1.2" />
            </pattern>
          </defs>

          {/* Background */}
          {isBlueprint ? (
            <>
              <rect width="100%" height="100%" fill="#031926" />
              <rect width="100%" height="100%" fill="url(#whGridLarge)" />
            </>
          ) : (
            <rect width="100%" height="100%" fill="#050811" />
          )}

          {/* 3D -> 2D Projected Faces */}
          <g className="wh-faces-layer">
            {projectedFaces.map((face) => (
              <polygon
                key={face.id}
                points={face.pointsStr}
                fill={face.fillColor}
                stroke={face.strokeColor}
                strokeWidth={face.strokeWidth}
                opacity={face.opacity}
                className="wh-face-poly"
                onMouseEnter={() => setHoveredPart(face.partName)}
                onMouseLeave={() => setHoveredPart(null)}
                onClick={() => {
                  const slotId = scene?.faceSlotIds.get(face.id);
                  if (slotId) setSelectedSlotId(slotId);
                }}
              />
            ))}
          </g>

          {/* Compass Radar */}
          <g transform="translate(60, 450)">
            <circle cx="0" cy="0" r="22" fill="none" stroke="rgba(56, 189, 248, 0.3)" strokeDasharray="3,3" />
            <line
              x1="0"
              y1="0"
              x2={18 * Math.sin((camera.azimuthDeg * Math.PI) / 180)}
              y2={-18 * Math.cos((camera.azimuthDeg * Math.PI) / 180)}
              stroke="#38bdf8"
              strokeWidth="2"
            />
            <circle cx="0" cy="0" r="3" fill="#38bdf8" />
            <text x="0" y="-25" textAnchor="middle" fill="#38bdf8" fontSize="8" fontFamily="monospace" fontWeight="bold">N</text>
          </g>
        </svg>

        {selectedSlot && (
          <div className="bay-dossier-card" role="region" aria-label="Selected warehouse location">
            <div className="dossier-hdr">
              <div><span className="badge-bay">LOCATION {selectedSlot.code}</span><h4>{selectedSlot.status.replaceAll('_', ' ')}</h4></div>
              <button className="btn-close" aria-label="Close location details" onClick={() => setSelectedSlotId('')}>×</button>
            </div>
            <div className="dossier-metrics-grid">
              <div className="metric"><span>Aisle / Level:</span><strong>{selectedSlot.aisle ?? 'Not provided'} · {selectedSlot.level ?? 'Not provided'}</strong></div>
              <div className="metric"><span>Occupant:</span><strong>{selectedSlot.currentOccupantId ?? selectedSlot.reservedPalletId ?? 'Not provided'}</strong></div>
              <div className="metric"><span>Declared current weight:</span><strong>{selectedSlot.currentWeightLbs == null ? 'Not provided' : `${selectedSlot.currentWeightLbs.toLocaleString()} lbs`}</strong></div>
              <div className="metric"><span>Declared slot rating:</span><strong>{Number.isFinite(selectedSlot.maxWeightLbs) ? `${selectedSlot.maxWeightLbs.toLocaleString()} lbs` : 'Not provided'}</strong></div>
            </div>
          </div>
        )}
      </div>

      {/* Facility Operational Metrics Bar */}
      <div className="wh-kpi-footer">
        <div className="kpi-card">
          <span className="kpi-k">Total Locations</span>
          <span className="kpi-v text-cyan">{derivedMetrics ? `${derivedMetrics.totalSlots} locations` : 'Not provided'}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-k">Slotting Occupancy</span>
          <span className="kpi-v text-emerald">{derivedMetrics ? `${derivedMetrics.occupancyPercent}% (${derivedMetrics.occupiedSlots} occupied, ${derivedMetrics.reservedSlots} reserved / ${derivedMetrics.totalSlots})` : 'Not provided'}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-k">Sum of slot weight ratings (not stored mass or shared capacity)</span>
          <span className="kpi-v">{derivedMetrics ? `${derivedMetrics.totalWeightCapacityLbs.toLocaleString()} lbs` : 'Not provided'}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-k">Dock locations</span>
          <span className="kpi-v text-amber">{facility ? facility.zones.flatMap(zone => zone.slots).filter(slot => slot.type === 'dock_door').length : 'Not provided'}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-k">Equipment positions</span>
          <span className="kpi-v">Not provided</span>
        </div>
      </div>
    </div>
  );
};
