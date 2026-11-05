import React, { useState, useEffect, useRef, useMemo } from 'react';
import { computeFacilityMetrics } from '../engine/spatialModel';
import {
  type CameraConfig,
  type PalletRackBay,
  buildWarehouseScene,
  projectSceneFaces,
  buildWarehouseBlueprintAnnotations,
} from '../engine/warehouseIsometric';

export interface WarehouseIsometricCanvasProps {
  /** Facility to derive KPIs from. When omitted, falls back to canonical DC-04 metrics. */
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
  const [showForklifts, setShowForklifts] = useState<boolean>(true);
  const [velocityFilter, setVelocityFilter] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [selectedBay, setSelectedBay] = useState<PalletRackBay | null>(null);
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
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    if (svgRef.current) {
      svgRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

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
      if (svgRef.current) {
        svgRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
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
  const { projectedFaces, bays, dimensionLines, technicalPins } = useMemo(() => {
    const { faces: rawFaces, bays: generatedBays } = buildWarehouseScene(
      showRacks,
      showDocks,
      showForklifts,
      velocityFilter
    );

    const projected = projectSceneFaces(rawFaces, camera);
    const annotations = buildWarehouseBlueprintAnnotations(camera);

    return {
      projectedFaces: projected,
      bays: generatedBays,
      dimensionLines: annotations.dimensionLines,
      technicalPins: annotations.technicalPins,
    };
  }, [showRacks, showDocks, showForklifts, velocityFilter, camera]);

  const isBlueprint = camera.renderMode === 'blueprint';

  return (
    <div className="wh-vector-root">
      {/* Top Controls Bar */}
      <div className="wh-hud-bar">
        <div className="hud-left">
          <span className="badge-tech">SVG 3D WAREHOUSE ENGINE</span>
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
              className={`btn-pill ${showForklifts ? 'active' : ''}`}
              onClick={() => setShowForklifts(!showForklifts)}
              title="Toggle Forklifts"
            >
               Forklifts
            </button>
          </div>

          {/* Velocity Class Filters */}
          <div className="btn-group">
            <span className="filter-label">VELOCITY:</span>
            <button
              className={`btn-filter ${velocityFilter === 'all' ? 'active' : ''}`}
              onClick={() => setVelocityFilter('all')}
            >
              All
            </button>
            <button
              className={`btn-filter ${velocityFilter === 'A' ? 'active green' : ''}`}
              onClick={() => setVelocityFilter('A')}
            >
              Class A (Fast)
            </button>
            <button
              className={`btn-filter ${velocityFilter === 'B' ? 'active cyan' : ''}`}
              onClick={() => setVelocityFilter('B')}
            >
              Class B
            </button>
            <button
              className={`btn-filter ${velocityFilter === 'C' ? 'active amber' : ''}`}
              onClick={() => setVelocityFilter('C')}
            >
              Class C
            </button>
          </div>
        </div>
      </div>

      {/* Main Vector SVG Area */}
      <div className="wh-svg-container" onWheel={handleWheel}>
        <svg
          ref={svgRef}
          viewBox="0 0 940 500"
          className={`wh-svg ${isBlueprint ? 'blueprint-canvas' : ''}`}
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
                  const bayMatch = bays.find((b) => face.partName.includes(b.bayCode));
                  if (bayMatch) setSelectedBay(bayMatch);
                }}
              />
            ))}
          </g>

          {/* Blueprint Overlay Annotations */}
          {isBlueprint && (
            <g className="wh-annotations-layer">
              {dimensionLines.map((dim) => (
                <g key={dim.id}>
                  <line
                    x1={dim.start[0]}
                    y1={dim.start[1]}
                    x2={dim.end[0]}
                    y2={dim.end[1]}
                    stroke="#38bdf8"
                    strokeWidth="1.2"
                  />
                  <rect
                    x={dim.mid[0] - 40}
                    y={dim.mid[1] - 9}
                    width="80"
                    height="18"
                    rx="4"
                    fill="rgba(3, 25, 38, 0.9)"
                    stroke="#38bdf8"
                    strokeWidth="1"
                  />
                  <text
                    x={dim.mid[0]}
                    y={dim.mid[1] + 3}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {dim.label}
                  </text>
                </g>
              ))}

              {technicalPins.map((pin) => (
                <g key={pin.id}>
                  <circle cx={pin.position[0]} cy={pin.position[1]} r="5" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                  <circle cx={pin.position[0]} cy={pin.position[1]} r="2" fill="#38bdf8" />
                  <polyline
                    points={`${pin.position[0]},${pin.position[1]} ${pin.pinEnd[0]},${pin.pinEnd[1]} ${pin.pinEnd[0] + 35},${pin.pinEnd[1]}`}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.2"
                    strokeDasharray="2,2"
                  />
                  <rect
                    x={pin.pinEnd[0]}
                    y={pin.pinEnd[1] - 18}
                    width="120"
                    height="18"
                    rx="3"
                    fill="rgba(3, 25, 38, 0.9)"
                    stroke="#38bdf8"
                    strokeWidth="1"
                  />
                  <text
                    x={pin.pinEnd[0] + 6}
                    y={pin.pinEnd[1] - 5}
                    fill="#f8fafc"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {pin.label}
                  </text>
                </g>
              ))}
            </g>
          )}

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

        {/* Selected Bay Floating Cyber-HUD Dossier */}
        {selectedBay && (
          <div className="bay-dossier-card">
            <div className="dossier-hdr">
              <div>
                <span className="badge-bay">PALLET RACK BAY {selectedBay.bayCode}</span>
                <h4>{selectedBay.sku}</h4>
              </div>
              <button className="btn-close" onClick={() => setSelectedBay(null)}></button>
            </div>
            <div className="dossier-metrics-grid">
              <div className="metric">
                <span>Aisle / Tier:</span>
                <strong>{selectedBay.aisle} · Tier {selectedBay.tier}</strong>
              </div>
              <div className="metric">
                <span>Velocity Class:</span>
                <strong className={selectedBay.velocityClass === 'A' ? 'text-emerald' : 'text-cyan'}>
                  Class {selectedBay.velocityClass} ({selectedBay.velocityClass === 'A' ? 'Fast' : selectedBay.velocityClass === 'B' ? 'Medium' : 'Slow'})
                </strong>
              </div>
              <div className="metric">
                <span>Unit Weight:</span>
                <strong>{selectedBay.weightLbs.toLocaleString()} lbs</strong>
              </div>
              <div className="metric">
                <span>Beam Rating:</span>
                <strong className="text-emerald">5,000 lbs (Compliant)</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Facility Operational Metrics Bar */}
      <div className="wh-kpi-footer">
        <div className="kpi-card">
          <span className="kpi-k">Total Rack Capacity</span>
          <span className="kpi-v text-cyan">{derivedMetrics ? `${derivedMetrics.totalSlots} Slots` : '48 Bays'}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-k">Slotting Occupancy</span>
          <span className="kpi-v text-emerald">{derivedMetrics ? `${derivedMetrics.occupancyPercent}% (${derivedMetrics.occupiedSlots} / ${derivedMetrics.totalSlots})` : '100% (48 / 48)'}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-k">Total Stored Mass</span>
          <span className="kpi-v">{derivedMetrics ? `${derivedMetrics.totalWeightCapacityLbs.toLocaleString()} lbs` : '88,800 lbs'}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-k">Dock Doors / Staging</span>
          <span className="kpi-v text-amber">3 Cross-Dock Lanes</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-k">Active MHE</span>
          <span className="kpi-v">1 Electric Forklift</span>
        </div>
      </div>
    </div>
  );
};
