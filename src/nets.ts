import type { AppState } from './types'
import { getInternalGroups } from './board'
import { getComponentPinHole } from './components'

export interface PinRef {
  componentId: string
  componentName: string
  pinName: string
  hole: string
}

export interface Net {
  root: string
  pins: PinRef[]
}

class UnionFind {
  private parent = new Map<string, string>()

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x)
    const p = this.parent.get(x)!
    if (p !== x) {
      const root = this.find(p)
      this.parent.set(x, root)
      return root
    }
    return x
  }

  union(x: string, y: string): void {
    const rx = this.find(x)
    const ry = this.find(y)
    if (rx !== ry) this.parent.set(rx, ry)
  }
}

export function analyzeNets(state: AppState): Net[] {
  const uf = new UnionFind()

  for (const group of getInternalGroups()) {
    for (let i = 1; i < group.length; i++) {
      uf.union(group[0], group[i])
    }
  }

  for (const wire of state.wires) {
    uf.union(wire.from, wire.to)
  }

  const netMap = new Map<string, PinRef[]>()

  for (const placed of state.placedComponents) {
    const def = state.componentLibrary.find(d => d.id === placed.defId)
    if (!def) continue
    for (const pin of def.pins) {
      const hole = getComponentPinHole(placed, pin, def)
      const root = uf.find(hole)
      if (!netMap.has(root)) netMap.set(root, [])
      netMap.get(root)!.push({
        componentId: placed.id,
        componentName: def.name,
        pinName: pin.name,
        hole,
      })
    }
  }

  return Array.from(netMap.entries())
    .filter(([, pins]) => pins.length >= 2)
    .map(([root, pins]) => ({ root, pins }))
}
