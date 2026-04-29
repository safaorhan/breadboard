import { state, onStateChange, addComponentDef, toggleComponentLock, toggleComponentVisibility, removeComponent, selectItem } from './state'
import { initSVG, render, renderSidebar } from './render'
import { initDrag, startPlacement, cancelCurrentDrag, deleteSelected } from './drag'
import { analyzeNets } from './nets'
import { renderTable } from './table'
import { renderLayersPanel } from './layers'
import { MARGIN_LEFT, MARGIN_TOP, PITCH, HOLE_RADIUS, ROW_Y_UNITS, SVG_WIDTH, SVG_HEIGHT } from './board'

const canvasContainer = document.getElementById('canvas-container')  as HTMLDivElement
const canvasScrollArea= document.getElementById('canvas-scroll-area') as HTMLDivElement
const tableInner      = document.getElementById('table-inner')       as HTMLDivElement
const sidebarList     = document.getElementById('component-list')    as HTMLUListElement
const layersList      = document.getElementById('layers-list')       as HTMLUListElement
const ctxMenu         = document.getElementById('context-menu')      as HTMLDivElement
const ctxLockItem     = document.getElementById('ctx-toggle-lock')   as HTMLLIElement
const zoomInBtn       = document.getElementById('zoom-in')           as HTMLButtonElement
const zoomOutBtn      = document.getElementById('zoom-out')          as HTMLButtonElement
const zoomLabel       = document.getElementById('zoom-label')        as HTMLSpanElement

const svg = initSVG(canvasContainer)
initDrag(svg)

// ── Zoom ────────────────────────────────────────────────────────────────
let zoomLevel = 1

function applyZoom(): void {
  svg.setAttribute('width',  String(Math.round(SVG_WIDTH  * zoomLevel)))
  svg.setAttribute('height', String(Math.round(SVG_HEIGHT * zoomLevel)))
  zoomLabel.textContent = `${Math.round(zoomLevel * 100)}%`
}

function setZoom(level: number, pivotClientX?: number, pivotClientY?: number): void {
  const clamped = Math.max(0.25, Math.min(4, level))
  if (clamped === zoomLevel) return

  if (pivotClientX !== undefined && pivotClientY !== undefined) {
    const rect    = canvasScrollArea.getBoundingClientRect()
    const beforeX = (pivotClientX - rect.left + canvasScrollArea.scrollLeft) / zoomLevel
    const beforeY = (pivotClientY - rect.top  + canvasScrollArea.scrollTop)  / zoomLevel
    zoomLevel = clamped
    applyZoom()
    canvasScrollArea.scrollLeft = beforeX * zoomLevel - (pivotClientX - rect.left)
    canvasScrollArea.scrollTop  = beforeY * zoomLevel - (pivotClientY - rect.top)
  } else {
    zoomLevel = clamped
    applyZoom()
  }
}

canvasScrollArea.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    setZoom(zoomLevel * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX, e.clientY)
  }
}, { passive: false })

zoomInBtn.addEventListener('click',  () => setZoom(zoomLevel * 1.25))
zoomOutBtn.addEventListener('click', () => setZoom(zoomLevel / 1.25))
zoomLabel.addEventListener('click',  () => setZoom(1))

function update(): void {
  render(svg, state)
  renderSidebar(sidebarList, state.componentLibrary)
  renderTable(tableInner, analyzeNets(state))
  renderLayersPanel(layersList, state.placedComponents, state.componentLibrary, state.selectedId)
}

onStateChange(update)
update()

// --- Context menu ---

let ctxTargetId: string | null = null

function showContextMenu(clientX: number, clientY: number, compId: string): void {
  ctxTargetId = compId
  const comp = state.placedComponents.find(c => c.id === compId)
  ctxLockItem.textContent = comp?.locked ? 'Unlock' : 'Lock'
  ctxMenu.style.left = `${clientX}px`
  ctxMenu.style.top  = `${clientY}px`
  ctxMenu.classList.add('visible')
}

function hideContextMenu(): void {
  ctxMenu.classList.remove('visible')
  ctxTargetId = null
}

ctxLockItem.addEventListener('click', () => {
  if (ctxTargetId) toggleComponentLock(ctxTargetId)
  hideContextMenu()
})

