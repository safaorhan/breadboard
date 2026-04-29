import type { ComponentDef, PlacedComponent, PinDef } from './types'

export const PRESET_LIBRARY: ComponentDef[] = []

export function getComponentPinHole(placed: PlacedComponent, pin: PinDef): string {
  const col = placed.anchorCol + pin.col
  const row = pin.row === 'top' ? 'E' : 'F'
  return `${row}${col}`
}
