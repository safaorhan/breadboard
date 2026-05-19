import type { AppState, ComponentDef, PlacedComponent, Wire } from './types'
import {
  SVG_NS, PITCH, HOLE_RADIUS, MARGIN_LEFT, MARGIN_TOP,
  BOARD_COLS, TOP_ROWS, BOTTOM_ROWS, RAIL_NAMES,
  ROW_Y_UNITS, SVG_WIDTH, SVG_HEIGHT, getHolePosition, isRailHole, snapToHole,
} from './board'
import { getComponentPinHole, getAllOccupiedHoles, getIllustrationUrl } from './components'
import { getColor } from './colors'
import { wireColor, COPPER_COLOR } from './jumpers'

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
  svg.setAttribute('width',   String(SVG_WIDTH))
  svg.setAttribute('height',  String(SVG_HEIGHT))
  svg.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`)
  svg.setAttribute('fill',    '#faf8f4')  // inherited default for child elements

  for (const id of ['board-layer', 'component-layer']) {
    const g = svgEl('g'); g.id = id; svg.appendChild(g)
  }

  // Scrim: full-board dimming rect, sits above components but below wires
  const scrimLayer = svgEl('g')
  scrimLayer.id = 'scrim-layer'
  const scrimRect = svgEl('rect')
  scrimRect.id = 'scrim-rect'
  scrimRect.setAttribute('width',  String(SVG_WIDTH))
  scrimRect.setAttribute('height', String(SVG_HEIGHT))
  scrimRect.setAttribute('fill',   'black')
  scrimRect.setAttribute('opacity', '0')
  scrimRect.setAttribute('pointer-events', 'none')
  scrimLayer.appendChild(scrimRect)
  svg.appendChild(scrimLayer)

  for (const id of ['wire-layer', 'preview-layer']) {
    const g = svgEl('g'); g.id = id; svg.appendChild(g)
  }

  // Hover-label overlay — must be last so it renders above everything
  const hoverGroup = svgEl('g')
  hoverGroup.id = 'hover-labels'
  hoverGroup.setAttribute('pointer-events', 'none')
  for (const id of ['hover-col-top', 'hover-col-bottom', 'hover-row-left', 'hover-row-right']) {
    const t = svgEl('text')
    t.id = id
    t.setAttribute('class', 'hover-label')
    t.setAttribute('visibility', 'hidden')
    hoverGroup.appendChild(t)
  }
  svg.appendChild(hoverGroup)

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
    rect.setAttribute('width', String((BOARD_COLS - 1) * PITCH + 8))
    rect.setAttribute('height', String(HOLE_RADIUS * 2 + 4))
    rect.setAttribute('rx', '3')
    rect.setAttribute('class', cls)
    layer.appendChild(rect)
  }

  const topY    = MARGIN_TOP + ROW_Y_UNITS['J'] * PITCH
  const topH    = 5 * PITCH
  const bottomY = MARGIN_TOP + ROW_Y_UNITS['E'] * PITCH
  const bottomH = 5 * PITCH

  for (const [y, h, cls] of [
    [topY - HOLE_RADIUS - 2, topH + HOLE_RADIUS * 2, 'board-bg-top'],
    [bottomY - HOLE_RADIUS - 2, bottomH + HOLE_RADIUS * 2, 'board-bg-bottom'],
  ] as [number, number, string][]) {
    const rect = svgEl('rect')
    rect.setAttribute('x', String(MARGIN_LEFT - 4))
    rect.setAttribute('y', String(y))
    rect.setAttribute('width', String((BOARD_COLS - 1) * PITCH + 8))
    rect.setAttribute('height', String(h))
    rect.setAttribute('class', cls)
    layer.appendChild(rect)
  }

  // Center trench between F and E rows
  const trenchCenterY = MARGIN_TOP + ((ROW_Y_UNITS['F'] + ROW_Y_UNITS['E']) / 2) * PITCH
  const trenchH       = PITCH - 2
  const trench = svgEl('rect')
  trench.setAttribute('x',      '0')
  trench.setAttribute('y',      String(trenchCenterY - trenchH / 2))
  trench.setAttribute('width',  String(SVG_WIDTH))
  trench.setAttribute('height', String(trenchH))
  trench.setAttribute('class',  'board-trench')
  layer.appendChild(trench)

  const railHoleCls: Record<string, string> = {
    'top+':    'power-hole top-plus-hole',
    'top-':    'power-hole top-minus-hole',
    'bottom+': 'power-hole bottom-plus-hole',
    'bottom-': 'power-hole bottom-minus-hole',
  }
  for (const rail of RAIL_NAMES) {
    for (let col = 1; col <= BOARD_COLS; col++) {
      if (!isRailHole(col)) continue
      const addr = `${rail}:${col}`
      const { x, y } = getHolePosition(addr)
      const circle = svgEl('circle')
      circle.setAttribute('cx', String(x))
      circle.setAttribute('cy', String(y))
      circle.setAttribute('r',  String(HOLE_RADIUS))
      const railCls = railHoleCls[rail] + (occupiedHoles.has(addr) ? ' occupied' : '')
      circle.setAttribute('class', railCls)
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

  const lastHoleX       = MARGIN_LEFT + (BOARD_COLS - 1) * PITCH
  const topRailTop      = MARGIN_TOP  + ROW_Y_UNITS['top-']    * PITCH - HOLE_RADIUS - 2
  const bottomRailBot   = MARGIN_TOP  + ROW_Y_UNITS['bottom+'] * PITCH + HOLE_RADIUS + 2
  const stripeX1        = MARGIN_LEFT - 4
  const stripeX2        = lastHoleX   + 4

  // Decorative stripes: blue outside the − rails, red inside the + rails
  const topPlusBot    = MARGIN_TOP + ROW_Y_UNITS['top+']    * PITCH + HOLE_RADIUS + 2
  const bottomMinusTop = MARGIN_TOP + ROW_Y_UNITS['bottom-'] * PITCH - HOLE_RADIUS - 2
  for (const { y, cls } of [
    { y: topRailTop    - 4, cls: 'rail-stripe-minus' },  // blue above top−
    { y: topPlusBot    + 4, cls: 'rail-stripe-plus'  },  // red below top+
    { y: bottomMinusTop - 4, cls: 'rail-stripe-minus' },  // blue above bottom−
    { y: bottomRailBot  + 4, cls: 'rail-stripe-plus'  },  // red below bottom+
  ]) {
    const line = svgEl('line')
    line.setAttribute('x1', String(stripeX1)); line.setAttribute('x2', String(stripeX2))
    line.setAttribute('y1', String(y));        line.setAttribute('y2', String(y))
    line.setAttribute('class', cls)
    layer.appendChild(line)
  }

  // Column labels in the gap between rails and pin rows
  const colLabelYTop    = MARGIN_TOP + ROW_Y_UNITS['J'] * PITCH - HOLE_RADIUS - 5
  const colLabelYBottom = MARGIN_TOP + ROW_Y_UNITS['A'] * PITCH + HOLE_RADIUS + 11
  const rowLabelXLeft   = MARGIN_LEFT - 8
  const rowLabelXRight  = lastHoleX   + 8

  for (let col = 5; col <= BOARD_COLS; col += 5) {
    const x = MARGIN_LEFT + (col - 1) * PITCH
    for (const y of [colLabelYTop, colLabelYBottom]) {
      const label = svgEl('text')
      label.setAttribute('x', String(x))
      label.setAttribute('y', String(y))
      label.setAttribute('text-anchor', 'middle')
      label.setAttribute('class', 'col-label')
      label.textContent = String(col)
      layer.appendChild(label)
    }
  }

  for (const row of allRows) {
    const { y } = getHolePosition(`${row}1`)
    for (const [x, anchor] of [[rowLabelXLeft, 'end'], [rowLabelXRight, 'start']] as [number, string][]) {
      const label = svgEl('text')
      label.setAttribute('x', String(x))
      label.setAttribute('y', String(y + 3))
      label.setAttribute('text-anchor', anchor)
      label.setAttribute('class', 'row-label')
      label.textContent = row
      layer.appendChild(label)
    }
  }

  const railLabelDefs = [
    { rail: 'top-',    text: '−', cls: 'rail-label rail-label-minus' },
    { rail: 'top+',    text: '+', cls: 'rail-label rail-label-plus'  },
    { rail: 'bottom-', text: '−', cls: 'rail-label rail-label-minus' },
    { rail: 'bottom+', text: '+', cls: 'rail-label rail-label-plus'  },
  ]
  for (const { rail, text, cls } of railLabelDefs) {
    const { y } = getHolePosition(`${rail}:1`)
    for (const [x, anchor] of [[rowLabelXLeft, 'end'], [rowLabelXRight, 'start']] as [number, string][]) {
      const label = svgEl('text')
      label.setAttribute('x', String(x))
      label.setAttribute('y', String(y + 3))
      label.setAttribute('text-anchor', anchor)
      label.setAttribute('class', cls)
      label.textContent = text
      layer.appendChild(label)
    }
  }
}

function getOccupiedHoles(state: AppState): Set<string> {
  return getAllOccupiedHoles(state)
}

const WIRE_OVERLAP_OFFSET = 2.5
const OFFSET_SLOTS = [0, -WIRE_OVERLAP_OFFSET, WIRE_OVERLAP_OFFSET]

function computeWireYOffsets(wires: Wire[]): Map<string, number> {
  type RowWire = { id: string; row: string; minCol: number; maxCol: number }
  const rowWires: RowWire[] = []

  for (const wire of wires) {
    if (wire.from.includes(':') || wire.to.includes(':')) continue
    const rowF = wire.from[0], colF = parseInt(wire.from.slice(1))
    const rowT = wire.to[0],   colT = parseInt(wire.to.slice(1))
    if (rowF !== rowT) continue
    rowWires.push({ id: wire.id, row: rowF, minCol: Math.min(colF, colT), maxCol: Math.max(colF, colT) })
  }

  const byRow = new Map<string, RowWire[]>()
  for (const rw of rowWires) {
    if (!byRow.has(rw.row)) byRow.set(rw.row, [])
    byRow.get(rw.row)!.push(rw)
  }

  const offsets = new Map<string, number>()
  const insertionOrder = new Map(wires.map((w, i) => [w.id, i]))
  const overlaps = (a: RowWire, b: RowWire) => a.minCol < b.maxCol && b.minCol < a.maxCol

  for (const rowList of byRow.values()) {
    // Process in insertion order so earlier-drawn wires get lower-indexed slots
    const sorted = [...rowList].sort((a, b) => (insertionOrder.get(a.id) ?? 0) - (insertionOrder.get(b.id) ?? 0))

    for (const wire of sorted) {
      const hasAnyOverlap = rowList.some(o => o.id !== wire.id && overlaps(wire, o))
      if (!hasAnyOverlap) continue

      // Collect slots already taken by direct overlapping neighbours
      const taken = new Set<number>()
      for (const other of rowList) {
        if (other.id !== wire.id && overlaps(wire, other) && offsets.has(other.id)) {
          taken.add(offsets.get(other.id)!)
        }
      }

      // Assign the first free slot
      offsets.set(wire.id, OFFSET_SLOTS.find(s => !taken.has(s)) ?? 0)
    }
  }

  return offsets
}

function trespassesThrough(from: string, to: string, hole: string): boolean {
  const h = getHolePosition(hole)
  const f = getHolePosition(from)
  const t = getHolePosition(to)
  const dx = t.x - f.x, dy = t.y - f.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1) return false
  const param = ((h.x - f.x) * dx + (h.y - f.y) * dy) / len2
  if (param <= 0.01 || param >= 0.99) return false
  const px = f.x + param * dx, py = f.y + param * dy
  return (h.x - px) ** 2 + (h.y - py) ** 2 < 0.25
}

function computeWireRenderOrder(wires: Wire[]): Wire[] {
  const n = wires.length
  if (n < 2) return [...wires]

  // adj[i] = wires that must render after wire i
  // (because they trespass through wire i's endpoint)
  const adj: number[][] = Array.from({ length: n }, () => [])
  const inDegree = new Array(n).fill(0)

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      if (trespassesThrough(wires[j].from, wires[j].to, wires[i].from) ||
          trespassesThrough(wires[j].from, wires[j].to, wires[i].to)) {
        adj[i].push(j)
        inDegree[j]++
      }
    }
  }

  const queue: number[] = []
  for (let i = 0; i < n; i++) if (inDegree[i] === 0) queue.push(i)

  const result: number[] = []
  while (queue.length) {
    const i = queue.shift()!
    result.push(i)
    for (const j of adj[i]) if (--inDegree[j] === 0) queue.push(j)
  }

  // Append any nodes left in a cycle (keep original order)
  for (let i = 0; i < n; i++) if (inDegree[i] > 0) result.push(i)

  return result.map(i => wires[i])
}

function renderWireLayer(svg: SVGSVGElement, state: AppState): void {
  const layer    = getLayer(svg, 'wire-layer')
  const yOffsets = computeWireYOffsets(state.wires)

  function wireCoords(wire: { from: string; to: string }, yOff: number) {
    const from = getHolePosition(wire.from)
    const to   = getHolePosition(wire.to)
    return { x1: from.x, y1: from.y + yOff, x2: to.x, y2: to.y + yOff }
  }

  // Render wire + border as a pair so each wire's border overlays previous wires.
  // Order: pinned wires first, wires that trespass through their endpoints last.
  for (const wire of computeWireRenderOrder(state.wires)) {
    const yOff       = yOffsets.get(wire.id) ?? 0
    const { x1, y1, x2, y2 } = wireCoords(wire, yOff)
    const isSelected = wire.id === state.selectedId

    const line = svgEl('line')
    line.setAttribute('x1', String(x1)); line.setAttribute('y1', String(y1))
    line.setAttribute('x2', String(x2)); line.setAttribute('y2', String(y2))
    line.setAttribute('class', isSelected ? 'wire selected' : 'wire')
    line.style.stroke = isSelected ? 'var(--amber)' : wireColor(wire.from, wire.to, state.jumperLibrary)
    line.dataset.wireId = wire.id
    const border = svgEl('line')
    border.setAttribute('x1', String(x1)); border.setAttribute('y1', String(y1))
    border.setAttribute('x2', String(x2)); border.setAttribute('y2', String(y2))
    border.setAttribute('class', 'wire-border')
    layer.appendChild(border)

    layer.appendChild(line)
  }
}

function renderIllustration(
  g: SVGGElement,
  placed: PlacedComponent,
  def: ComponentDef,
  anchorX: number,
  anchorY: number,
): void {
  const ill = def.illustration
  if (!ill) return
  const url = getIllustrationUrl(ill.file)
  if (!url) return

  const pinDef0 = def.pins.find(p => p.name === ill.anchors[0].pin)
  const pinDef1 = def.pins.find(p => p.name === ill.anchors[1].pin)
  if (!pinDef0 || !pinDef1) return

  // Always use the NON-ROTATED pin positions to compute the transform.
  // If the component is rotated we apply a 180° rotation afterwards.
  const canvasX = (col: number) => anchorX + col * PITCH
  const canvasY = (row: 'top' | 'bottom') => row === 'top' ? anchorY : anchorY + def.rowSpan * PITCH

  const p0 = { x: canvasX(pinDef0.col), y: canvasY(pinDef0.row) }
  const p1 = { x: canvasX(pinDef1.col), y: canvasY(pinDef1.row) }

  const canvasDist = Math.hypot(p1.x - p0.x, p1.y - p0.y)
  const svgDist    = Math.hypot(ill.anchors[1].x - ill.anchors[0].x, ill.anchors[1].y - ill.anchors[0].y)
  const scale      = canvasDist / svgDist

  const imgX = p0.x - ill.anchors[0].x * scale
  const imgY = p0.y - ill.anchors[0].y * scale
  const imgW = ill.viewBox.width  * scale
  const imgH = ill.viewBox.height * scale

  const rotateTransform = (() => {
    if (!placed.rotated) return null
    const cx = anchorX + (def.colSpan - 1) * PITCH / 2
    const cy = anchorY + def.rowSpan * PITCH / 2
    return `rotate(180,${cx},${cy})`
  })()

  const img = svgEl('image')
  img.setAttribute('href',                url)
  img.setAttribute('x',                   String(imgX))
  img.setAttribute('y',                   String(imgY))
  img.setAttribute('width',               String(imgW))
  img.setAttribute('height',              String(imgH))
  img.setAttribute('preserveAspectRatio', 'none')
  img.setAttribute('pointer-events',      'none')
  img.setAttribute('opacity',             String(placed.locked ? 0.5 : 1))
  if (rotateTransform) img.setAttribute('transform', rotateTransform)
  g.appendChild(img)

  if (placed.locked) {
    const contour = svgEl('rect')
    contour.setAttribute('x',                String(imgX))
    contour.setAttribute('y',                String(imgY))
    contour.setAttribute('width',            String(imgW))
    contour.setAttribute('height',           String(imgH))
    contour.setAttribute('fill',             'none')
    contour.setAttribute('stroke',           'var(--amber)')
    contour.setAttribute('stroke-width',     '1.5')
    contour.setAttribute('stroke-dasharray', '4 3')
    contour.setAttribute('pointer-events',   'none')
    if (rotateTransform) contour.setAttribute('transform', rotateTransform)
    g.appendChild(contour)
  }
}

function renderComponentLayer(svg: SVGSVGElement, state: AppState): void {
  const layer = getLayer(svg, 'component-layer')
  for (const placed of state.placedComponents) {
    if (placed.hidden) continue
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

  const color      = getColor(placed.colorIdx)
  const isSelected = placed.id === selectedId

  const body = svgEl('rect')
  body.setAttribute('x', String(x))
  body.setAttribute('y', String(y))
  body.setAttribute('width', String(w))
  body.setAttribute('height', String(h))
  body.dataset.componentId = placed.id

  if (def.illustration) {
    // Invisible rect kept only for pointer-event hit-testing
    body.setAttribute('fill',           'transparent')
    body.setAttribute('stroke',         'none')
    body.setAttribute('pointer-events', placed.locked ? 'none' : 'auto')
  } else {
    const bodyClass = ['component-body', isSelected ? 'selected' : '', placed.locked ? 'locked' : ''].filter(Boolean).join(' ')
    body.setAttribute('class', bodyClass)
    body.setAttribute('pointer-events', placed.locked ? 'none' : 'auto')
    body.style.fill   = color.fill
    body.style.stroke = isSelected ? 'var(--accent)' : placed.locked ? 'var(--amber)' : color.stroke
  }

  g.appendChild(body)
  renderIllustration(g, placed, def, anchorX, anchorY)

  if (!def.illustration) {
    const nameLabel = svgEl('text')
    nameLabel.setAttribute('x', String(x + w / 2))
    nameLabel.setAttribute('y', String(y + h / 2 + 3))
    nameLabel.setAttribute('text-anchor', 'middle')
    nameLabel.setAttribute('class', 'component-label')
    nameLabel.style.fill = color.stroke
    nameLabel.textContent = placed.label ?? def.name
    g.appendChild(nameLabel)
  }

  for (const pin of def.pins) {
    if (pin.name === '*') continue
    const addr       = getComponentPinHole(placed, pin, def)
    const { x: px, y: py } = getHolePosition(addr)

    const circle = svgEl('circle')
    circle.setAttribute('cx', String(px))
    circle.setAttribute('cy', String(py))
    circle.setAttribute('r',  String(HOLE_RADIUS))
    circle.setAttribute('class', 'pin-hole')
    circle.dataset.hole = addr
    g.appendChild(circle)

    const effectiveRow = placed.rotated ? (pin.row === 'top' ? 'bottom' : 'top') : pin.row
    const labelY = effectiveRow === 'top'
      ? py - HOLE_RADIUS - 2
      : py + HOLE_RADIUS + 7

    const label = svgEl('text')
    label.setAttribute('x', String(px))
    label.setAttribute('y', String(labelY))
    label.setAttribute('text-anchor', 'middle')
    label.setAttribute('class', 'pin-label')
    label.style.fill = color.stroke
    label.textContent = pin.name
    g.appendChild(label)
  }

  layer.appendChild(g)
}

const PENCIL_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    style="pointer-events:none">
  <path d="M12 20h9"/>
  <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
</svg>`

