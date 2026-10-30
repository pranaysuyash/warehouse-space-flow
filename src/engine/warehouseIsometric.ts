/**
 * Pure-Vector 3D to 2D SVG Warehouse Space & Flow Engine
 * Inspired by Li Yuxuan (@xmliszt - laundro.cafe) and Zafar Lab (@zafarlab).
 *
 * Implements:
 * 1. 3D coordinates (x, y, z) -> 2D SVG paths (u, v)
 * 2. Backface culling via 2D winding area
 * 3. Painter's algorithm depth sorting
 * 4. Directional sunlight shading & ambient illumination
 * 5. Multi-bay pallet racks, cross-docking staging lanes, and forklift traffic paths
 * 6. Zafar Lab-style technical blueprint dimension lines and inspection pins
 */

export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export interface Face3D {
  id: string;
  partName: string;
  vertices: Vec3[];
  baseColor: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  isWireframeOnly?: boolean;
}

export interface CameraConfig {
  azimuthDeg: number;   // 0 - 360 rotation around Y axis
  elevationDeg: number; // 15 - 75 pitch tilt
  scale: number;        // Zoom scale
  originX: number;
  originY: number;
  centerTarget: Vec3;
  lightAzimuthDeg: number;
  lightElevationDeg: number;
  ambientLight: number;
  enableBackfaceCulling: boolean;
  renderMode: 'shaded' | 'blueprint' | 'wireframe';
}

export interface ProjectedFace2D {
  id: string;
  partName: string;
  pointsStr: string;
  points: Vec2[];
  depth: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  isBackface: boolean;
  normal: Vec3;
}

export interface DimensionLine2D {
  id: string;
  label: string;
  start: Vec2;
  end: Vec2;
  tickStart1: Vec2;
  tickStart2: Vec2;
  tickEnd1: Vec2;
  tickEnd2: Vec2;
  mid: Vec2;
}

export interface TechnicalPin2D {
  id: string;
  label: string;
  category: string;
  position: Vec2;
  pinEnd: Vec2;
}

export interface PalletRackBay {
  id: string;
  bayCode: string;
  aisle: string;
  tier: number;
  sku: string;
  velocityClass: 'A' | 'B' | 'C';
  weightLbs: number;
  isOccupied: boolean;
}

// -------------------------------------------------------------
// VECTOR MATH HELPERS
// -------------------------------------------------------------

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len === 0) return [0, 1, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 100, g: 150, b: 200 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function shadeHexColor(hex: string, intensity: number): string {
  const { r, g, b } = parseHexColor(hex);
  return rgbToHex(r * intensity, g * intensity, b * intensity);
}

// -------------------------------------------------------------
// 3D -> 2D PROJECTION & DEPTH SORTING
// -------------------------------------------------------------

export function projectVec3(
  p: Vec3,
  camera: CameraConfig
): { pt: Vec2; depth: number } {
  const radA = (camera.azimuthDeg * Math.PI) / 180;
  const radE = (camera.elevationDeg * Math.PI) / 180;

  const dx = p[0] - camera.centerTarget[0];
  const dy = p[1] - camera.centerTarget[1];
  const dz = p[2] - camera.centerTarget[2];

  // Rotate around Y axis (Azimuth)
  const x1 = dx * Math.cos(radA) - dz * Math.sin(radA);
  const z1 = dx * Math.sin(radA) + dz * Math.cos(radA);
  const y1 = dy;

  // Project onto 2D isometric screen with Elevation tilt
  const u = x1 * camera.scale + camera.originX;
  const v = (-z1 * Math.sin(radE) - y1 * Math.cos(radE)) * camera.scale + camera.originY;
  const depth = z1 * Math.cos(radE) - y1 * Math.sin(radE);

  return { pt: [u, v], depth };
}

export function computeFaceNormal(v: Vec3[]): Vec3 {
  if (v.length < 3) return [0, 1, 0];
  const e1 = vec3Sub(v[1], v[0]);
  const e2 = vec3Sub(v[2], v[0]);
  return vec3Normalize(vec3Cross(e1, e2));
}

export function calculateWindingArea2D(pts: Vec2[]): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return area / 2;
}

