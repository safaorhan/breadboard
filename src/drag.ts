import {
  state,
  addWire, removeWire,
  placeComponent, moveComponent, removeComponent,
  selectItem,
} from './state'
import { snapToHole, BOARD_COLS, PITCH, MARGIN_LEFT, MARGIN_TOP, ROW_Y_UNITS, rowFromYUnit } from './board'
import { clearLayer, renderGhostComponent, renderPreviewWire } from './render'
import { getComponentPinHole, getAllOccupiedHoles } from './components'
import type { ComponentDef } from './types'

type DragMode =
  | { mode: 'idle' }
  | { mode: 'wiring';  fromHole: string }
  | { mode: 'placing'; defId: string }
  | { mode: 'moving';  componentId: string; startX: number; startY: number; startAnchorCol: number; startAnchorRow: string }

let svg: SVGSVGElement
let dragMode: DragMode = { mode: 'idle' }

export function initDrag(svgEl: SVGSVGElement): void {
  svg = svgEl
  svg.addEventListener('mousedown',  onMouseDown)
  svg.addEventListener('mousemove',  onMouseMove)
  svg.addEventListener('mouseup',    onMouseUp)
  svg.addEventListener('click',      onSVGClick)
}

export function startPlacement(defId: string): void {
  selectItem(null, null)
  dragMode = { mode: 'placing', defId }
  svg.classList.add('placing')
}

export function cancelCurrentDrag(): void {
  dragMode = { mode: 'idle' }
  clearLayer(svg, 'preview-layer')
  svg.classList.remove('placing')
}

export function deleteSelected(): void {
  if (!state.selectedId) return
  if (state.selectedType === 'component') removeComponent(state.selectedId)
  else if (state.selectedType === 'wire') removeWire(state.selectedId)
  selectItem(null, null)
}

function getSVGPoint(e: MouseEvent): { x: number; y: number } {
  const rect = svg.getBoundingClientRect()
  const vb   = svg.viewBox.baseVal
  return {
    x: (e.clientX - rect.left) * (vb.width  / rect.width),
    y: (e.clientY - rect.top)  * (vb.height / rect.height),
  }
}

// Returns true if every real (non-*) pin lands on a valid main-grid row when the
// component is anchored at `row` with the given rotation.
function isValidAnchorRow(row: string, def: ComponentDef, rotated: boolean): boolean {
  const anchorYUnit = ROW_Y_UNITS[row]
  const realPins = def.pins.filter(p => p.name !== '*')
  if (realPins.length === 0) return true
  for (const pin of realPins) {
    const side = rotated ? (pin.row === 'top' ? 'bottom' : 'top') : pin.row
    const targetYUnit = side === 'top' ? anchorYUnit : anchorYUnit + def.rowSpan
    if (rowFromYUnit(targetYUnit) === undefined) return false
  }
  return true
}

function snapAnchorRow(svgY: number, def: ComponentDef, rotated = false): string {
  const mainRows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
  let bestRow = 'E'
  let bestDist = Infinity

  for (const row of mainRows) {
    if (!isValidAnchorRow(row, def, rotated)) continue
    const rowY = MARGIN_TOP + ROW_Y_UNITS[row] * PITCH
    const dist = Math.abs(svgY - rowY)
    if (dist < bestDist) { bestDist = dist; bestRow = row }
  }

  return bestRow
}

type MovingMode = Extract<DragMode, { mode: 'moving' }>

function deltaToAnchor(svgX: number, svgY: number, dm: MovingMode, def: ComponentDef): { col: number; row: string } {
  const deltaCol = Math.round((svgX - dm.startX) / PITCH)
  const rawCol   = dm.startAnchorCol + deltaCol
  const col      = Math.max(1, Math.min(rawCol, BOARD_COLS - def.colSpan + 1))

  const rotated = state.placedComponents.find(c => c.id === dm.componentId)?.rotated ?? false
  const startAnchorSVGY = MARGIN_TOP + ROW_Y_UNITS[dm.startAnchorRow] * PITCH
  const row = snapAnchorRow(startAnchorSVGY + (svgY - dm.startY), def, rotated)

  return { col, row }
}

function snapAnchorCol(svgX: number, def: ComponentDef): number {
  const raw = Math.round((svgX - MARGIN_LEFT) / PITCH) + 1
  return Math.max(1, Math.min(raw, BOARD_COLS - def.colSpan + 1))
}

