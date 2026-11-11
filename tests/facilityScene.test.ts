import { describe, expect, it } from 'vitest';
import { createCanonicalFacility } from '../src/engine/spatialModel';
import { buildFacilityScene } from '../src/engine/facilityScene';
import { projectSceneFaces, type CameraConfig } from '../src/engine/warehouseIsometric';

describe('facility-based 3D scene', () => {
  it('renders actual workspace slot identities and statuses rather than sample bays', () => {
    const facility = createCanonicalFacility();
    const scene = buildFacilityScene(facility, { showRacks: true, showDocks: true });
    const slots = facility.zones.flatMap(zone => zone.slots);
    expect(scene.slots.map(item => item.slot.id)).toEqual(slots.map(slot => slot.id));
    expect(scene.faces.some(face => face.partName.includes(slots[0].code))).toBe(true);
    expect(scene.faces.some(face => /SKU-LOG|Toyota Electric Forklift/.test(face.partName))).toBe(false);
    expect(scene.slots.find(item => item.slot.id === slots[0].id)?.slot.status).toBe(slots[0].status);
  });

  it('uses updated workspace coordinates and respects location layer visibility', () => {
    const facility = createCanonicalFacility();
    const first = buildFacilityScene(facility, { showRacks: true, showDocks: true });
    const moved = structuredClone(facility);
    moved.zones[0].slots[0].canvasCoords.x += 50;
    const after = buildFacilityScene(moved, { showRacks: true, showDocks: true });
    expect(after.slots[0].position).not.toEqual(first.slots[0].position);
    const hidden = buildFacilityScene(facility, { showRacks: false, showDocks: false });
    expect(hidden.slots.some(item => item.slot.type === 'rack_bin' || item.slot.type === 'dock_door')).toBe(false);
  });

  it('reports locations with unusable canvas geometry without fabricating positions', () => {
    const facility = createCanonicalFacility();
    facility.zones[0].slots[0].canvasCoords.width = 0;
    const scene = buildFacilityScene(facility, { showRacks: true, showDocks: true });
    expect(scene.invalidSlotIds).toContain(facility.zones[0].slots[0].id);
    expect(scene.slots.some(item => item.slot.id === facility.zones[0].slots[0].id)).toBe(false);
  });

  it('does not generate infinite coordinates when facility geometry overflows', () => {
    const facility = createCanonicalFacility();
    facility.zones[0].slots[0].canvasCoords.x = 1e308;
    facility.zones[0].slots[0].canvasCoords.width = 1e308;
    const scene = buildFacilityScene(facility, { showRacks: true, showDocks: true });
    expect(scene.invalidSlotIds).toContain(facility.zones[0].slots[0].id);
    expect(scene.faces.flatMap(face => face.vertices.flat()).every(Number.isFinite)).toBe(true);
  });

  it('places the standard facility within the initial 3D viewport', () => {
    const camera: CameraConfig = { azimuthDeg: 40, elevationDeg: 32, scale: 9.8, originX: 470, originY: 260, centerTarget: [0, 4, 2], lightAzimuthDeg: 55, lightElevationDeg: 45, ambientLight: 0.38, enableBackfaceCulling: true, renderMode: 'shaded' };
    const projected = projectSceneFaces(buildFacilityScene(createCanonicalFacility(), { showRacks: true, showDocks: true }).faces, camera);
    const points = projected.flatMap(face => face.points);
    expect(points.length).toBeGreaterThan(0);
    expect(points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 940 && y >= 0 && y <= 500)).toBe(true);
  });
});
