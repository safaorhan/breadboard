import type { AppState } from './types'
import { analyzeNets, type PinRef } from './nets'
import { getColor } from './colors'

interface Endpoint {
  label:    string   // "ESP32 #2" when duplicate, "ESP32" otherwise
  pinName:  string
  colorIdx: number
}

interface Pair {
  left:    Endpoint
  right:   Endpoint
  netRoot: string
}

export function renderTable(container: HTMLElement, state: AppState): typeof nets {
  container.innerHTML = ''

  const nets = analyzeNets(state)
  if (nets.length === 0) {
    container.innerHTML = '<p>No connections yet.</p>'
    return nets
  }

  function toEndpoint(pin: PinRef): Endpoint {
    const placed   = state.placedComponents.find(c => c.id === pin.componentId)
    const colorIdx = placed?.colorIdx ?? 0
    return { label: pin.componentName, pinName: pin.pinName, colorIdx }
  }

  // Count how many nets each component label appears in (for orientation)
  const compFreq = new Map<string, number>()
  for (const net of nets) {
    const seen = new Set<string>()
    for (const pin of net.pins) {
      const e = toEndpoint(pin)
      if (!seen.has(e.label)) {
        seen.add(e.label)
        compFreq.set(e.label, (compFreq.get(e.label) ?? 0) + 1)
      }
    }
  }

  // For each net, anchor on pins[0] and pair with every other pin.
  // Orient so the more-frequent component is on the left.
  const pairs: Pair[] = []
  for (const net of nets) {
    const anchor = toEndpoint(net.pins[0])
    for (let i = 1; i < net.pins.length; i++) {
      const other = toEndpoint(net.pins[i])
      const af = compFreq.get(anchor.label) ?? 0
      const of_ = compFreq.get(other.label) ?? 0
      if (of_ > af || (of_ === af && other.label < anchor.label)) {
        pairs.push({ left: other, right: anchor, netRoot: net.root })
      } else {
        pairs.push({ left: anchor, right: other, netRoot: net.root })
      }
    }
  }

  if (pairs.length === 0) {
    container.innerHTML = '<p>No connections yet.</p>'
    return nets
  }

  // Sort: left label → left pin name
  pairs.sort((a, b) => {
    if (a.left.label  !== b.left.label)  return a.left.label.localeCompare(b.left.label)
    if (a.right.label !== b.right.label) return a.right.label.localeCompare(b.right.label)
    return a.left.pinName.localeCompare(b.left.pinName)
  })

  const table = document.createElement('table')
  const tbody = table.createTBody()

  for (const pair of pairs) {
    const row = tbody.insertRow()
    row.dataset.netRoot = pair.netRoot

    const leftTd   = row.insertCell()
    const leftWrap = document.createElement('div')
    leftWrap.className = 'link-cell-inner'
    appendEnd(leftWrap, pair.left, 'left')
    leftTd.appendChild(leftWrap)

    const rightTd   = row.insertCell()
    const rightWrap = document.createElement('div')
    rightWrap.className = 'link-cell-inner link-cell-inner-right'
    appendEnd(rightWrap, pair.right, 'right')
    rightTd.appendChild(rightWrap)
  }

  container.appendChild(table)
  return nets
}

function appendEnd(td: HTMLElement, end: Endpoint, side: 'left' | 'right'): void {
  const color    = getColor(end.colorIdx)
  const compChip = chip(end.label,    'chip-comp')
  const pinChip  = chip(end.pinName,  'chip-pin')
  compChip.style.background = color.stroke
  compChip.style.color      = color.text
  if (side === 'left') {
    td.appendChild(compChip)
    td.appendChild(pinChip)
  } else {
    td.appendChild(pinChip)
    td.appendChild(compChip)
  }
}

function chip(text: string, cls: string): HTMLElement {
  const span = document.createElement('span')
  span.className   = `chip ${cls}`
  span.textContent = text
  return span
}
