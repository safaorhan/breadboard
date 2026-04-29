import {
  state,
  addWire, removeWire,
  placeComponent, moveComponent, removeComponent,
  selectItem,
} from './state'
import { snapToHole, BOARD_COLS, PITCH, MARGIN_LEFT } from './board'
import { clearLayer, renderGhostComponent, renderPreviewWire } from './render'

type DragMode =
  | { mode: 'idle' }
  | { mode: 'wiring';   fromHole: string }
  | { mode: 'placing';  defId: string }
  | { mode: 'moving';   componentId: string; startAnchorCol: number }

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

function onMouseDown(e: MouseEvent): void {
  if (e.button !== 0) return

  const target = e.target as SVGElement

  // Start wire drawing from any hole
  if (target.dataset.hole) {
    e.stopPropagation()
    dragMode = { mode: 'wiring', fromHole: target.dataset.hole }
    return
  }

  // Start component move from component body
  if (target.dataset.componentId && dragMode.mode === 'idle') {
    e.stopPropagation()
    const comp = state.placedComponents.find(c => c.id === target.dataset.componentId)
    if (comp) {
      selectItem(comp.id, 'component')
      dragMode = { mode: 'moving', componentId: comp.id, startAnchorCol: comp.anchorCol }
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
    const raw = Math.round((x - MARGIN_LEFT) / PITCH) + 1
    const anchorCol = Math.max(1, Math.min(raw, BOARD_COLS - def.colSpan + 1))
    renderGhostComponent(svg, def, anchorCol)
    return
  }

  if (dragMode.mode === 'moving') {
    const dm = dragMode as { mode: 'moving'; componentId: string; startAnchorCol: number }
    const comp = state.placedComponents.find(c => c.id === dm.componentId)
    if (!comp) return
    const def = state.componentLibrary.find(d => d.id === comp.defId)
    if (!def) return
    const raw = Math.round((x - MARGIN_LEFT) / PITCH) + 1
    const anchorCol = Math.max(1, Math.min(raw, BOARD_COLS - def.colSpan + 1))
    renderGhostComponent(svg, def, anchorCol)
  }
}

function onMouseUp(e: MouseEvent): void {
  if (dragMode.mode === 'wiring') {
    const { x, y } = getSVGPoint(e)
    const toHole = snapToHole(x, y)
    if (toHole && toHole !== dragMode.fromHole) {
      addWire(dragMode.fromHole, toHole)
    }
    dragMode = { mode: 'idle' }
    clearLayer(svg, 'preview-layer')
    return
  }

  if (dragMode.mode === 'moving') {
    const dm = dragMode as { mode: 'moving'; componentId: string }
    const { x } = getSVGPoint(e)
    const comp = state.placedComponents.find(c => c.id === dm.componentId)
    if (comp) {
      const def = state.componentLibrary.find(d => d.id === comp.defId)
      if (def) {
        const raw = Math.round((x - MARGIN_LEFT) / PITCH) + 1
        const anchorCol = Math.max(1, Math.min(raw, BOARD_COLS - def.colSpan + 1))
        moveComponent(dm.componentId, anchorCol)
      }
    }
    dragMode = { mode: 'idle' }
    clearLayer(svg, 'preview-layer')
  }
}

function onSVGClick(e: MouseEvent): void {
  const target = e.target as SVGElement

  // Select a wire
  if (target.dataset.wireId) {
    selectItem(target.dataset.wireId, 'wire')
    return
  }

  // Select or deselect component
  if (target.dataset.componentId) {
    selectItem(target.dataset.componentId, 'component')
    return
  }

  // Complete component placement
  if (dragMode.mode === 'placing') {
    const dm = dragMode as { mode: 'placing'; defId: string }
    const def = state.componentLibrary.find(d => d.id === dm.defId)
    if (!def) return
    const { x } = getSVGPoint(e)
    const raw = Math.round((x - MARGIN_LEFT) / PITCH) + 1
    const anchorCol = Math.max(1, Math.min(raw, BOARD_COLS - def.colSpan + 1))
    placeComponent(dm.defId, anchorCol)
    dragMode = { mode: 'idle' }
    clearLayer(svg, 'preview-layer')
    svg.classList.remove('placing')
    return
  }

  // Click on empty space deselects
  if (!target.dataset.hole && !target.dataset.wireId && !target.dataset.componentId) {
    selectItem(null, null)
  }
}