export function projectSceneFaces(
  faces: Face3D[],
  camera: CameraConfig
): ProjectedFace2D[] {
  const lightA = (camera.lightAzimuthDeg * Math.PI) / 180;
  const lightE = (camera.lightElevationDeg * Math.PI) / 180;
  const lightDir: Vec3 = vec3Normalize([
    Math.cos(lightA) * Math.cos(lightE),
    Math.sin(lightE),
    Math.sin(lightA) * Math.cos(lightE),
  ]);

  const projected: ProjectedFace2D[] = [];

  for (const face of faces) {
    const normal = face.vertices.length >= 3 ? computeFaceNormal(face.vertices) : ([0, 1, 0] as Vec3);
    const pts2D: Vec2[] = [];
    let depthSum = 0;

    for (const v of face.vertices) {
      const { pt, depth } = projectVec3(v, camera);
      pts2D.push(pt);
      depthSum += depth;
    }

    const avgDepth = pts2D.length > 0 ? depthSum / pts2D.length : 0;
    const area2D = calculateWindingArea2D(pts2D);

    const isBackface = area2D <= 0;

    if (camera.enableBackfaceCulling && isBackface && !face.isWireframeOnly) {
      continue;
    }

    let fillColor = face.baseColor;
    let strokeColor = face.strokeColor || '#1e293b';
    let strokeWidth = face.strokeWidth ?? 1;

    if (camera.renderMode === 'blueprint') {
      fillColor = 'rgba(14, 116, 144, 0.2)';
      strokeColor = '#38bdf8';
      strokeWidth = 1.2;
    } else if (camera.renderMode === 'wireframe') {
      fillColor = 'none';
      strokeColor = '#06b6d4';
      strokeWidth = 1;
    } else if (camera.renderMode === 'shaded') {
      const dot = Math.max(0, vec3Dot(normal, lightDir));
      const intensity = camera.ambientLight + (1 - camera.ambientLight) * dot;
      fillColor = shadeHexColor(face.baseColor, intensity);

      if (normal[1] > 0.75) {
        fillColor = shadeHexColor(fillColor, 1.15);
      }
    }

    const pointsStr = pts2D.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

    projected.push({
      id: face.id,
      partName: face.partName,
      pointsStr,
      points: pts2D,
      depth: avgDepth,
      fillColor,
      strokeColor,
      strokeWidth,
      opacity: face.opacity ?? 1,
      isBackface,
      normal,
    });
  }

  // Depth sorting
  projected.sort((a, b) => a.depth - b.depth);

  return projected;
}

// -------------------------------------------------------------
// CUBOID BUILDER
// -------------------------------------------------------------

