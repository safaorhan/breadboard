import type { ComponentDef, PlacedComponent, PinDef } from './types'
import { ROW_Y_UNITS, rowFromYUnit } from './board'

export function getComponentPinHole(placed: PlacedComponent, pin: PinDef, def: ComponentDef): string {
  const anchorYUnit = ROW_Y_UNITS[placed.anchorRow]
  const targetYUnit = pin.row === 'top' ? anchorYUnit : anchorYUnit + def.rowSpan
  const row = rowFromYUnit(targetYUnit) ?? ''
  return `${row}${placed.anchorCol + pin.col}`
}

// ESP32-WROOM-32 DevKit v1 (30-pin, 15 per side, 15 columns wide)
// rowSpan = 8: B(y-unit 4) → I(y-unit 12), difference = 8
// Place with anchorRow='B' to land top pins at B and bottom pins at I
const ESP32: ComponentDef = {
  id: 'preset-esp32',
  name: 'ESP32',
  colSpan: 15,
  rowSpan: 8,
  pins: [
    { name: 'GND',  col: 0,  row: 'top' },
    { name: '3V3',  col: 1,  row: 'top' },
    { name: 'EN',   col: 2,  row: 'top' },
    { name: 'VP',   col: 3,  row: 'top' },
    { name: 'VN',   col: 4,  row: 'top' },
    { name: 'D34',  col: 5,  row: 'top' },
    { name: 'D35',  col: 6,  row: 'top' },
    { name: 'D32',  col: 7,  row: 'top' },
    { name: 'D33',  col: 8,  row: 'top' },
    { name: 'D25',  col: 9,  row: 'top' },
    { name: 'D26',  col: 10, row: 'top' },
    { name: 'D27',  col: 11, row: 'top' },
    { name: 'D14',  col: 12, row: 'top' },
    { name: 'D12',  col: 13, row: 'top' },
    { name: 'D13',  col: 14, row: 'top' },
    { name: 'VIN',  col: 0,  row: 'bottom' },
    { name: 'GND2', col: 1,  row: 'bottom' },
    { name: 'D23',  col: 2,  row: 'bottom' },
    { name: 'D22',  col: 3,  row: 'bottom' },
    { name: 'TX0',  col: 4,  row: 'bottom' },
    { name: 'RX0',  col: 5,  row: 'bottom' },
    { name: 'D21',  col: 6,  row: 'bottom' },
    { name: 'D19',  col: 7,  row: 'bottom' },
    { name: 'D18',  col: 8,  row: 'bottom' },
    { name: 'D5',   col: 9,  row: 'bottom' },
    { name: 'D17',  col: 10, row: 'bottom' },
    { name: 'D16',  col: 11, row: 'bottom' },
    { name: 'D4',   col: 12, row: 'bottom' },
    { name: 'D0',   col: 13, row: 'bottom' },
    { name: 'D15',  col: 14, row: 'bottom' },
  ],
}

export const PRESET_LIBRARY: ComponentDef[] = [ESP32]