function componentPinsFree(def: ComponentDef, anchorCol: number, anchorRow: string, excludeId?: string): boolean {
  const occupied = getAllOccupiedHoles(state, excludeId)
  const placed = { anchorCol, anchorRow, rotated: false } as Parameters<typeof getComponentPinHole>[0]
  // also check with any rotation the component currently has
  const comp = excludeId ? state.placedComponents.find(c => c.id === excludeId) : undefined
  if (comp) placed.rotated = comp.rotated
  for (const pin of def.pins) {
    if (pin.name === '*') continue
    if (occupied.has(getComponentPinHole(placed, pin, def))) return false
  }
  return true
}

function onMouseDown(e: MouseEvent): void {
  if (e.button !== 0) return
  const target = e.target as SVGElement

  if (target.dataset.hole && dragMode.mode !== 'placing') {
    const hole = target.dataset.hole
    if (getAllOccupiedHoles(state).has(hole)) return
    e.stopPropagation()
    dragMode = { mode: 'wiring', fromHole: hole }
    return
  }

  if (target.dataset.componentId && dragMode.mode === 'idle') {
    e.stopPropagation()
    const comp = state.placedComponents.find(c => c.id === target.dataset.componentId)
    if (comp && !comp.locked) {
      selectItem(comp.id, 'component')
      const { x, y } = getSVGPoint(e)
      dragMode = {
        mode: 'moving',
        componentId: comp.id,
        startX: x,
        startY: y,
        startAnchorCol: comp.anchorCol,
        startAnchorRow: comp.anchorRow,
      }
    }
  }
}

function onMouseMove(e: MouseEvent): void {
  const { x, y } = getSVGPoint(e)

  if (dragMode.mode === 'wiring') {
    renderPreviewWire(svg, dragMode.fromHole, x, y, state.jumperLibrary)
    return
  }

  if (dragMode.mode === 'placing') {
    const dm = dragMode as { mode: 'placing'; defId: string }
    const def = state.componentLibrary.find(d => d.id === dm.defId)
    if (!def) return
    renderGhostComponent(svg, def, snapAnchorCol(x, def), snapAnchorRow(y, def))
    return
  }

  if (dragMode.mode === 'moving') {
    const dm = dragMode as Extract<DragMode, { mode: 'moving' }>
    const comp = state.placedComponents.find(c => c.id === dm.componentId)
    if (!comp) return
    const def = state.componentLibrary.find(d => d.id === comp.defId)
    if (!def) return
    const { col, row } = deltaToAnchor(x, y, dm, def)
    renderGhostComponent(svg, def, col, row)
  }
}

function onMouseUp(e: MouseEvent): void {
  if (dragMode.mode === 'wiring') {
    const { x, y } = getSVGPoint(e)
    const toHole   = snapToHole(x, y)
    if (toHole && toHole !== dragMode.fromHole && !getAllOccupiedHoles(state).has(toHole)) {
      addWire(dragMode.fromHole, toHole)
    }
    dragMode = { mode: 'idle' }
    clearLayer(svg, 'preview-layer')
    return
  }

  if (dragMode.mode === 'moving') {
    const dm = dragMode as Extract<DragMode, { mode: 'moving' }>
    const { x, y } = getSVGPoint(e)
    const comp = state.placedComponents.find(c => c.id === dm.componentId)
    if (comp) {
      const def = state.componentLibrary.find(d => d.id === comp.defId)
      if (def) {
        const { col, row } = deltaToAnchor(x, y, dm, def)
        if (componentPinsFree(def, col, row, dm.componentId)) {
          moveComponent(dm.componentId, col, row)
        }
      }
    }
    dragMode = { mode: 'idle' }
    clearLayer(svg, 'preview-layer')
  }
}

function onSVGClick(e: MouseEvent): void {
  const target = e.target as SVGElement

  if (target.dataset.wireId) {
    selectItem(target.dataset.wireId, 'wire')
    return
  }

  if (target.dataset.componentId) {
    selectItem(target.dataset.componentId, 'component')
    return
  }

  if (dragMode.mode === 'placing') {
    const dm = dragMode as { mode: 'placing'; defId: string }
    const def = state.componentLibrary.find(d => d.id === dm.defId)
    if (!def) return
    const { x, y } = getSVGPoint(e)
    const col = snapAnchorCol(x, def)
    const row = snapAnchorRow(y, def)
    if (componentPinsFree(def, col, row)) {
      placeComponent(dm.defId, col, row)
      dragMode = { mode: 'idle' }
      clearLayer(svg, 'preview-layer')
      svg.classList.remove('placing')
    }
    return
  }

  if (!target.dataset.hole && !target.dataset.wireId && !target.dataset.componentId) {
    selectItem(null, null)
  }
}
