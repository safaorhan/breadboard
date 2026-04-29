import type { ComponentDef, PlacedComponent, PinDef } from './types'
import { ROW_Y_UNITS, rowFromYUnit } from './board'

export function getComponentPinHole(placed: PlacedComponent, pin: PinDef, def: ComponentDef): string {
  const anchorYUnit = ROW_Y_UNITS[placed.anchorRow]
  const targetYUnit = pin.row === 'top' ? anchorYUnit : anchorYUnit + def.rowSpan
  const row = rowFromYUnit(targetYUnit) ?? ''
  return `${row}${placed.anchorCol + pin.col}`
}

// colSpan=10, rowSpan=9: spans columns 1-10, rows A-H / B-I / C-J
// rowSpan = 9: e.g. B(y-unit 4) → I(y-unit 13), difference = 9 (2-unit center gap included)
const ESP32: ComponentDef = {
  id: 'preset-esp32',
  name: 'ESP32',
  colSpan: 10,
  rowSpan: 9,
  pins: [
    { name: 'GND',  col: 0, row: 'top' },
    { name: '3V3',  col: 1, row: 'top' },
    { name: 'EN',   col: 2, row: 'top' },
    { name: 'VP',   col: 3, row: 'top' },
    { name: 'VN',   col: 4, row: 'top' },
    { name: 'D34',  col: 5, row: 'top' },
    { name: 'D35',  col: 6, row: 'top' },
    { name: 'D32',  col: 7, row: 'top' },
    { name: 'D33',  col: 8, row: 'top' },
    { name: 'D25',  col: 9, row: 'top' },
    { name: 'VIN',  col: 0, row: 'bottom' },
    { name: 'GND2', col: 1, row: 'bottom' },
    { name: 'D23',  col: 2, row: 'bottom' },
    { name: 'D22',  col: 3, row: 'bottom' },
    { name: 'TX0',  col: 4, row: 'bottom' },
    { name: 'RX0',  col: 5, row: 'bottom' },
    { name: 'D21',  col: 6, row: 'bottom' },
    { name: 'D19',  col: 7, row: 'bottom' },
    { name: 'D18',  col: 8, row: 'bottom' },
    { name: 'D5',   col: 9, row: 'bottom' },
  ],
}

export const PRESET_LIBRARY: ComponentDef[] = [ESP32]
