import type { AppState } from './types'
import { getComponentPinHole } from './components'
import { getInternalGroups } from './board'
import { getColor } from './colors'

interface LinkEnd {
  compName:    string | null
  instanceNum: number | null
  pinName:     string | null
  colorIdx:    number | null
  hole:        string
}

interface Link {
  left:  LinkEnd
  right: LinkEnd
}

class UnionFind {
  private p = new Map<string, string>()
  find(x: string): string {
    if (!this.p.has(x)) this.p.set(x, x)
    const parent = this.p.get(x)!
    if (parent === x) return x
    const root = this.find(parent)
    this.p.set(x, root)
    return root
  }
  union(a: string, b: string): void {
    const ra = this.find(a), rb = this.find(b)
    if (ra !== rb) this.p.set(ra, rb)
  }
}

export function renderTable(container: HTMLElement, state: AppState): void {
  container.innerHTML = ''

  if (state.wires.length === 0) {
    container.innerHTML = '<p>No connections yet.</p>'
    return
  }

  // Build UF over board-internal groups so any hole in a column-section
  // resolves to the component pin occupying that group.
  const uf = new UnionFind()
  for (const group of getInternalGroups()) {
    for (let i = 1; i < group.length; i++) uf.union(group[0], group[i])
  }

  const defCounts = new Map<string, number>()
  for (const p of state.placedComponents) defCounts.set(p.defId, (defCounts.get(p.defId) ?? 0) + 1)

  const rootToPin = new Map<string, { compName: string; instanceNum: number | null; pinName: string; colorIdx: number }>()
  for (const placed of state.placedComponents) {
    const def = state.componentLibrary.find(d => d.id === placed.defId)
    if (!def) continue
    const isDup = (defCounts.get(placed.defId) ?? 0) > 1
    for (const pin of def.pins) {
      const hole = getComponentPinHole(placed, pin, def)
      const root = uf.find(hole)
      if (!rootToPin.has(root)) rootToPin.set(root, {
        compName: def.name,
        instanceNum: isDup ? placed.instanceNum : null,
        pinName: pin.name,
        colorIdx: placed.colorIdx,
      })
    }
  }

  function resolveHole(hole: string): LinkEnd {
    if (hole.includes(':')) {
      const rail = hole.slice(0, hole.lastIndexOf(':'))
      if (rail === 'top+' || rail === 'bottom+') return { compName: 'Breadboard', instanceNum: null, pinName: 'VCC', colorIdx: null, hole }
      if (rail === 'top-' || rail === 'bottom-') return { compName: 'Breadboard', instanceNum: null, pinName: 'GND', colorIdx: null, hole }
    }
    const root = uf.find(hole)
    const pin  = rootToPin.get(root)
    if (pin) return { compName: pin.compName, instanceNum: pin.instanceNum, pinName: pin.pinName, colorIdx: pin.colorIdx, hole }
    return { compName: null, instanceNum: null, pinName: null, colorIdx: null, hole }
  }

  // Resolve endpoints
  const resolved = state.wires.map(w => ({
    from: resolveHole(w.from),
    to:   resolveHole(w.to),
  }))

  // Count how many wires each component appears in
  const compCount = new Map<string, number>()
  for (const { from, to } of resolved) {
    if (from.compName) compCount.set(from.compName, (compCount.get(from.compName) ?? 0) + 1)
    if (to.compName)   compCount.set(to.compName,   (compCount.get(to.compName)   ?? 0) + 1)
  }

  // Orient each link so the more-frequent component is on the left
  const links: Link[] = resolved.map(({ from, to }) => {
    const fc = from.compName ? (compCount.get(from.compName) ?? 0) : 0
    const tc = to.compName   ? (compCount.get(to.compName)   ?? 0) : 0
    if (tc > fc) return { left: to,   right: from }
    if (fc > tc) return { left: from, right: to   }
    const fn = from.compName ?? from.hole
    const tn = to.compName   ?? to.hole
    return fn <= tn ? { left: from, right: to } : { left: to, right: from }
  })

  // Sort by left component name, then left pin name
  links.sort((a, b) => {
    const la = a.left.compName ?? a.left.hole
    const lb = b.left.compName ?? b.left.hole
    if (la !== lb) return la.localeCompare(lb)
    const pa = a.left.pinName ?? a.left.hole
    const pb = b.left.pinName ?? b.left.hole
    return pa.localeCompare(pb)
  })

  const table = document.createElement('table')
  const tbody = table.createTBody()

  for (const link of links) {
    const row = tbody.insertRow()

    const leftTd   = row.insertCell()
    const leftWrap = document.createElement('div')
    leftWrap.className = 'link-cell-inner'
    appendLinkEnd(leftWrap, link.left, 'left')
    leftTd.appendChild(leftWrap)

    const rightTd   = row.insertCell()
    const rightWrap = document.createElement('div')
    rightWrap.className = 'link-cell-inner link-cell-inner-right'
    appendLinkEnd(rightWrap, link.right, 'right')
    rightTd.appendChild(rightWrap)
  }

  container.appendChild(table)
}

function appendLinkEnd(td: HTMLElement, end: LinkEnd, side: 'left' | 'right'): void {
  if (end.compName !== null) {
    const label    = end.instanceNum !== null ? `${end.compName} #${end.instanceNum}` : end.compName!
    const compChip = chip(label, 'chip-comp')
    if (end.colorIdx !== null) {
      const color = getColor(end.colorIdx)
      compChip.style.background = color.stroke
      compChip.style.color      = color.text
    }

    const pinChip = chip(end.pinName ?? '?', 'chip-pin')
    if (end.pinName === 'VCC') {
      pinChip.style.background = '#fee2e2'
      pinChip.style.color      = '#dc2626'
    } else if (end.pinName === 'GND') {
      pinChip.style.background = '#e5e7eb'
      pinChip.style.color      = '#374151'
    }

    if (side === 'left') {
      td.appendChild(compChip)
      td.appendChild(pinChip)
    } else {
      td.appendChild(pinChip)
      td.appendChild(compChip)
    }
  } else {
    td.appendChild(chip(end.hole, 'chip-hole'))
  }
}

function chip(text: string, cls: string): HTMLElement {
  const span = document.createElement('span')
  span.className   = `chip ${cls}`
  span.textContent = text
  return span
}
