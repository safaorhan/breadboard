import type { JumperDef } from './types'
import { getHolePosition, PITCH } from './board'

export const COPPER_COLOR = '#b87333'
export const TOLERANCE    = 0.5    // ±0.5 pitch units

export function matchJumper(from: string, to: string, library: JumperDef[]): JumperDef | null {
  if (!library.length) return null
  const p1  = getHolePosition(from)
  const p2  = getHolePosition(to)
  const len = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2) / PITCH
  let best: JumperDef | null = null
  let bestDiff = Infinity
  for (const j of library) {
    if (j.pitch <= 0) continue
    const diff = Math.abs(len - j.pitch)
    if (diff <= TOLERANCE && diff < bestDiff) { bestDiff = diff; best = j }
  }
  return best
}

export function wireColor(from: string, to: string, library: JumperDef[]): string {
  return matchJumper(from, to, library)?.color ?? COPPER_COLOR
}
