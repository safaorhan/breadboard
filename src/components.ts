import type { ComponentDef, PlacedComponent, PinDef } from './types'
import { ROW_Y_UNITS, rowFromYUnit } from './board'

export function getComponentPinHole(placed: PlacedComponent, pin: PinDef, def: ComponentDef): string {
  const anchorYUnit = ROW_Y_UNITS[placed.anchorRow]
  const col     = placed.rotated ? (def.colSpan - 1 - pin.col)          : pin.col
  const rowSide = placed.rotated ? (pin.row === 'top' ? 'bottom' : 'top') : pin.row
  const targetYUnit = rowSide === 'top' ? anchorYUnit : anchorYUnit + def.rowSpan
  const row = rowFromYUnit(targetYUnit) ?? ''
  return `${row}${placed.anchorCol + col}`
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

// ESP32-WROOM-32 DevKit v1 (38-pin, 19 per side, USB at bottom)
// rowSpan=9: anchored at B → pins reach I (y-unit 4+9=13)
// Source: Espressif official DevKitC-32 pinout
const ESP32_WROOM32: ComponentDef = {
  id: 'preset-esp32-wroom32',
  name: 'ESP32-WROOM-32',
  colSpan: 19,
  rowSpan: 9,
  pins: [
    // Top row (left side, col 0–18)
    { name: '3V3',    col: 0,  row: 'top' },
    { name: 'EN',     col: 1,  row: 'top' },
    { name: 'VP/36',  col: 2,  row: 'top' },
    { name: 'VN/39',  col: 3,  row: 'top' },
    { name: 'IO34',   col: 4,  row: 'top' },
    { name: 'IO35',   col: 5,  row: 'top' },
    { name: 'IO32',   col: 6,  row: 'top' },
    { name: 'IO33',   col: 7,  row: 'top' },
    { name: 'IO25',   col: 8,  row: 'top' },
    { name: 'IO26',   col: 9,  row: 'top' },
    { name: 'IO27',   col: 10, row: 'top' },
    { name: 'IO14',   col: 11, row: 'top' },
    { name: 'IO12',   col: 12, row: 'top' },
    { name: 'GND',    col: 13, row: 'top' },
    { name: 'IO13',   col: 14, row: 'top' },
    { name: 'SD2/9',  col: 15, row: 'top' },
    { name: 'SD3/10', col: 16, row: 'top' },
    { name: 'CMD/11', col: 17, row: 'top' },
    { name: 'VIN',    col: 18, row: 'top' },
    // Bottom row (right side, col 0–18)
    { name: 'GND',    col: 0,  row: 'bottom' },
    { name: 'IO23',   col: 1,  row: 'bottom' },
    { name: 'IO22',   col: 2,  row: 'bottom' },
    { name: 'TX0/1',  col: 3,  row: 'bottom' },
    { name: 'RX0/3',  col: 4,  row: 'bottom' },
    { name: 'IO21',   col: 5,  row: 'bottom' },
    { name: 'GND',    col: 6,  row: 'bottom' },
    { name: 'IO19',   col: 7,  row: 'bottom' },
    { name: 'IO18',   col: 8,  row: 'bottom' },
    { name: 'IO5',    col: 9,  row: 'bottom' },
    { name: 'TX2/17', col: 10, row: 'bottom' },
    { name: 'RX2/16', col: 11, row: 'bottom' },
    { name: 'IO4',    col: 12, row: 'bottom' },
    { name: 'IO0',    col: 13, row: 'bottom' },
    { name: 'IO2',    col: 14, row: 'bottom' },
    { name: 'IO15',   col: 15, row: 'bottom' },
    { name: 'SD1/8',  col: 16, row: 'bottom' },
    { name: 'SD0/7',  col: 17, row: 'bottom' },
    { name: 'CLK/6',  col: 18, row: 'bottom' },
  ],
}

// TXS0108E 8-bit bidirectional level shifter (SparkFun/generic breakout)
// rowSpan=3: standard DIP-style straddling center channel (E→F = y-unit 7+3=10 ✓)
// Source: TI TXS0108E datasheet + SparkFun BOB-11771 hookup guide
const TXS0108E: ComponentDef = {
  id: 'preset-txs0108e',
  name: 'TXS0108E',
  colSpan: 10,
  rowSpan: 3,
  pins: [
    // A-side (low-voltage), col 0–9
    { name: 'OE',   col: 0, row: 'top' },
    { name: 'VCCA', col: 1, row: 'top' },
    { name: 'A1',   col: 2, row: 'top' },
    { name: 'A2',   col: 3, row: 'top' },
    { name: 'A3',   col: 4, row: 'top' },
    { name: 'A4',   col: 5, row: 'top' },
    { name: 'A5',   col: 6, row: 'top' },
    { name: 'A6',   col: 7, row: 'top' },
    { name: 'A7',   col: 8, row: 'top' },
    { name: 'A8',   col: 9, row: 'top' },
    // B-side (high-voltage), col 0–9
    { name: 'GND',  col: 0, row: 'bottom' },
    { name: 'VCCB', col: 1, row: 'bottom' },
    { name: 'B1',   col: 2, row: 'bottom' },
    { name: 'B2',   col: 3, row: 'bottom' },
    { name: 'B3',   col: 4, row: 'bottom' },
    { name: 'B4',   col: 5, row: 'bottom' },
    { name: 'B5',   col: 6, row: 'bottom' },
    { name: 'B6',   col: 7, row: 'bottom' },
    { name: 'B7',   col: 8, row: 'bottom' },
    { name: 'B8',   col: 9, row: 'bottom' },
  ],
}

export const PRESET_LIBRARY: ComponentDef[] = [ESP32, ESP32_WROOM32, TXS0108E]