export function createCuboidFaces(
  idPrefix: string,
  partName: string,
  pos: Vec3,
  dims: Vec3,
  baseColor: string,
  options: {
    strokeColor?: string;
    strokeWidth?: number;
    opacity?: number;
    isWireframe?: boolean;
    skipFaces?: ('top' | 'bottom' | 'front' | 'back' | 'left' | 'right')[];
  } = {}
): Face3D[] {
  const [x, y, z] = pos;
  const [dx, dy, dz] = dims;
  const hx = dx / 2;
  const hy = dy / 2;
  const hz = dz / 2;

  const v000: Vec3 = [x - hx, y - hy, z - hz];
  const v100: Vec3 = [x + hx, y - hy, z - hz];
  const v110: Vec3 = [x + hx, y + hy, z - hz];
  const v010: Vec3 = [x - hx, y + hy, z - hz];
  const v001: Vec3 = [x - hx, y - hy, z + hz];
  const v101: Vec3 = [x + hx, y - hy, z + hz];
  const v111: Vec3 = [x + hx, y + hy, z + hz];
  const v011: Vec3 = [x - hx, y + hy, z + hz];

  const skip = new Set(options.skipFaces || []);
  const faces: Face3D[] = [];

  // Top Face (Normal +Y)
  if (!skip.has('top')) {
    faces.push({
      id: `${idPrefix}-top`,
      partName,
      vertices: [v011, v111, v110, v010],
      baseColor,
      strokeColor: options.strokeColor,
      strokeWidth: options.strokeWidth,
      opacity: options.opacity,
      isWireframeOnly: options.isWireframe,
    });
  }

  // Bottom Face (Normal -Y)
  if (!skip.has('bottom')) {
    faces.push({
      id: `${idPrefix}-bot`,
      partName,
      vertices: [v000, v100, v101, v001],
      baseColor: shadeHexColor(baseColor, 0.6),
      strokeColor: options.strokeColor,
      strokeWidth: options.strokeWidth,
      opacity: options.opacity,
      isWireframeOnly: options.isWireframe,
    });
  }

  // Left Face (Normal +Z)
  if (!skip.has('left')) {
    faces.push({
      id: `${idPrefix}-left`,
      partName,
      vertices: [v001, v101, v111, v011],
      baseColor: shadeHexColor(baseColor, 0.88),
      strokeColor: options.strokeColor,
      strokeWidth: options.strokeWidth,
      opacity: options.opacity,
      isWireframeOnly: options.isWireframe,
    });
  }

  // Right Face (Normal -Z)
  if (!skip.has('right')) {
    faces.push({
      id: `${idPrefix}-right`,
      partName,
      vertices: [v100, v000, v010, v110],
      baseColor: shadeHexColor(baseColor, 0.72),
      strokeColor: options.strokeColor,
      strokeWidth: options.strokeWidth,
      opacity: options.opacity,
      isWireframeOnly: options.isWireframe,
    });
  }

  // Front Face (Normal +X)
  if (!skip.has('front')) {
    faces.push({
      id: `${idPrefix}-front`,
      partName,
      vertices: [v101, v100, v110, v111],
      baseColor: shadeHexColor(baseColor, 0.95),
      strokeColor: options.strokeColor,
      strokeWidth: options.strokeWidth,
      opacity: options.opacity,
      isWireframeOnly: options.isWireframe,
    });
  }

  // Back Face (Normal -X)
  if (!skip.has('back')) {
    faces.push({
      id: `${idPrefix}-back`,
      partName,
      vertices: [v000, v001, v011, v010],
      baseColor: shadeHexColor(baseColor, 0.8),
      strokeColor: options.strokeColor,
      strokeWidth: options.strokeWidth,
      opacity: options.opacity,
      isWireframeOnly: options.isWireframe,
    });
  }

  return faces;
}

// -------------------------------------------------------------
// WAREHOUSE FACILITY MESH GENERATOR
// -------------------------------------------------------------