svg.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  const target = e.target as SVGElement
  const compEl = target.closest('[data-component-id]') as SVGElement | null
  const compId = compEl?.dataset.componentId ?? lockedComponentAt(e.clientX, e.clientY)
  if (compId) {
    showContextMenu(e.clientX, e.clientY, compId)
  } else {
    hideContextMenu()
    cancelCurrentDrag()
  }
})

function clientToSVG(clientX: number, clientY: number): { x: number; y: number } {
  const rect = svg.getBoundingClientRect()
  const vb   = svg.viewBox.baseVal
  return { x: (clientX - rect.left) * (vb.width / rect.width), y: (clientY - rect.top) * (vb.height / rect.height) }
}

function lockedComponentAt(clientX: number, clientY: number): string | null {
  const { x, y } = clientToSVG(clientX, clientY)
  for (const placed of state.placedComponents) {
    if (!placed.locked) continue
    const def = state.componentLibrary.find(d => d.id === placed.defId)
    if (!def) continue
    const bx = MARGIN_LEFT + (placed.anchorCol - 1) * PITCH - HOLE_RADIUS - 1
    const by = MARGIN_TOP  + ROW_Y_UNITS[placed.anchorRow] * PITCH - HOLE_RADIUS - 1
    const bw = (def.colSpan - 1) * PITCH + HOLE_RADIUS * 2 + 2
    const bh = def.rowSpan  * PITCH + HOLE_RADIUS * 2 + 2
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return placed.id
  }
  return null
}

document.addEventListener('click', (e) => {
  if (!ctxMenu.contains(e.target as Node)) hideContextMenu()
})

// --- Layers panel ---

layersList.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  const li     = target.closest('.layer-item')  as HTMLElement | null
  const btn    = target.closest('[data-action]') as HTMLElement | null
  if (!li) return
  const compId = li.dataset.compId
  if (!compId) return
  e.stopPropagation()

  const action = btn?.dataset.action
  if (action === 'visibility')  toggleComponentVisibility(compId)
  else if (action === 'lock')   toggleComponentLock(compId)
  else if (action === 'delete') removeComponent(compId)
  else                          selectItem(compId, 'component')
})

// --- Sidebar ---

sidebarList.addEventListener('click', (e) => {
  const li = (e.target as HTMLElement).closest('[data-def-id]') as HTMLElement | null
  if (!li) return
  document.querySelectorAll('#component-list li').forEach(el => el.classList.remove('active'))
  li.classList.add('active')
  startPlacement(li.dataset.defId!)
})

// --- Keyboard ---

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape')                          { hideContextMenu(); cancelCurrentDrag() }
  if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
  if ((e.ctrlKey || e.metaKey) && e.key === '=')  { e.preventDefault(); setZoom(zoomLevel * 1.25) }
  if ((e.ctrlKey || e.metaKey) && e.key === '-')  { e.preventDefault(); setZoom(zoomLevel / 1.25) }
  if ((e.ctrlKey || e.metaKey) && e.key === '0')  { e.preventDefault(); setZoom(1) }
})

// --- Custom component form ---

const form         = document.getElementById('add-component-form') as HTMLFormElement
const nameInput    = document.getElementById('comp-name')          as HTMLInputElement
const colSpanInput = document.getElementById('comp-colspan')       as HTMLInputElement
const rowSpanInput = document.getElementById('comp-rowspan')       as HTMLInputElement
const pinsInput    = document.getElementById('comp-pins')          as HTMLTextAreaElement

form.addEventListener('submit', (e) => {
  e.preventDefault()

  const name     = nameInput.value.trim()
  const colSpan  = parseInt(colSpanInput.value, 10)
  const rowSpan  = parseInt(rowSpanInput.value, 10)
  const pinNames = pinsInput.value
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  if (!name || isNaN(colSpan) || colSpan < 1 || isNaN(rowSpan) || rowSpan < 1) return

  const topCount    = Math.ceil(pinNames.length / 2)
  const bottomCount = Math.floor(pinNames.length / 2)

  const pins = [
    ...pinNames.slice(0, topCount).map((pname, i) => ({
      name: pname, col: i, row: 'top' as const,
    })),
    ...pinNames.slice(topCount, topCount + bottomCount).map((pname, i) => ({
      name: pname, col: i, row: 'bottom' as const,
    })),
  ]

  addComponentDef({ name, colSpan, rowSpan, pins })

  nameInput.value    = ''
  colSpanInput.value = ''
  rowSpanInput.value = ''
  pinsInput.value    = ''
})
