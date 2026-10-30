import { describe, it, expect } from 'vitest';
import {
  type CameraConfig,
  projectVec3,
  computeFaceNormal,
  calculateWindingArea2D,
  shadeHexColor,
  createCuboidFaces,
  buildWarehouseScene,
  projectSceneFaces,
  buildWarehouseBlueprintAnnotations,
} from '../src/engine/warehouseIsometric';

describe('Product 06 — Warehouse Space & Flow Pure-Vector 3D Engine', () => {
  const defaultCamera: CameraConfig = {
    azimuthDeg: 40,
    elevationDeg: 32,
    scale: 10.0,
    originX: 470,
    originY: 260,
    centerTarget: [0, 4, 2],
    lightAzimuthDeg: 55,
    lightElevationDeg: 45,
    ambientLight: 0.4,
    enableBackfaceCulling: true,
    renderMode: 'shaded',
  };

  it('projects 3D warehouse world coordinates into 2D SVG canvas points', () => {
    const origin = projectVec3([0, 0, 0], defaultCamera);
    const corner = projectVec3([32, 0, 22], defaultCamera);
    expect(origin.pt).toHaveLength(2);
    expect(typeof origin.pt[0]).toBe('number');
    expect(typeof origin.pt[1]).toBe('number');
    expect(corner.pt[0]).not.toBe(origin.pt[0]);
  });

  it('computes 3D face normals and 2D winding area for backface culling', () => {
    const normal = computeFaceNormal([
      [0, 0, 0],
      [10, 0, 0],
      [0, 10, 0],
    ]);
    expect(normal[2]).toBeCloseTo(1, 2);

    const ccw = calculateWindingArea2D([[0, 0], [10, 0], [0, 10]]);
    expect(ccw).toBeGreaterThan(0);
  });

  it('applies directional lighting shading to warehouse surfaces', () => {
    const illuminated = shadeHexColor('#0284c7', 1.0);
    const shaded = shadeHexColor('#0284c7', 0.6);
    expect(illuminated.toLowerCase()).toBe('#0284c7');
    expect(shaded).not.toBe(illuminated);
  });

  it('creates 6 cuboid faces with properly oriented vertices and normals', () => {
    const faces = createCuboidFaces('test-cube', 'Test Cube', [0, 0, 0], [2, 2, 2], '#38bdf8');
    expect(faces.length).toBe(6);
    expect(faces.every((f: { vertices: unknown[] }) => f.vertices.length === 4)).toBe(true);
  });

  it('builds warehouse facility scene with pallet racks, dock staging, and MHE forklifts', () => {
    const { faces, bays } = buildWarehouseScene(true, true, true, 'all');

    expect(faces.length).toBeGreaterThan(100);
    expect(bays.length).toBe(48); // 2 aisles x 4 bays x 3 tiers x 2 pallets = 48 bays
    expect(bays.every((b) => b.isOccupied)).toBe(true);

    const classABays = bays.filter((b) => b.velocityClass === 'A');
    expect(classABays.length).toBe(16);
  });

  it('filters pallet velocity classes (A, B, C) with visual opacity attenuation', () => {
    const sceneFilteredA = buildWarehouseScene(true, true, true, 'A');
    const classAFace = sceneFilteredA.faces.find((f) => f.id.includes('pallet-A1-1-1-top'));
    const classCFace = sceneFilteredA.faces.find((f) => f.id.includes('pallet-A1-3-1-top'));

    expect(classAFace?.opacity).toBe(0.95);
    expect(classCFace?.opacity).toBe(0.25);
  });

  it('depth-sorts all projected faces using Painter algorithm for artifact-free rendering', () => {
    const { faces } = buildWarehouseScene(true, true, true, 'all');
    const projected = projectSceneFaces(faces, defaultCamera);

    expect(projected.length).toBeGreaterThan(50);
    for (let i = 0; i < projected.length - 1; i++) {
      expect(projected[i].depth).toBeLessThanOrEqual(projected[i + 1].depth);
    }
  });

  it('generates technical blueprint dimension lines and inspection pins', () => {
    const annotations = buildWarehouseBlueprintAnnotations(defaultCamera);

    expect(annotations.dimensionLines.length).toBeGreaterThanOrEqual(3);
    expect(annotations.technicalPins.length).toBeGreaterThanOrEqual(3);
    expect(annotations.dimensionLines.some((d) => d.label.includes('SPAN'))).toBe(true);
  });
});