export function buildWarehouseScene(
  showPalletRacks: boolean,
  showDockStaging: boolean,
  showForklifts: boolean,
  highlightVelocity: 'all' | 'A' | 'B' | 'C'
): { faces: Face3D[]; bays: PalletRackBay[] } {
  const faces: Face3D[] = [];
  const bays: PalletRackBay[] = [];

  // 1. WAREHOUSE CONCRETE SLAB FLOOR (60ft wide x 40ft deep)
  faces.push(
    ...createCuboidFaces('wh-slab', 'Warehouse Slab Floor', [0, 0, 0], [64, 0.8, 44], '#1e293b', {
      strokeColor: '#334155',
    })
  );

  // 2. DOCK DOORS & CROSS-DOCK STAGING APRON (Along front Z edge)
  if (showDockStaging) {
    // 3 Dock Doors
    const dockXPositions = [-18, 0, 18];
    dockXPositions.forEach((x, idx) => {
      // Dock Door Frame
      faces.push(
        ...createCuboidFaces(`dock-frame-${idx}`, `Dock Door #${idx + 1}`, [x, 6, 21.5], [9, 11, 0.8], '#0284c7', {
          strokeColor: '#38bdf8',
        })
      );
      // Roll-up Door Aperture
      faces.push(
        ...createCuboidFaces(`dock-door-${idx}`, `Roll-Up Door #${idx + 1}`, [x, 5.5, 21.7], [8, 10, 0.4], '#0f172a', {
          strokeColor: '#0284c7',
        })
      );
      // Staging Floor Marking (Yellow safety rectangle)
      faces.push(
        ...createCuboidFaces(`dock-stage-${idx}`, `Staging Lane #${idx + 1}`, [x, 0.5, 15], [10, 0.1, 10], '#eab308', {
          opacity: 0.85,
        })
      );
    });
  }

  // 3. SELECTIVE PALLET RACKS (2 Double-Deep Rack Rows)
  if (showPalletRacks) {
    const rackAisles = [
      { aisle: 'Aisle-01', z: -10 },
      { aisle: 'Aisle-02', z: 0 },
    ];

    const rackBayWidth = 8.5; // ft per 2-pallet bay
    const beamHeight = 5.0; // ft per tier
    const uprightColor = '#0284c7'; // Steel blue upright columns
    const beamColor = '#f59e0b'; // OSHA safety orange horizontal beams

    rackAisles.forEach(({ aisle, z }) => {
      for (let bayIdx = 0; bayIdx < 4; bayIdx++) {
        const bayX = -18 + bayIdx * 10;

        // Upright End Frames (4 vertical steel columns per bay)
        faces.push(
          ...createCuboidFaces(`rf-col1-${aisle}-${bayIdx}`, 'Rack Upright', [bayX - 4.5, 8, z - 2.5], [0.6, 16, 0.6], uprightColor),
          ...createCuboidFaces(`rf-col2-${aisle}-${bayIdx}`, 'Rack Upright', [bayX + 4.5, 8, z - 2.5], [0.6, 16, 0.6], uprightColor),
          ...createCuboidFaces(`rf-col3-${aisle}-${bayIdx}`, 'Rack Upright', [bayX - 4.5, 8, z + 2.5], [0.6, 16, 0.6], uprightColor),
          ...createCuboidFaces(`rf-col4-${aisle}-${bayIdx}`, 'Rack Upright', [bayX + 4.5, 8, z + 2.5], [0.6, 16, 0.6], uprightColor)
        );

        // 3 Tiers of Horizontal Beams
        for (let tier = 1; tier <= 3; tier++) {
          const tierY = tier * beamHeight;

          // Front & Rear Support Beams
          faces.push(
            ...createCuboidFaces(`bm-f-${aisle}-${bayIdx}-${tier}`, 'Load Beam (Front)', [bayX, tierY, z + 2.5], [rackBayWidth, 0.5, 0.5], beamColor),
            ...createCuboidFaces(`bm-r-${aisle}-${bayIdx}-${tier}`, 'Load Beam (Rear)', [bayX, tierY, z - 2.5], [rackBayWidth, 0.5, 0.5], beamColor)
          );

          // Pallet Slots in Bay (2 pallets per tier)
          const slotOffsets = [-2.2, 2.2];
          slotOffsets.forEach((slotX, slotIdx) => {
            const bayCode = `${aisle.charAt(0)}${bayIdx + 1}-${tier}-${slotIdx + 1}`;
            const velocityClass: 'A' | 'B' | 'C' =
              tier === 1 ? 'A' : tier === 2 ? 'B' : 'C';

            let palletColor =
              velocityClass === 'A'
                ? '#10b981' // Green for Fast-Moving Class A
                : velocityClass === 'B'
                ? '#38bdf8' // Cyan for Medium Class B
                : '#f59e0b'; // Amber for Slow-moving Class C

            const matchesFilter = highlightVelocity === 'all' || highlightVelocity === velocityClass;
            const opacity = matchesFilter ? 0.95 : 0.25;

            bays.push({
              id: `bay-${bayCode}`,
              bayCode,
              aisle,
              tier,
              sku: `SKU-LOG-${bayCode}`,
              velocityClass,
              weightLbs: 1850,
              isOccupied: true,
            });

            // 3D Palletized Unit Load
            faces.push(
              ...createCuboidFaces(
                `pallet-${bayCode}`,
                `Pallet Bay ${bayCode} (Class ${velocityClass})`,
                [bayX + slotX, tierY + 2.2, z],
                [3.8, 3.8, 4.2],
                palletColor,
                {
                  strokeColor: matchesFilter ? '#ffffff' : '#475569',
                  opacity,
                }
              )
            );
          });
        }
      }
    });
  }

  // 4. FORKLIFTS & AGV VEHICLES (Traffic aisle)
  if (showForklifts) {
    const forkX = -5;
    const forkZ = 12;

    // Forklift Chassis
    faces.push(
      ...createCuboidFaces('fork-body', 'Toyota Electric Forklift (3,500 lbs)', [forkX, 2.8, forkZ], [5.5, 3.8, 3.4], '#f59e0b', {
        strokeColor: '#d97706',
      })
    );
    // Overhead Guard
    faces.push(
      ...createCuboidFaces('fork-cage', 'ROPS Overhead Guard', [forkX, 6.2, forkZ], [3.2, 3.2, 3.2], '#1e293b', {
        isWireframe: true,
        strokeColor: '#38bdf8',
        strokeWidth: 2,
      })
    );
    // Mast & Lifting Forks
    faces.push(
      ...createCuboidFaces('fork-mast', 'Lifting Mast', [forkX + 3.2, 4.5, forkZ], [0.6, 7.5, 2.2], '#334155'),
      ...createCuboidFaces('fork-tines', 'Forks (Tines)', [forkX + 4.8, 0.8, forkZ], [2.8, 0.2, 1.8], '#94a3b8')
    );
  }

  return { faces, bays };
}

