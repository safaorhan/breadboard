import type { AppState, ComponentDef, PlacedComponent } from './types'
import {
  SVG_NS, PITCH, HOLE_RADIUS, MARGIN_LEFT, MARGIN_TOP,
  BOARD_COLS, TOP_ROWS, BOTTOM_ROWS, RAIL_NAMES,
  ROW_Y_UNITS, SVG_WIDTH, SVG_HEIGHT, getHolePosition,
} from './board'
import { getComponentPinHole } from './components'

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K]
}

function getLayer(svg: SVGSVGElement, id: string): SVGGElement {
  return svg.querySelector(`#${id}`) as SVGGElement
}

export function clearLayer(svg: SVGSVGElement, id: string): void {
  const layer = getLayer(svg, id)
  while (layer.firstChild) layer.removeChild(layer.firstChild)
}

export function initSVG(container: HTMLElement): SVGSVGElement {
  const svg = svgEl('svg')
  svg.setAttribute('width', String(SVG_WIDTH))
  svg.setAttribute('height', String(SVG_HEIGHT))
  svg.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`)

  for (const id of ['board-layer', 'wire-layer', 'component-layer', 'preview-layer']) {
    const g = svgEl('g')
    g.id = id
    svg.appendChild(g)
  }

  container.appendChild(svg)
  return svg
}

export function render(svg: SVGSVGElement, state: AppState): void {
  clearLayer(svg, 'board-layer')
  clearLayer(svg, 'wire-layer')
  clearLayer(svg, 'component-layer')
  renderBoardLayer(svg, state)
  renderWireLayer(svg, state)
  renderComponentLayer(svg, state)
}

function renderBoardLayer(svg: SVGSVGElement, state: AppState): void {
  const layer = getLayer(svg, 'board-layer')
  const occupiedHoles = getOccupiedHoles(state)

  const railConfigs = [
    { rail: 'top+',    cls: 'rail-bg-plus'  },
    { rail: 'top-',    cls: 'rail-bg-minus' },
    { rail: 'bottom+', cls: 'rail-bg-plus'  },
    { rail: 'bottom-', cls: 'rail-bg-minus' },
  ]
  for (const { rail, cls } of railConfigs) {
    const y = MARGIN_TOP + ROW_Y_UNITS[rail] * PITCH
    const rect = svgEl('rect')
    rect.setAttribute('x', String(MARGIN_LEFT - 4))
    rect.setAttribute('y', String(y - HOLE_RADIUS - 2))
    rect.setAttribute('width', String(BOARD_COLS * PITCH + 4))
    rect.setAttribute('height', String(HOLE_RADIUS * 2 + 4))
    rect.setAttribute('rx', '3')
    rect.setAttribute('class', cls)
    layer.appendChild(rect)
  }

  const topY    = MARGIN_TOP + ROW_Y_UNITS['A'] * PITCH
  const topH    = 5 * PITCH
  const bottomY = MARGIN_TOP + ROW_Y_UNITS['F'] * PITCH
  const bottomH = 5 * PITCH

  for (const [y, h, cls] of [
    [topY - HOLE_RADIUS - 2, topH + HOLE_RADIUS * 2, 'board-bg-top'],
    [bottomY - HOLE_RADIUS - 2, bottomH + HOLE_RADIUS * 2, 'board-bg-bottom'],
  ] as [number, number, string][]) {
    const rect = svgEl('rect')
    rect.setAttribute('x', String(MARGIN_LEFT - 4))
    rect.setAttribute('y', String(y))
    rect.setAttribute('width', String(BOARD_COLS * PITCH + 4))
    rect.setAttribute('height', String(h))
    rect.setAttribute('class', cls)
    layer.appendChild(rect)
  }

  const railHoleCls: Record<string, string> = {
    'top+':    'power-hole top-plus-hole',
    'top-':    'power-hole top-minus-hole',
    'bottom+': 'power-hole bottom-plus-hole',
    'bottom-': 'power-hole bottom-minus-hole',
  }
  for (const rail of RAIL_NAMES) {
    for (let col = 1; col <= BOARD_COLS; col++) {
      const addr = `${rail}:${col}`
      const { x, y } = getHolePosition(addr)
      const circle = svgEl('circle')
      circle.setAttribute('cx', String(x))
      circle.setAttribute('cy', String(y))
      circle.setAttribute('r',  String(HOLE_RADIUS))
      circle.setAttribute('class', railHoleCls[rail])
      circle.dataset.hole = addr
      layer.appendChild(circle)
    }
  }

  const allRows = [...TOP_ROWS, ...BOTTOM_ROWS]
  for (const row of allRows) {
    for (let col = 1; col <= BOARD_COLS; col++) {
      const addr = `${row}${col}`
      const { x, y } = getHolePosition(addr)
      const circle = svgEl('circle')
      circle.setAttribute('cx', String(x))
      circle.setAttribute('cy', String(y))
      circle.setAttribute('r',  String(HOLE_RADIUS))
      circle.setAttribute('class', occupiedHoles.has(addr) ? 'hole occupied' : 'hole')
      circle.dataset.hole = addr
      layer.appendChild(circle)
    }
  }

  for (let col = 5; col <= BOARD_COLS; col += 5) {
    const x = MARGIN_LEFT + (col - 1) * PITCH
    const label = svgEl('text')
    label.setAttribute('x', String(x))
    label.setAttribute('y', String(MARGIN_TOP - 6))
    label.setAttribute('text-anchor', 'middle')
    label.setAttribute('class', 'col-label')
    label.textContent = String(col)
    layer.appendChild(label)
  }

  for (const row of allRows) {
    const { y } = getHolePosition(`${row}1`)
    const label = svgEl('text')
    label.setAttribute('x', String(MARGIN_LEFT - 8))
    label.setAttribute('y', String(y + 3))
    label.setAttribute('text-anchor', 'end')
    label.setAttribute('class', 'row-label')
    label.textContent = row
    layer.appendChild(label)
  }
}

function getOccupiedHoles(state: AppState): Set<string> {
  const occupied = new Set<string>()
  for (const placed of state.placedComponents) {
    const def = state.componentLibrary.find(d => d.id === placed.defId)
    if (!def) continue
    for (const pin of def.pins) {
      occupied.add(getComponentPinHole(placed, pin, def))
    }
  }
  return occupied
}

function renderWireLayer(svg: SVGSVGElement, state: AppState): void {
  const layer = getLayer(svg, 'wire-layer')
  for (const wire of state.wires) {
    const from = getHolePosition(wire.from)
    const to   = getHolePosition(wire.to)
    const line = svgEl('line')
    line.setAttribute('x1', String(from.x))
    line.setAttribute('y1', String(from.y))
    line.setAttribute('x2', String(to.x))
    line.setAttribute('y2', String(to.y))
    line.setAttribute('class', wire.id === state.selectedId ? 'wire selected' : 'wire')
    line.dataset.wireId = wire.id
    layer.appendChild(line)
  }
}

function renderComponentLayer(svg: SVGSVGElement, state: AppState): void {
  const layer = getLayer(svg, 'component-layer')
  for (const placed of state.placedComponents) {
    const def = state.componentLibrary.find(d => d.id === placed.defId)
    if (!def) continue
    renderPlacedComponent(layer, placed, def, state.selectedId)
  }
}

function renderPlacedComponent(
  layer: SVGGElement,
  placed: PlacedComponent,
  def: ComponentDef,
  selectedId: string | null,
): void {
  const anchorYUnit = ROW_Y_UNITS[placed.anchorRow]
  const anchorX = MARGIN_LEFT + (placed.anchorCol - 1) * PITCH
  const anchorY = MARGIN_TOP + anchorYUnit * PITCH

  const x = anchorX - HOLE_RADIUS - 1
  const y = anchorY - HOLE_RADIUS - 1
  const w = (def.colSpan - 1) * PITCH + HOLE_RADIUS * 2 + 2
  const h = def.rowSpan * PITCH + HOLE_RADIUS * 2 + 2

  const g = svgEl('g')
  g.dataset.componentId = placed.id

  const body = svgEl('rect')
  body.setAttribute('x', String(x))
  body.setAttribute('y', String(y))
  body.setAttribute('width', String(w))
  body.setAttribute('height', String(h))
  const bodyClass = ['component-body', placed.id === selectedId ? 'selected' : '', placed.locked ? 'locked' : ''].filter(Boolean).join(' ')
  body.setAttribute('class', bodyClass)
  body.setAttribute('pointer-events', placed.locked ? 'none' : 'auto')
  body.dataset.componentId = placed.id
  g.appendChild(body)

  const nameLabel = svgEl('text')
  nameLabel.setAttribute('x', String(x + w / 2))
  nameLabel.setAttribute('y', String(y + h / 2 + 3))
  nameLabel.setAttribute('text-anchor', 'middle')
  nameLabel.setAttribute('class', 'component-label')
  nameLabel.textContent = def.name
  g.appendChild(nameLabel)

  for (const pin of def.pins) {
    const addr       = getComponentPinHole(placed, pin, def)
    const { x: px, y: py } = getHolePosition(addr)

    const circle = svgEl('circle')
    circle.setAttribute('cx', String(px))
    circle.setAttribute('cy', String(py))
    circle.setAttribute('r',  String(HOLE_RADIUS))
    circle.setAttribute('class', 'pin-hole')
    circle.dataset.hole = addr
    g.appendChild(circle)

    const labelY = pin.row === 'top'
      ? py - HOLE_RADIUS - 2
      : py + HOLE_RADIUS + 7

    const label = svgEl('text')
    label.setAttribute('x', String(px))
    label.setAttribute('y', String(labelY))
    label.setAttribute('text-anchor', 'middle')
    label.setAttribute('class', 'pin-label')
    label.textContent = pin.name
    g.appendChild(label)
  }

  layer.appendChild(g)
}

export function renderSidebar(list: HTMLElement, library: ComponentDef[]): void {
  list.innerHTML = ''
  for (const def of library) {
    const li = document.createElement('li')
    li.textContent = def.name
    li.dataset.defId = def.id
    list.appendChild(li)
  }
}

export function renderGhostComponent(svg: SVGSVGElement, def: ComponentDef, anchorCol: number, anchorRow: string): void {
  clearLayer(svg, 'preview-layer')
  const layer = getLayer(svg, 'preview-layer')

  const anchorYUnit = ROW_Y_UNITS[anchorRow]
  const anchorX = MARGIN_LEFT + (anchorCol - 1) * PITCH
  const anchorY = MARGIN_TOP + anchorYUnit * PITCH

  const x = anchorX - HOLE_RADIUS - 1
  const y = anchorY - HOLE_RADIUS - 1
  const w = (def.colSpan - 1) * PITCH + HOLE_RADIUS * 2 + 2
  const h = def.rowSpan * PITCH + HOLE_RADIUS * 2 + 2

  const rect = svgEl('rect')
  rect.setAttribute('x', String(x))
  rect.setAttribute('y', String(y))
  rect.setAttribute('width', String(w))
  rect.setAttribute('height', String(h))
  rect.setAttribute('class', 'ghost-body')
  layer.appendChild(rect)
}

export function renderPreviewWire(svg: SVGSVGElement, fromHole: string, toX: number, toY: number): void {
  clearLayer(svg, 'preview-layer')
  const layer  = getLayer(svg, 'preview-layer')
  const from   = getHolePosition(fromHole)
  const line   = svgEl('line')
  line.setAttribute('x1', String(from.x))
  line.setAttribute('y1', String(from.y))
  line.setAttribute('x2', String(toX))
  line.setAttribute('y2', String(toY))
  line.setAttribute('class', 'preview-wire')
  layer.appendChild(line)
}
