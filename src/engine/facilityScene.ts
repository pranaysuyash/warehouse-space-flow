import type { Coordinates2D, Facility, LocationSlot } from './types';
import { createCuboidFaces, type Face3D, type Vec3 } from './warehouseIsometric';

export interface FacilitySceneSlot { slot: LocationSlot; position: Vec3 }
export interface FacilityScene {
  faces: Face3D[];
  slots: FacilitySceneSlot[];
  faceSlotIds: Map<string, string>;
  invalidSlotIds: string[];
}

function validRect(rect: Coordinates2D | undefined): rect is Coordinates2D {
  return !!rect && [rect.x, rect.y, rect.width, rect.height, rect.x + rect.width, rect.y + rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0 && rect.x + rect.width > rect.x && rect.y + rect.height > rect.y;
}

/** Projects the facility's 2D canvas positions into a schematic volume, not surveyed geometry. */
export function buildFacilityScene(facility: Facility, layers: { showRacks: boolean; showDocks: boolean }): FacilityScene {
  const zones = Array.isArray(facility.zones) ? facility.zones : [];
  const allSlots = zones.flatMap(zone => Array.isArray(zone.slots) ? zone.slots : []);
  const visible = allSlots.filter(slot => (layers.showRacks || slot.type !== 'rack_bin') && (layers.showDocks || slot.type !== 'dock_door'));
  const invalidSlotIds = visible.filter(slot => !validRect(slot.canvasCoords)).map(slot => slot.id);
  const validSlots = visible.filter(slot => validRect(slot.canvasCoords));
  // Use all facility locations for the extent so layer switches do not move the scene.
  const rects = [...zones.map(zone => zone.canvasBounds), ...allSlots.map(slot => slot.canvasCoords)].filter(validRect);
  const bounds = rects.reduce((b, rect) => ({ minX: Math.min(b.minX, rect.x), minY: Math.min(b.minY, rect.y), maxX: Math.max(b.maxX, rect.x + rect.width), maxY: Math.max(b.maxY, rect.y + rect.height) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  if (!rects.length) return { faces: [], slots: [], faceSlotIds: new Map(), invalidSlotIds };
  const extentX = bounds.maxX - bounds.minX;
  const extentY = bounds.maxY - bounds.minY;
  if (!Number.isFinite(extentX) || !Number.isFinite(extentY) || extentX <= 0 || extentY <= 0) return { faces: [], slots: [], faceSlotIds: new Map(), invalidSlotIds: visible.map(slot => slot.id) };
  const scale = 58 / Math.max(extentX, extentY);
  const mapRect = (rect: Coordinates2D) => ({ x: (rect.x + rect.width / 2 - (bounds.minX + bounds.maxX) / 2) * scale, z: (rect.y + rect.height / 2 - (bounds.minY + bounds.maxY) / 2) * scale, width: rect.width * scale, depth: rect.height * scale });
  const faces: Face3D[] = createCuboidFaces('facility-floor', 'Facility workspace', [0, -0.25, 0], [extentX * scale + 2, 0.5, extentY * scale + 2], '#1e293b');
  const faceSlotIds = new Map<string, string>();
  const slots: FacilitySceneSlot[] = [];
  const statusColor: Record<LocationSlot['status'], string> = { available: '#64748b', occupied: '#10b981', reserved_inbound: '#38bdf8', blocked: '#ef4444', quarantined: '#f59e0b' };
  for (const [index, slot] of validSlots.entries()) {
    const rect = mapRect(slot.canvasCoords);
    const level = slot.type === 'rack_bin' && Number.isInteger(slot.level) && slot.level! > 0 ? Math.min(slot.level!, 20) : 1;
    const height = slot.type === 'rack_bin' ? 1.25 : 0.5;
    const position: Vec3 = [rect.x, slot.type === 'rack_bin' ? (level - 1) * 1.5 + height / 2 : height / 2, rect.z];
    const slotFaces = createCuboidFaces(`facility-slot-${index}`, `Location ${slot.code}`, position, [Math.max(0.1, rect.width), height, Math.max(0.1, rect.depth)], statusColor[slot.status] ?? '#64748b', { strokeColor: '#cbd5e1', opacity: 0.9 });
    for (const face of slotFaces) faceSlotIds.set(face.id, slot.id);
    faces.push(...slotFaces);
    slots.push({ slot, position });
  }
  return { faces, slots, faceSlotIds, invalidSlotIds };
}
