export const SVG_NS = 'http://www.w3.org/2000/svg'
export const PITCH = 12
export const HOLE_RADIUS = 3.5
export const MARGIN_LEFT = 40
export const MARGIN_TOP = 20
export const MARGIN_RIGHT = 20
export const MARGIN_BOTTOM = 20
export const BOARD_COLS = 63

export const TOP_ROWS = ['A', 'B', 'C', 'D', 'E'] as const
export const BOTTOM_ROWS = ['F', 'G', 'H', 'I', 'J'] as const
export const ALL_ROWS = [...TOP_ROWS, ...BOTTOM_ROWS] as const
export const RAIL_NAMES = ['top+', 'top-', 'bottom+', 'bottom-'] as const

export type RowName = typeof ALL_ROWS[number]
export type RailName = typeof RAIL_NAMES[number]

export const ROW_Y_UNITS: Record<string, number> = {
  'top+':    0,
  'top-':    1,
  'A':       3,
  'B':       4,
  'C':       5,
  'D':       6,
  'E':       7,
  'F':       9,
  'G':      10,
  'H':      11,
  'I':      12,
  'J':      13,
  'bottom+': 15,
  'bottom-': 16,
}

export const SVG_WIDTH  = MARGIN_LEFT + BOARD_COLS * PITCH + MARGIN_RIGHT
export const SVG_HEIGHT = MARGIN_TOP  + 17 * PITCH + MARGIN_BOTTOM

export function holeExists(address: string): boolean {
  if (address.includes(':')) {
    const colon = address.lastIndexOf(':')
    const rail = address.slice(0, colon)
    const col  = parseInt(address.slice(colon + 1), 10)
    return (RAIL_NAMES as readonly string[]).includes(rail)
      && col >= 1 && col <= BOARD_COLS
  }
  const row = address[0]
  const col = parseInt(address.slice(1), 10)
  return (ALL_ROWS as readonly string[]).includes(row)
    && col >= 1 && col <= BOARD_COLS
}

export function getHolePosition(address: string): { x: number; y: number } {
  if (address.includes(':')) {
    const colon = address.lastIndexOf(':')
    const rail  = address.slice(0, colon)
    const col   = parseInt(address.slice(colon + 1), 10)
    return {
      x: MARGIN_LEFT + (col - 1) * PITCH,
      y: MARGIN_TOP  + ROW_Y_UNITS[rail] * PITCH,
    }
  }
  const row = address[0]
  const col = parseInt(address.slice(1), 10)
  return {
    x: MARGIN_LEFT + (col - 1) * PITCH,
    y: MARGIN_TOP  + ROW_Y_UNITS[row] * PITCH,
  }
}

export function getInternalGroups(): string[][] {
  const groups: string[][] = []

  for (let col = 1; col <= BOARD_COLS; col++) {
    groups.push(TOP_ROWS.map(r => `${r}${col}`))
    groups.push(BOTTOM_ROWS.map(r => `${r}${col}`))
  }

  for (const rail of RAIL_NAMES) {
    const holes: string[] = []
    for (let col = 1; col <= BOARD_COLS; col++) {
      holes.push(`${rail}:${col}`)
    }
    groups.push(holes)
  }

  return groups
}

export function rowFromYUnit(yUnit: number): string | undefined {
  return Object.entries(ROW_Y_UNITS)
    .find(([key, u]) => u === yUnit && key.length === 1)?.[0]
}

export function snapToHole(svgX: number, svgY: number): string | null {
  const col = Math.round((svgX - MARGIN_LEFT) / PITCH) + 1
  if (col < 1 || col > BOARD_COLS) return null

  let bestKey: string | null = null
  let bestDist = Infinity

  for (const [key, yUnit] of Object.entries(ROW_Y_UNITS)) {
    const holeY = MARGIN_TOP + yUnit * PITCH
    const dist  = Math.abs(svgY - holeY)
    if (dist < bestDist) {
      bestDist = dist
      bestKey  = key
    }
  }

  if (!bestKey || bestDist > PITCH / 2) return null

  if ((RAIL_NAMES as readonly string[]).includes(bestKey)) {
    return `${bestKey}:${col}`
  }
  return `${bestKey}${col}`
}
