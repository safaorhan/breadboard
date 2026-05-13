import type { AppState, ComponentDef, JumperSet, PlacedComponent, PinDef } from './types'
import { ROW_Y_UNITS, rowFromYUnit } from './board'

export function getComponentPinHole(placed: PlacedComponent, pin: PinDef, def: ComponentDef): string {
  const anchorYUnit = ROW_Y_UNITS[placed.anchorRow]
  const col     = placed.rotated ? (def.colSpan - 1 - pin.col)          : pin.col
  const rowSide = placed.rotated ? (pin.row === 'top' ? 'bottom' : 'top') : pin.row
  const targetYUnit = rowSide === 'top' ? anchorYUnit : anchorYUnit + def.rowSpan
  const row = rowFromYUnit(targetYUnit) ?? ''
  return `${row}${placed.anchorCol + col}`
}

// Auto-imported from lib/components/*.json — add a JSON file there to contribute a new preset.
const componentModules = import.meta.glob('../lib/components/*.json', { eager: true })
export const PRESET_LIBRARY: ComponentDef[] =
  Object.values(componentModules).map(m => (m as { default: ComponentDef }).default)

// Auto-imported from lib/jumper-sets/*.json — each file is one JumperSet (kit).
const jumperSetModules = import.meta.glob('../lib/jumper-sets/*.json', { eager: true })
export const PRESET_JUMPER_LIBRARY: JumperSet[] =
  Object.values(jumperSetModules).map(m => (m as { default: JumperSet }).default)

export function getAllOccupiedHoles(state: AppState, excludeComponentId?: string): Set<string> {
  const occupied = new Set<string>()
  for (const wire of state.wires) {
    occupied.add(wire.from)
    occupied.add(wire.to)
  }
  for (const placed of state.placedComponents) {
    if (placed.id === excludeComponentId) continue
    const def = state.componentLibrary.find(d => d.id === placed.defId)
    if (!def) continue
    for (const pin of def.pins) {
      if (pin.name === '*') continue
      occupied.add(getComponentPinHole(placed, pin, def))
    }
  }
  return occupied
}