export function renderSidebar(
  list: HTMLElement,
  library: ComponentDef[],
  recentIds: string[],
  onDismiss: (defId: string) => void,
  editingId: string | null = null,
): void {
  list.innerHTML = ''
  const defs = recentIds.map(id => library.find(d => d.id === id)).filter(Boolean) as ComponentDef[]
  if (defs.length === 0) {
    const hint = document.createElement('li')
    hint.className   = 'comp-item-hint'
    hint.textContent = 'Search above to place components'
    list.appendChild(hint)
    return
  }
  for (const def of defs) {
    const li = document.createElement('li')
    li.dataset.defId = def.id
    if (def.id === editingId) li.classList.add('editing')

    const nameSpan = document.createElement('span')
    nameSpan.className   = 'comp-item-name'
    nameSpan.textContent = def.name

    const editBtn = document.createElement('button')
    editBtn.className      = 'comp-edit-btn'
    editBtn.title          = 'Edit component'
    editBtn.innerHTML      = PENCIL_ICON
    editBtn.dataset.action = 'edit'
    editBtn.dataset.defId  = def.id

    const dismissBtn = document.createElement('button')
    dismissBtn.className   = 'comp-del-btn'
    dismissBtn.title       = 'Remove from recents'
    dismissBtn.textContent = '×'
    dismissBtn.addEventListener('click', (e) => { e.stopPropagation(); onDismiss(def.id) })

    li.appendChild(nameSpan)
    li.appendChild(editBtn)
    li.appendChild(dismissBtn)
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

  if (def.illustration) {
    const ghostPlaced = { rotated: false } as PlacedComponent
    const g = svgEl('g')
    renderIllustration(g, ghostPlaced, def, anchorX, anchorY)
    while (g.firstChild) layer.appendChild(g.firstChild)
  }
}

export function renderPreviewWire(
  svg: SVGSVGElement, fromHole: string, toX: number, toY: number,
  jumperLibrary: AppState['jumperLibrary'],
): void {
  clearLayer(svg, 'preview-layer')
  const layer     = getLayer(svg, 'preview-layer')
  const from      = getHolePosition(fromHole)
  const toHole    = snapToHole(toX, toY)
  const color     = toHole ? wireColor(fromHole, toHole, jumperLibrary) : COPPER_COLOR
  const line      = svgEl('line')
  line.setAttribute('x1', String(from.x))
  line.setAttribute('y1', String(from.y))
  line.setAttribute('x2', String(toX))
  line.setAttribute('y2', String(toY))
  line.setAttribute('class', 'preview-wire')
  line.style.stroke = color
  layer.appendChild(line)
}
