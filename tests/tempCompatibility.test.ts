import { describe, it, expect } from 'vitest';
import { checkSlotSuitability, defaultTempRangeForClass } from '../src/engine/putawayEngine';

describe('P06 Temperature Compatibility', () => {
  it('default ranges: frozen is cold', () => {
    expect(defaultTempRangeForClass('frozen').max).toBeLessThanOrEqual(5);
  });

  it('rejects frozen cargo in 34F chilled room', () => {
    const slot: any = { id: 'C1', code: 'C1', zoneId: 'Z', type: 'floor_bulk', canvasCoords: {x:0,y:0,width:1,height:1}, dimensions: {lengthIn:48,widthIn:40,heightIn:84}, maxWeightLbs: 3500, allowedClasses: ['chilled','frozen'], groundOnlyAllowed: true, status: 'available', temperatureRangeF: { min: 32, max: 38 } };
    const item: any = { environmentalClass: 'frozen', packageType: 'pallet', weightLbs: 1000, dimensions: { lengthIn: 48, widthIn: 40, heightIn: 48 }, groundOnly: true };
    const r = checkSlotSuitability(item, slot);
    expect(r.compatible).toBe(false);
    expect(r.violation).toContain('temperature mismatch');
  });

  it('accepts chilled cargo in 34F room', () => {
    const slot: any = { id: 'C2', code: 'C2', zoneId: 'Z', type: 'floor_bulk', canvasCoords: {x:0,y:0,width:1,height:1}, dimensions: {lengthIn:48,widthIn:40,heightIn:84}, maxWeightLbs: 3500, allowedClasses: ['chilled','frozen'], groundOnlyAllowed: true, status: 'available', temperatureRangeF: { min: 34, max: 38 } };
    const item: any = { environmentalClass: 'chilled', packageType: 'pallet', weightLbs: 1000, dimensions: { lengthIn: 48, widthIn: 40, heightIn: 48 }, groundOnly: true };
    const r = checkSlotSuitability(item, slot);
    expect(r.compatible).toBe(true);
  });

  it('requires the entire maintained interval to fit within the declared commodity range', () => {
    const slot: any = { id: 'C', code: 'C', zoneId: 'Z', type: 'floor_bulk', canvasCoords: {x:0,y:0,width:1,height:1}, dimensions: {lengthIn:48,widthIn:40,heightIn:84}, maxWeightLbs: 3500, allowedClasses: ['chilled'], groundOnlyAllowed: true, status: 'available', temperatureRangeF: { min: 32, max: 38 } };
    const item: any = { environmentalClass: 'chilled', storageTempRangeF: {min: 34, max: 40}, packageType: 'pallet', weightLbs: 1000, dimensions: { lengthIn: 48, widthIn: 40, heightIn: 48 }, groundOnly: true };
    expect(checkSlotSuitability(item, slot).compatible).toBe(false);
    expect(checkSlotSuitability(item, {...slot, temperatureRangeF: { min: 34, max: 40 }}).compatible).toBe(true);
    expect(checkSlotSuitability(item, {...slot, temperatureRangeF: undefined}).compatible).toBe(false);
    expect(checkSlotSuitability(item, {...slot, temperatureRangeF: { min: 38, max: 32 }}).compatible).toBe(false);
    expect(checkSlotSuitability({...item, storageTempRangeF: { min: NaN, max: 40 }}, slot).compatible).toBe(false);
  });

  it('skips temperature check when slot has no range', () => {
    const slot: any = { id: 'B1', code: 'B1', zoneId: 'Z', type: 'floor_bulk', canvasCoords: {x:0,y:0,width:1,height:1}, dimensions: {lengthIn:96,widthIn:96,heightIn:180}, maxWeightLbs: 8500, allowedClasses: ['ambient'], groundOnlyAllowed: true, status: 'available' };
    const item: any = { environmentalClass: 'ambient', packageType: 'pallet', weightLbs: 1000, dimensions: { lengthIn: 48, widthIn: 40, heightIn: 48 }, groundOnly: true };
    const r = checkSlotSuitability(item, slot);
    expect(r.compatible).toBe(true);
    expect(r.reasons.join(' ')).toContain('not declared');
  });
});
