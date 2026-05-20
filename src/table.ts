import type { AppState } from './types'
import { analyzeNets, type PinRef } from './nets'
import { getColor } from './colors'

interface Endpoint {
  label:    string
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
  if (nets.length === 0) return nets

  function toEndpoint(pin: PinRef): Endpoint {
    const placed   = state.placedComponents.find(c => c.id === pin.componentId)
    const colorIdx = placed?.colorIdx ?? 0
    return { label: pin.componentName, pinName: pin.pinName, colorIdx }
  }

  const compFreq = new Map<string, number>()
  for (const net of nets) {
    const seen = new Set<string>()
    for (const pin of net.pins) {
      const e = toEndpoint(pin)
      if (!seen.has(e.label)) { seen.add(e.label); compFreq.set(e.label, (compFreq.get(e.label) ?? 0) + 1) }
    }
  }

  const pairs: Pair[] = []
  for (const net of nets) {
    const anchor = toEndpoint(net.pins[0])
    for (let i = 1; i < net.pins.length; i++) {
      const other = toEndpoint(net.pins[i])
      const af  = compFreq.get(anchor.label) ?? 0
      const of_ = compFreq.get(other.label)  ?? 0
      if (of_ > af || (of_ === af && other.label < anchor.label)) {
        pairs.push({ left: other, right: anchor, netRoot: net.root })
      } else {
        pairs.push({ left: anchor, right: other, netRoot: net.root })
      }
    }
  }

  pairs.sort((a, b) => {
    if (a.left.label  !== b.left.label)  return a.left.label.localeCompare(b.left.label)
    if (a.right.label !== b.right.label) return a.right.label.localeCompare(b.right.label)
    return a.left.pinName.localeCompare(b.left.pinName)
  })

  const ul = document.createElement('ul')
  ul.className = 'conn-list'

  for (const pair of pairs) {
    const li = document.createElement('li')
    li.className       = 'conn-item'
    li.dataset.netRoot = pair.netRoot

    li.appendChild(makeCompChip(pair.left))
    li.appendChild(makePinChip(pair.left.pinName))
    const sep = document.createElement('span')
    sep.className   = 'conn-sep'
    sep.textContent = '—'
    li.appendChild(sep)
    li.appendChild(makePinChip(pair.right.pinName))
    li.appendChild(makeCompChip(pair.right))

    ul.appendChild(li)
  }

  container.appendChild(ul)
  return nets
}

function makeCompChip(end: Endpoint): HTMLElement {
  const color = getColor(end.colorIdx)
  const span  = document.createElement('span')
  span.className        = 'chip chip-comp'
  span.textContent      = end.label
  span.style.background = color.stroke
  span.style.color      = color.text
  return span
}

function makePinChip(pin: string): HTMLElement {
  const span = document.createElement('span')
  span.className   = 'chip chip-pin'
  span.textContent = pin
  return span
}
