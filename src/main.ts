import { state, onStateChange, addComponentDef, updateComponentDef, removeComponentDef, setComponentColor, toggleComponentLock, toggleComponentVisibility, rotateComponent, removeComponent, selectItem } from './state'
import { COMPONENT_COLORS, getColor } from './colors'
import { initSVG, render, renderSidebar } from './render'
import { renderWiresList } from './layers'
import { initDrag, startPlacement, cancelCurrentDrag, deleteSelected } from './drag'
import { renderTable } from './table'
import { renderLayersPanel } from './layers'
import { MARGIN_LEFT, MARGIN_TOP, PITCH, HOLE_RADIUS, ROW_Y_UNITS, SVG_WIDTH, SVG_HEIGHT } from './board'

const canvasContainer = document.getElementById('canvas-container')  as HTMLDivElement
const canvasScrollArea= document.getElementById('canvas-scroll-area') as HTMLDivElement
const tableInner      = document.getElementById('table-inner')       as HTMLDivElement
const sidebarList      = document.getElementById('component-list')    as HTMLUListElement
const layersList       = document.getElementById('layers-list')       as HTMLUListElement
const wiresList        = document.getElementById('wires-list')        as HTMLUListElement
const componentsLabel  = document.getElementById('components-label')  as HTMLElement
const wiresLabel       = document.getElementById('wires-label')       as HTMLElement
const ctxMenu         = document.getElementById('context-menu')      as HTMLDivElement
const ctxRotateItem   = document.getElementById('ctx-rotate')        as HTMLLIElement
const ctxLockItem     = document.getElementById('ctx-toggle-lock')   as HTMLLIElement
const zoomInBtn       = document.getElementById('zoom-in')           as HTMLButtonElement
const zoomOutBtn      = document.getElementById('zoom-out')          as HTMLButtonElement
const zoomFitBtn      = document.getElementById('zoom-fit')          as HTMLButtonElement
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
zoomFitBtn.addEventListener('click', () => fitToScreen())

// ── Panel resize ────────────────────────────────────────────────────────
const sidebarEl         = document.getElementById('sidebar')                as HTMLElement
const layersPanelEl     = document.getElementById('layers-panel')           as HTMLElement
const tableContainerEl  = document.getElementById('table-container')        as HTMLElement
const sidebarHandle     = document.getElementById('sidebar-resize-handle')  as HTMLDivElement
const layersHandle      = document.getElementById('layers-resize-handle')   as HTMLDivElement
const tableHandle       = document.getElementById('table-resize-handle')    as HTMLDivElement

type ResizeDir = 'left' | 'right' | 'table'
interface ResizeState {
  dir:       ResizeDir
  startX:    number
  startY:    number
  startSize: number
  handle:    HTMLDivElement
}
let activeResize: ResizeState | null = null

function startResize(dir: ResizeDir, e: MouseEvent, handle: HTMLDivElement, el: HTMLElement): void {
  activeResize = {
    dir,
    startX:    e.clientX,
    startY:    e.clientY,
    startSize: dir === 'table' ? el.offsetHeight : el.offsetWidth,
    handle,
  }
  handle.classList.add('dragging')
  document.body.style.cursor     = dir === 'table' ? 'ns-resize' : 'ew-resize'
  document.body.style.userSelect = 'none'
}

const UI_STORAGE_KEY = 'breadboard-ui'

function saveUI(): void {
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({
      sidebarWidth:  sidebarEl.offsetWidth,
      layersWidth:   layersPanelEl.offsetWidth,
      tableHeight:   tableContainerEl.offsetHeight,
    }))
  } catch { /* ignore */ }
}

function loadUI(): void {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY)
    if (!raw) return
    const { sidebarWidth, layersWidth, tableHeight } = JSON.parse(raw)
    if (sidebarWidth)  sidebarEl.style.width         = `${sidebarWidth}px`
    if (layersWidth)   layersPanelEl.style.width      = `${layersWidth}px`
    if (tableHeight)   tableContainerEl.style.height  = `${tableHeight}px`
  } catch { /* ignore */ }
}

loadUI()

sidebarHandle.addEventListener('mousedown', (e) => startResize('left',  e, sidebarHandle, sidebarEl))
layersHandle.addEventListener('mousedown',  (e) => startResize('right', e, layersHandle,  layersPanelEl))
tableHandle.addEventListener('mousedown',   (e) => startResize('table', e, tableHandle,   tableContainerEl))

document.addEventListener('mousemove', (e) => {
  if (!activeResize) return
  if (activeResize.dir === 'table') {
    const h = Math.max(40, Math.min(500, activeResize.startSize - (e.clientY - activeResize.startY)))
    tableContainerEl.style.height = `${h}px`
  } else {
    const delta = e.clientX - activeResize.startX
    const raw   = activeResize.dir === 'left'
      ? activeResize.startSize + delta
      : activeResize.startSize - delta
    const el    = activeResize.dir === 'left' ? sidebarEl : layersPanelEl
    el.style.width = `${Math.max(160, Math.min(480, raw))}px`
  }
})

