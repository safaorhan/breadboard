import {
  state,
  addWire, removeWire,
  placeComponent, moveComponent, removeComponent,
  selectItem,
} from './state'
import { snapToHole, BOARD_COLS, PITCH, MARGIN_LEFT, MARGIN_TOP, ROW_Y_UNITS } from './board'
import { clearLayer, renderGhostComponent, renderPreviewWire } from './render'
import type { ComponentDef } from './types'

type DragMode =
  | { mode: 'idle' }
  | { mode: 'wiring';   fromHole: string }
  | { mode: 'placing';  defId: string }
  | { mode: 'moving';   componentId: string }

let svg: SVGSVGElement
let dragMode: DragMode = { mode: 'idle' }

export function initDrag(svgEl: SVGSVGElement): void {
  svg = svgEl
  svg.addEventListener('mousedown',  onMouseDown)
  svg.addEventListener('mousemove',  onMouseMove)
  svg.addEventListener('mouseup',    onMouseUp)
  svg.addEventListener('click',      onSVGClick)
  svg.addEventListener('contextmenu', e => { e.preventDefault(); cancelCurrentDrag() })
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
  else if (state.selectedType === 'wire')  removeWire(state.selectedId)
  selectItem(null, null)
}

function getSVGPoint(e: MouseEvent): { x: number; y: number } {
  const rect = svg.getBoundingClientRect()
  const scaleX = parseFloat(svg.getAttribute('width')  ?? '1') / rect.width
  const scaleY = parseFloat(svg.getAttribute('height') ?? '1') / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top)  * scaleY,
  }
}

// Returns the main-grid row letter whose y-unit, when used as anchorRow, produces a valid
// bottom pin row (anchorYUnit + def.rowSpan exists as a main-grid row). Picks the row
// whose center is closest to svgY.
function snapAnchorRow(svgY: number, def: ComponentDef): string {
  const mainRows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
  let bestRow = 'E'
  let bestDist = Infinity

  for (const row of mainRows) {
    const anchorYUnit = ROW_Y_UNITS[row]
    const bottomYUnit = anchorYUnit + def.rowSpan
    if (!mainRows.some(r => ROW_Y_UNITS[r] === bottomYUnit)) continue
    const rowY = MARGIN_TOP + anchorYUnit * PITCH
    const dist = Math.abs(svgY - rowY)
    if (dist < bestDist) { bestDist = dist; bestRow = row }
  }

  return bestRow
}

function snapAnchorCol(svgX: number, def: ComponentDef): number {
  const raw = Math.round((svgX - MARGIN_LEFT) / PITCH) + 1
  return Math.max(1, Math.min(raw, BOARD_COLS - def.colSpan + 1))
}

function onMouseDown(e: MouseEvent): void {
  if (e.button !== 0) return
  const target = e.target as SVGElement

  if (target.dataset.hole) {
    e.stopPropagation()
    dragMode = { mode: 'wiring', fromHole: target.dataset.hole }
    return
  }

  if (target.dataset.componentId && dragMode.mode === 'idle') {
    e.stopPropagation()
    const comp = state.placedComponents.find(c => c.id === target.dataset.componentId)
    if (comp) {
      selectItem(comp.id, 'component')
      dragMode = { mode: 'moving', componentId: comp.id }
    }
  }
}

function onMouseMove(e: MouseEvent): void {
  const { x, y } = getSVGPoint(e)

  if (dragMode.mode === 'wiring') {
    renderPreviewWire(svg, dragMode.fromHole, x, y)
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
    const dm = dragMode as { mode: 'moving'; componentId: string }
    const comp = state.placedComponents.find(c => c.id === dm.componentId)
    if (!comp) return
    const def = state.componentLibrary.find(d => d.id === comp.defId)
    if (!def) return
    renderGhostComponent(svg, def, snapAnchorCol(x, def), snapAnchorRow(y, def))
  }
}

function onMouseUp(e: MouseEvent): void {
  if (dragMode.mode === 'wiring') {
    const { x, y } = getSVGPoint(e)
    const toHole = snapToHole(x, y)
    if (toHole && toHole !== dragMode.fromHole) addWire(dragMode.fromHole, toHole)
    dragMode = { mode: 'idle' }
    clearLayer(svg, 'preview-layer')
    return
  }

  if (dragMode.mode === 'moving') {
    const dm = dragMode as { mode: 'moving'; componentId: string }
    const { x, y } = getSVGPoint(e)
    const comp = state.placedComponents.find(c => c.id === dm.componentId)
    if (comp) {
      const def = state.componentLibrary.find(d => d.id === comp.defId)
      if (def) moveComponent(dm.componentId, snapAnchorCol(x, def), snapAnchorRow(y, def))
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
    placeComponent(dm.defId, snapAnchorCol(x, def), snapAnchorRow(y, def))
    dragMode = { mode: 'idle' }
    clearLayer(svg, 'preview-layer')
    svg.classList.remove('placing')
    return
  }

  if (!target.dataset.hole && !target.dataset.wireId && !target.dataset.componentId) {
    selectItem(null, null)
  }
}
