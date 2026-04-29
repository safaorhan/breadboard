import type { ComponentDef, PlacedComponent, PinDef } from './types'

export function getComponentPinHole(placed: PlacedComponent, pin: PinDef): string {
  return `${pin.row}${placed.anchorCol + pin.col}`
}

// ESP32-WROOM-32 DevKit v1 (30-pin, 15 per side, 15 columns wide)
// Top row (row E): left side of chip, left-to-right
// Bottom row (row F): right side of chip, left-to-right
const ESP32: ComponentDef = {
  id: 'preset-esp32',
  name: 'ESP32',
  colSpan: 15,
  pins: [
    { name: 'GND',  col: 0,  row: 'E' },
    { name: '3V3',  col: 1,  row: 'E' },
    { name: 'EN',   col: 2,  row: 'E' },
    { name: 'VP',   col: 3,  row: 'E' },
    { name: 'VN',   col: 4,  row: 'E' },
    { name: 'D34',  col: 5,  row: 'E' },
    { name: 'D35',  col: 6,  row: 'E' },
    { name: 'D32',  col: 7,  row: 'E' },
    { name: 'D33',  col: 8,  row: 'E' },
    { name: 'D25',  col: 9,  row: 'E' },
    { name: 'D26',  col: 10, row: 'E' },
    { name: 'D27',  col: 11, row: 'E' },
    { name: 'D14',  col: 12, row: 'E' },
    { name: 'D12',  col: 13, row: 'E' },
    { name: 'D13',  col: 14, row: 'E' },
    { name: 'VIN',  col: 0,  row: 'F' },
    { name: 'GND2', col: 1,  row: 'F' },
    { name: 'D23',  col: 2,  row: 'F' },
    { name: 'D22',  col: 3,  row: 'F' },
    { name: 'TX0',  col: 4,  row: 'F' },
    { name: 'RX0',  col: 5,  row: 'F' },
    { name: 'D21',  col: 6,  row: 'F' },
    { name: 'D19',  col: 7,  row: 'F' },
    { name: 'D18',  col: 8,  row: 'F' },
    { name: 'D5',   col: 9,  row: 'F' },
    { name: 'D17',  col: 10, row: 'F' },
    { name: 'D16',  col: 11, row: 'F' },
    { name: 'D4',   col: 12, row: 'F' },
    { name: 'D0',   col: 13, row: 'F' },
    { name: 'D15',  col: 14, row: 'F' },
  ],
}

export const PRESET_LIBRARY: ComponentDef[] = [ESP32]
