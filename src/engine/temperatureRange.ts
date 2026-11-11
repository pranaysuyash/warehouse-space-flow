export interface TemperatureRange { min: number; max: number }

/** The modeled maintained interval must be wholly inside the commodity interval. */
export function isValidTemperatureRange(range: TemperatureRange): boolean {
  return Number.isFinite(range.min) && Number.isFinite(range.max) && range.min <= range.max;
}

export function maintainedRangeFits(item: TemperatureRange, slot: TemperatureRange): boolean {
  return isValidTemperatureRange(item) && isValidTemperatureRange(slot) && slot.min >= item.min && slot.max <= item.max;
}