document.addEventListener('mouseup', () => {
  if (!activeResize) return
  activeResize.handle.classList.remove('dragging')
  document.body.style.cursor     = ''
  document.body.style.userSelect = ''
  activeResize = null
  saveUI()
})

let editingDefId: string | null = null

// ── Library search ───────────────────────────────────────────────────────────
const librarySearch      = document.getElementById('library-search')       as HTMLInputElement
const libraryDropdown    = document.getElementById('library-dropdown')     as HTMLUListElement
const librarySearchClear = document.getElementById('library-search-clear') as HTMLButtonElement

let dropdownIds: string[] = []
let dropdownCursor = -1

const DD_PENCIL = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`

const dismissedRecents = new Set<string>()

function getRecentDefIds(): string[] {
  const seen = new Set<string>()
  const recent: string[] = []
  for (let i = state.placedComponents.length - 1; i >= 0; i--) {
    const { defId } = state.placedComponents[i]
    if (!seen.has(defId) && !dismissedRecents.has(defId) && state.componentLibrary.some(d => d.id === defId)) {
      seen.add(defId)
      recent.unshift(defId)
      if (recent.length >= 6) break
    }
  }
  return recent
}

function dismissRecent(defId: string): void {
  dismissedRecents.add(defId)
  update()
}

function buildDropdownItem(def: { id: string; name: string }): HTMLLIElement {
  const li = document.createElement('li')
  li.dataset.defId = def.id

  const nameSpan = document.createElement('span')
  nameSpan.className   = 'dd-item-name'
  nameSpan.textContent = def.name

  const editBtn = document.createElement('button')
  editBtn.className   = 'dd-edit-btn'
  editBtn.innerHTML   = DD_PENCIL
  editBtn.title       = 'Edit'
  editBtn.addEventListener('mousedown', (e) => {
    e.preventDefault(); e.stopPropagation()
    libraryDropdown.classList.remove('visible')
    enterEditMode(def.id)
  })

  li.appendChild(nameSpan)
  li.appendChild(editBtn)
  li.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    pickFromDropdown(def.id)
  })
  return li
}

function renderDropdown(query: string, forceRecents = false): void {
  libraryDropdown.innerHTML = ''
  dropdownCursor = -1

  const q = query.trim().toLowerCase()

  if (!q || forceRecents) {
    const recentIds = getRecentDefIds()
    if (recentIds.length === 0) { libraryDropdown.classList.remove('visible'); return }
    const header = document.createElement('li')
    header.className   = 'dd-header'
    header.textContent = 'Recent'
    libraryDropdown.appendChild(header)
    dropdownIds = recentIds
    for (const id of recentIds) {
      const def = state.componentLibrary.find(d => d.id === id)
      if (def) libraryDropdown.appendChild(buildDropdownItem(def))
    }
  } else {
    const matches = state.componentLibrary.filter(d => d.name.toLowerCase().includes(q))
    if (matches.length === 0) { libraryDropdown.classList.remove('visible'); return }
    dropdownIds = matches.map(d => d.id)
    for (const def of matches) libraryDropdown.appendChild(buildDropdownItem(def))
  }

  libraryDropdown.classList.add('visible')
}

function moveCursor(delta: number): void {
  const items = Array.from(libraryDropdown.querySelectorAll<HTMLElement>('li:not(.dd-header)'))
  dropdownCursor = Math.max(0, Math.min(items.length - 1, dropdownCursor + delta))
  items.forEach((el, i) => {
    el.classList.toggle('highlighted', i === dropdownCursor)
    if (i === dropdownCursor) el.scrollIntoView({ block: 'nearest' })
  })
}

function pickFromDropdown(defId: string): void {
  librarySearch.value = ''
  libraryDropdown.classList.remove('visible')
  dropdownIds = []; dropdownCursor = -1
  startPlacement(defId)
}

function updateClearBtn(): void {
  librarySearchClear.classList.toggle('visible', librarySearch.value.length > 0)
}

librarySearchClear.addEventListener('mousedown', (e) => {
  e.preventDefault()
  librarySearch.value = ''
  updateClearBtn()
  renderDropdown('', true)
  librarySearch.focus()
})

librarySearch.addEventListener('focus',  () => { renderDropdown(librarySearch.value, true); updateClearBtn() })
librarySearch.addEventListener('input',  () => { renderDropdown(librarySearch.value); updateClearBtn() })
librarySearch.addEventListener('blur',   () => setTimeout(() => libraryDropdown.classList.remove('visible'), 150))
librarySearch.addEventListener('keydown', (e) => {
  if (!libraryDropdown.classList.contains('visible')) return
  if (e.key === 'ArrowDown')                        { e.preventDefault(); moveCursor(+1) }
  else if (e.key === 'ArrowUp')                     { e.preventDefault(); moveCursor(-1) }
  else if (e.key === 'Enter' || e.key === 'Return') {
    e.preventDefault()
    const id = dropdownCursor >= 0 ? dropdownIds[dropdownCursor] : dropdownIds[0]
    if (id) pickFromDropdown(id)
  } else if (e.key === 'Escape') {
    libraryDropdown.classList.remove('visible'); librarySearch.blur()
  }
})

// ── Color picker ─────────────────────────────────────────────────────────────
const colorPicker = document.getElementById('color-picker') as HTMLDivElement
let colorPickerTarget: string | null = null

COMPONENT_COLORS.forEach((c, idx) => {
  const swatch = document.createElement('button')
  swatch.className        = 'color-swatch'
  swatch.style.background = c.stroke
  swatch.title            = `Color ${idx + 1}`
  swatch.addEventListener('click', () => {
    if (colorPickerTarget) setComponentColor(colorPickerTarget, idx)
    hideColorPicker()
  })
  colorPicker.appendChild(swatch)
})

function showColorPicker(compId: string, anchor: HTMLElement): void {
  colorPickerTarget = compId
  const rect = anchor.getBoundingClientRect()
  // highlight current swatch
  const current = state.placedComponents.find(c => c.id === compId)?.colorIdx ?? -1
  colorPicker.querySelectorAll<HTMLButtonElement>('.color-swatch').forEach((s, i) => {
    s.classList.toggle('current', i === current)
  })
  colorPicker.style.top   = `${rect.top}px`
  colorPicker.style.right = `${window.innerWidth - rect.left + 6}px`
  colorPicker.classList.add('visible')
}

function hideColorPicker(): void {
  colorPickerTarget = null
  colorPicker.classList.remove('visible')
}

const recentsLabel = document.getElementById('recents-label')                    as HTMLElement
const libraryLabel = document.querySelector('.panel-label[data-label="library"]') as HTMLElement

function update(): void {
  render(svg, state)
  const recentIds = getRecentDefIds()
  renderSidebar(sidebarList, state.componentLibrary, recentIds, dismissRecent, editingDefId)
  if (recentsLabel) {
    recentsLabel.style.display = recentIds.length ? '' : 'none'
    recentsLabel.textContent   = `Recents (${recentIds.length})`
  }
  if (libraryLabel) libraryLabel.textContent = `Library (${state.componentLibrary.length})`
  componentsLabel.textContent = `Components (${state.placedComponents.length})`
  wiresLabel.textContent      = `Wires (${state.wires.length})`
  renderTable(tableInner, state)
  renderLayersPanel(layersList, state.placedComponents, state.componentLibrary, state.selectedId)
  renderWiresList(wiresList, state)
}

function fitToScreen(): void {
  const area    = canvasScrollArea.getBoundingClientRect()
  const padding = 48
  const scaleX  = (area.width  - padding) / SVG_WIDTH
  const scaleY  = (area.height - padding) / SVG_HEIGHT
  setZoom(Math.min(scaleX, scaleY))
}

onStateChange(update)
update()
requestAnimationFrame(() => fitToScreen())

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

ctxRotateItem.addEventListener('click', () => {
  if (ctxTargetId) rotateComponent(ctxTargetId)
  hideContextMenu()
})

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
  if (!ctxMenu.contains(e.target as Node))    hideContextMenu()
  if (!colorPicker.contains(e.target as Node)) hideColorPicker()
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
  else if (action === 'rotate') rotateComponent(compId)
  else if (action === 'delete') removeComponent(compId)
  else if (action === 'color')  showColorPicker(compId, btn as HTMLElement)
  else                          selectItem(compId, 'component')
})

// --- Wires list ---

wiresList.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  const li     = target.closest('.wire-item') as HTMLElement | null
  if (!li) return
  const wireId = li.dataset.wireId!
  e.stopPropagation()
  if (target.closest('[data-action="delete-wire"]')) removeWire(wireId)
  else selectItem(wireId, 'wire')
})

// --- Sidebar + edit mode ---

const addComponentSection = document.getElementById('add-component-section') as HTMLDivElement
const addComponentToggle  = document.getElementById('add-component-toggle')  as HTMLButtonElement
const formPanelLabel      = document.getElementById('form-panel-label')      as HTMLDivElement
const submitBtn           = document.getElementById('form-submit-btn')        as HTMLButtonElement
const cancelBtn           = document.getElementById('form-cancel-btn')        as HTMLButtonElement
const deleteBtn           = document.getElementById('form-delete-btn')        as HTMLButtonElement

function showFormSection(): void {
  addComponentSection.style.display = ''
  addComponentToggle.textContent    = '× Close'
  addComponentToggle.classList.add('open')
}

function hideFormSection(): void {
  addComponentSection.style.display = 'none'
  addComponentToggle.textContent    = '+ Add component'
  addComponentToggle.classList.remove('open')
}

addComponentToggle.addEventListener('click', () => {
  if (addComponentSection.style.display === 'none') showFormSection()
  else { exitEditMode(); hideFormSection() }
})

function enterEditMode(defId: string): void {
  const def = state.componentLibrary.find(d => d.id === defId)
  if (!def) return
  editingDefId = defId

  nameInput.value    = def.name
  colSpanInput.value = String(def.colSpan)
  rowSpanInput.value = String(def.rowSpan)

  const topPins    = def.pins.filter(p => p.row === 'top').sort((a, b) => a.col - b.col).map(p => p.name)
  const bottomPins = def.pins.filter(p => p.row === 'bottom').sort((a, b) => a.col - b.col).map(p => p.name)
  pinsInput.value   = [topPins.join(' '), bottomPins.join(' ')].filter(l => l.length > 0).join('\n')

  showFormSection()
  formPanelLabel.textContent = `Edit — ${def.name}`
  submitBtn.textContent      = 'Save changes'
  cancelBtn.style.display    = 'block'
  deleteBtn.style.display    = 'block'
  deleteBtn.textContent      = 'Delete from library'
  deleteBtn.classList.remove('danger')

  document.getElementById('add-form-body')!.scrollIntoView({ behavior: 'smooth', block: 'start' })
  nameInput.focus()
  update()
}

function exitEditMode(): void {
  editingDefId = null
  nameInput.value    = ''
  colSpanInput.value = ''
  rowSpanInput.value = ''
  pinsInput.value    = ''
  hideFormSection()
  formPanelLabel.textContent = 'Add component'
  submitBtn.textContent      = 'Add to library'
  cancelBtn.style.display    = 'none'
  deleteBtn.style.display    = 'none'
  deleteBtn.textContent      = 'Delete from library'
  deleteBtn.classList.remove('danger')
  update()
}

cancelBtn.addEventListener('click', exitEditMode)

deleteBtn.addEventListener('click', () => {
  if (!deleteBtn.classList.contains('danger')) {
    deleteBtn.classList.add('danger')
    deleteBtn.textContent = 'Confirm delete?'
  } else {
    const id = editingDefId!
    exitEditMode()
    removeComponentDef(id)
  }
})

sidebarList.addEventListener('click', (e) => {
  const target    = e.target as HTMLElement
  const actionBtn = target.closest('[data-action]') as HTMLElement | null
  const li        = target.closest('[data-def-id]') as HTMLElement | null
  if (!li) return
  const defId = li.dataset.defId!

  const action = actionBtn?.dataset.action
  if (action === 'edit') { enterEditMode(defId); return }

  document.querySelectorAll('#component-list li').forEach(el => el.classList.remove('active'))
  li.classList.add('active')
  startPlacement(defId)
})

// --- Keyboard ---

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape')                          { hideContextMenu(); cancelCurrentDrag() }
  if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
  if ((e.ctrlKey || e.metaKey) && e.key === '=')  { e.preventDefault(); setZoom(zoomLevel * 1.25) }
  if ((e.ctrlKey || e.metaKey) && e.key === '-')  { e.preventDefault(); setZoom(zoomLevel / 1.25) }
  if ((e.ctrlKey || e.metaKey) && e.key === '0')  { e.preventDefault(); setZoom(1) }
})

// --- Component form (add + edit) ---

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
    .flatMap(line => line.trim().split(/\s+/))
    .filter(s => s.length > 0)

  if (!name || isNaN(colSpan) || colSpan < 1 || isNaN(rowSpan) || rowSpan < 1) return

  const topCount    = Math.ceil(pinNames.length / 2)
  const bottomCount = Math.floor(pinNames.length / 2)

  const pins = [
    ...pinNames.slice(0, topCount).map((pname, i) => ({ name: pname, col: i, row: 'top'    as const })),
    ...pinNames.slice(topCount, topCount + bottomCount).map((pname, i) => ({ name: pname, col: i, row: 'bottom' as const })),
  ]

  if (editingDefId) {
    updateComponentDef(editingDefId, { name, colSpan, rowSpan, pins })
    exitEditMode()
  } else {
    addComponentDef({ name, colSpan, rowSpan, pins })
    nameInput.value    = ''
    colSpanInput.value = ''
    rowSpanInput.value = ''
    pinsInput.value    = ''
    hideFormSection()
  }
})