// -------------------------------------------------------------
// TECHNICAL BLUEPRINT LEADER LINES & RADAR CALLOUTS
// -------------------------------------------------------------

export function buildWarehouseBlueprintAnnotations(
  camera: CameraConfig
): {
  dimensionLines: DimensionLine2D[];
  technicalPins: TechnicalPin2D[];
} {
  const dimensionLines: DimensionLine2D[] = [];
  const technicalPins: TechnicalPin2D[] = [];

  const projectDimensionLine = (
    start3D: Vec3,
    end3D: Vec3,
    label: string,
    tickSizePx = 6
  ): DimensionLine2D => {
    const pStart = projectVec3(start3D, camera).pt;
    const pEnd = projectVec3(end3D, camera).pt;

    const dx = pEnd[0] - pStart[0];
    const dy = pEnd[1] - pStart[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    const perpX = len > 0 ? -dy / len : 0;
    const perpY = len > 0 ? dx / len : 0;

    return {
      id: `dim-${label.replace(/[^a-zA-Z0-9]/g, '')}`,
      label,
      start: pStart,
      end: pEnd,
      mid: [(pStart[0] + pEnd[0]) / 2, (pStart[1] + pEnd[1]) / 2],
      tickStart1: [pStart[0] + perpX * tickSizePx, pStart[1] + perpY * tickSizePx],
      tickStart2: [pStart[0] - perpX * tickSizePx, pStart[1] - perpY * tickSizePx],
      tickEnd1: [pEnd[0] + perpX * tickSizePx, pEnd[1] + perpY * tickSizePx],
      tickEnd2: [pEnd[0] - perpX * tickSizePx, pEnd[1] - perpY * tickSizePx],
    };
  };

  // Building Width Leader Line
  dimensionLines.push(
    projectDimensionLine([-32, 0, -22], [32, 0, -22], "SPAN: 64'0\" (19.5m)", 8)
  );

  // Building Depth Leader Line
  dimensionLines.push(
    projectDimensionLine([-33, 0, -22], [-33, 0, 22], "DEPTH: 44'0\" (13.4m)", 8)
  );

  // Pallet Rack Beam Clear Height
  dimensionLines.push(
    projectDimensionLine([-23, 0, -13], [-23, 16, -13], "CLEAR HT: 16'0\" (4.88m)", 6)
  );

  // Technical Pins
  const pin1 = projectVec3([0, 11, 21.5], camera).pt;
  technicalPins.push({
    id: 'pin-dock',
    label: 'Dock Door #2 (Air Seal)',
    category: 'Logistics',
    position: pin1,
    pinEnd: [pin1[0] - 50, pin1[1] - 40],
  });

  const pin2 = projectVec3([-18, 15, -10], camera).pt;
  technicalPins.push({
    id: 'pin-rack-a',
    label: 'Rack A1 (Fast Velocity)',
    category: 'Storage',
    position: pin2,
    pinEnd: [pin2[0] + 55, pin2[1] - 45],
  });

  const pin3 = projectVec3([-5, 5, 12], camera).pt;
  technicalPins.push({
    id: 'pin-fork',
    label: 'Toyota Electric Forklift',
    category: 'MHE',
    position: pin3,
    pinEnd: [pin3[0] + 50, pin3[1] + 35],
  });

  return { dimensionLines, technicalPins };
}
