import { state, onStateChange, initDB, addComponentDef, updateComponentDef, removeComponentDef, setComponentColor, toggleComponentLock, toggleComponentVisibility, rotateComponent, removeComponent, removeWire, addJumperDef, removeJumperDef, updateJumperDef, setActiveJumperSet, selectItem } from './state'
import { matchJumper, COPPER_COLOR } from './jumpers'
import { COMPONENT_COLORS, getColor } from './colors'
import { initSVG, render, renderSidebar } from './render'
import { renderWiresList } from './layers'
import { initDrag, startPlacement, cancelCurrentDrag, deleteSelected } from './drag'
import { renderTable } from './table'
import type { Net } from './nets'
import { renderLayersPanel } from './layers'
import { MARGIN_LEFT, MARGIN_TOP, PITCH, HOLE_RADIUS, ROW_Y_UNITS, SVG_WIDTH, SVG_HEIGHT, BOARD_COLS, getHolePosition } from './board'

const canvasContainer = document.getElementById('canvas-container')  as HTMLDivElement
const canvasScrollArea= document.getElementById('canvas-scroll-area') as HTMLDivElement
const tableInner      = document.getElementById('table-inner')       as HTMLDivElement
const sidebarList      = document.getElementById('component-list')    as HTMLUListElement
const layersList       = document.getElementById('layers-list')       as HTMLUListElement
const wiresList        = document.getElementById('wires-list')        as HTMLUListElement
const componentsLabel  = document.getElementById('components-label')  as HTMLElement
const wiresLabel       = document.getElementById('wires-label')       as HTMLElement

function makeCollapsible(label: HTMLElement, content: HTMLElement): void {
  label.classList.add('collapsible')
  label.addEventListener('click', () => {
    const closing = content.style.display !== 'none'
    content.style.display = closing ? 'none' : ''
    label.classList.toggle('collapsed', closing)
  })
}
const ctxMenu         = document.getElementById('context-menu')      as HTMLDivElement
const ctxRotateItem   = document.getElementById('ctx-rotate')        as HTMLLIElement
const ctxLockItem     = document.getElementById('ctx-toggle-lock')   as HTMLLIElement
const zoomInBtn       = document.getElementById('zoom-in')           as HTMLButtonElement
const zoomOutBtn      = document.getElementById('zoom-out')          as HTMLButtonElement
const zoomFitBtn      = document.getElementById('zoom-fit')          as HTMLButtonElement
const zoomLabel       = document.getElementById('zoom-label')        as HTMLSpanElement

const svg = initSVG(canvasContainer)
initDrag(svg)

// ── Hover labels ─────────────────────────────────────────────────────────
{
  const hoverColTop    = svg.querySelector('#hover-col-top')    as SVGTextElement
  const hoverColBottom = svg.querySelector('#hover-col-bottom') as SVGTextElement
  const hoverRowLeft   = svg.querySelector('#hover-row-left')   as SVGTextElement
  const hoverRowRight  = svg.querySelector('#hover-row-right')  as SVGTextElement
  const hoverEls       = [hoverColTop, hoverColBottom, hoverRowLeft, hoverRowRight]

  const colYTop       = MARGIN_TOP + ROW_Y_UNITS['J'] * PITCH - HOLE_RADIUS - 5
  const colYBottom    = MARGIN_TOP + ROW_Y_UNITS['A'] * PITCH + HOLE_RADIUS + 11
  const rowXLeft      = MARGIN_LEFT   - 8
  const rowXRight     = MARGIN_LEFT   + (BOARD_COLS - 1) * PITCH + 8

  function showHoverLabels(hole: string): void {
    let col: number, rowText: string, rowY: number
    if (hole.includes(':')) {
      const colon = hole.lastIndexOf(':')
      const rail  = hole.slice(0, colon)
      col     = parseInt(hole.slice(colon + 1))
      rowText = rail.endsWith('+') ? '+' : '−'
      rowY    = MARGIN_TOP + ROW_Y_UNITS[rail] * PITCH
    } else {
      rowText = hole[0]
      col     = parseInt(hole.slice(1))
      rowY    = MARGIN_TOP + ROW_Y_UNITS[rowText] * PITCH
    }
    const x = MARGIN_LEFT + (col - 1) * PITCH

    hoverColTop.setAttribute('x', String(x)); hoverColTop.setAttribute('y', String(colYTop))
    hoverColTop.setAttribute('text-anchor', 'middle'); hoverColTop.textContent = String(col)
    hoverColTop.setAttribute('visibility', 'visible')

    hoverColBottom.setAttribute('x', String(x)); hoverColBottom.setAttribute('y', String(colYBottom))
    hoverColBottom.setAttribute('text-anchor', 'middle'); hoverColBottom.textContent = String(col)
    hoverColBottom.setAttribute('visibility', 'visible')

    hoverRowLeft.setAttribute('x', String(rowXLeft)); hoverRowLeft.setAttribute('y', String(rowY + 3))
    hoverRowLeft.setAttribute('text-anchor', 'end'); hoverRowLeft.textContent = rowText
    hoverRowLeft.setAttribute('visibility', 'visible')

    hoverRowRight.setAttribute('x', String(rowXRight)); hoverRowRight.setAttribute('y', String(rowY + 3))
    hoverRowRight.setAttribute('text-anchor', 'start'); hoverRowRight.textContent = rowText
    hoverRowRight.setAttribute('visibility', 'visible')
  }

  function hideHoverLabels(): void {
    hoverEls.forEach(el => el.setAttribute('visibility', 'hidden'))
  }

  svg.addEventListener('mouseover', (e) => {
    const hole = (e.target as SVGElement).dataset?.hole
    if (hole) showHoverLabels(hole)
    else hideHoverLabels()
  })
  svg.addEventListener('mouseleave', hideHoverLabels)
}

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

// ── Theme toggle ─────────────────────────────────────────────────────────
const themeToggleBtn = document.getElementById('theme-toggle') as HTMLButtonElement

function applyTheme(theme: 'dark' | 'light'): void {
  if (theme === 'light') document.documentElement.dataset.theme = 'light'
  else                   delete document.documentElement.dataset.theme
  localStorage.setItem('breadboard-theme', theme)
}

themeToggleBtn.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light')
})

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

// ── Jumper library ───────────────────────────────────────────────────────────
const jumperLibraryToggle  = document.getElementById('jumper-library-toggle')  as HTMLButtonElement
const jumperLibrarySection = document.getElementById('jumper-library-section') as HTMLDivElement
const jumperListEl         = document.getElementById('jumper-list')             as HTMLUListElement
const jumperPaletteEl      = document.getElementById('jumper-palette')          as HTMLDivElement
const jumperColorInput     = document.getElementById('jumper-color')            as HTMLInputElement
const jumperPitchInput     = document.getElementById('jumper-pitch')            as HTMLInputElement

// ── Build jumper colour palette ───────────────────────────────────────────
const JUMPER_PALETTE = [
  '#e53935','#fb8c00','#fdd835','#43a047',
  '#1e88e5','#00acc1','#8e24aa','#e91e63',
  '#212121','#757575','#f5f5f5','#795548',
]

let activeJumperColor = JUMPER_PALETTE[0]

function selectPaletteSwatch(color: string, el: HTMLElement): void {
  activeJumperColor      = color
  jumperColorInput.value = color
  jumperPaletteEl.querySelectorAll<HTMLElement>('.j-swatch').forEach(s => s.classList.remove('selected'))
  el.classList.add('selected')
}

JUMPER_PALETTE.forEach(color => {
  const btn = document.createElement('button')
  btn.type             = 'button'
  btn.className        = 'j-swatch'
  btn.style.background = color
  btn.title            = color
  if (color === activeJumperColor) btn.classList.add('selected')
  btn.addEventListener('click', () => selectPaletteSwatch(color, btn))
  jumperPaletteEl.appendChild(btn)
})

const customSwatch = document.createElement('button')
customSwatch.type      = 'button'
customSwatch.className = 'j-swatch j-swatch-custom'
customSwatch.title     = 'Custom colour'
customSwatch.addEventListener('click', () => jumperColorInput.click())
jumperPaletteEl.appendChild(customSwatch)

jumperColorInput.addEventListener('input', () => {
  activeJumperColor              = jumperColorInput.value
  customSwatch.style.background  = jumperColorInput.value
  jumperPaletteEl.querySelectorAll<HTMLElement>('.j-swatch').forEach(s => s.classList.remove('selected'))
  customSwatch.classList.add('selected')
})
const jumperSetSelect      = document.getElementById('jumper-set-select')        as HTMLSelectElement
const jumperForm           = document.getElementById('add-jumper-form')         as HTMLFormElement
const jumperSubmitBtn      = document.getElementById('jumper-submit-btn')        as HTMLButtonElement
const jumperCancelBtn      = document.getElementById('jumper-cancel-btn')        as HTMLButtonElement
const bomLabel             = document.getElementById('bom-label')               as HTMLElement
const bomInner             = document.getElementById('bom-inner')               as HTMLDivElement

let editingJumperPitch: number | null = null

function enterJumperEdit(pitch: number): void {
  const j = state.jumperLibrary.find(j => j.pitch === pitch)
  if (!j) return
  editingJumperPitch = pitch
  jumperPitchInput.value = String(j.pitch)
  // select the matching palette swatch or fall back to custom
  const paletteMatch = JUMPER_PALETTE.indexOf(j.color)
  jumperPaletteEl.querySelectorAll<HTMLElement>('.j-swatch').forEach(s => s.classList.remove('selected'))
  if (paletteMatch !== -1) {
    const swatches = jumperPaletteEl.querySelectorAll<HTMLElement>('.j-swatch:not(.j-swatch-custom)')
    swatches[paletteMatch]?.classList.add('selected')
  } else {
    customSwatch.style.background = j.color
    customSwatch.classList.add('selected')
    jumperColorInput.value = j.color
  }
  activeJumperColor           = j.color
  jumperSubmitBtn.textContent = 'Save changes'
  jumperCancelBtn.style.display = ''
  showJumperSection()
  jumperPitchInput.focus()
  renderJumperList()
}

function exitJumperEdit(): void {
  editingJumperPitch = null
  jumperPitchInput.value = ''
  jumperSubmitBtn.textContent   = 'Add jumper'
  jumperCancelBtn.style.display = 'none'
  renderJumperList()
}

jumperCancelBtn.addEventListener('click', exitJumperEdit)

function showJumperSection(): void {
  jumperLibrarySection.style.display = ''
  jumperLibraryToggle.classList.add('open')
}
function hideJumperSection(): void {
  jumperLibrarySection.style.display = 'none'
  jumperLibraryToggle.classList.remove('open')
}

jumperLibraryToggle.addEventListener('click', () => {
  jumperLibrarySection.style.display === 'none' ? showJumperSection() : hideJumperSection()
})

jumperForm.addEventListener('submit', (e) => {
  e.preventDefault()
  const pitch = parseFloat(jumperPitchInput.value)
  if (isNaN(pitch) || pitch <= 0) return
  if (editingJumperPitch !== null) {
    updateJumperDef(editingJumperPitch, { color: activeJumperColor, pitch })
    exitJumperEdit()
  } else {
    addJumperDef(activeJumperColor, pitch)
    jumperPitchInput.value = ''
  }
})

function renderJumperSetSelector(): void {
  jumperSetSelect.innerHTML = '<option value="">— none —</option>'
  for (const set of state.jumperSets) {
    const opt = document.createElement('option')
    opt.value       = set.id
    opt.textContent = set.name
    jumperSetSelect.appendChild(opt)
  }
  jumperSetSelect.value = state.activeJumperSetId ?? ''
}

jumperSetSelect.addEventListener('change', () => {
  setActiveJumperSet(jumperSetSelect.value || null)
})

function renderJumperList(): void {
  jumperListEl.innerHTML = ''
  if (state.jumperLibrary.length === 0) {
    const hint = document.createElement('li')
    hint.className   = 'comp-item-hint'
    hint.textContent = 'No jumpers defined'
    jumperListEl.appendChild(hint)
    return
  }
  for (const j of state.jumperLibrary) {
    const li = document.createElement('li')
    li.className = j.pitch === editingJumperPitch ? 'jumper-item editing' : 'jumper-item'

    const dot = document.createElement('span')
    dot.className        = 'jumper-color-dot'
    dot.style.background = j.color

    const info = document.createElement('span')
    info.className   = 'jumper-info'
    info.textContent = `${j.pitch}p`

    const edit = document.createElement('button')
    edit.className = 'jumper-edit-btn'
    edit.title     = 'Edit'
    edit.innerHTML = DD_PENCIL
    edit.addEventListener('click', () => enterJumperEdit(j.pitch))

    const del = document.createElement('button')
    del.className   = 'comp-del-btn'
    del.title       = 'Remove'
    del.textContent = '×'
    del.addEventListener('click', () => {
      if (editingJumperPitch === j.pitch) exitJumperEdit()
      removeJumperDef(j.pitch)
    })

    li.appendChild(dot)
    li.appendChild(info)
    li.appendChild(edit)
    li.appendChild(del)
    jumperListEl.appendChild(li)
  }
}

function renderBoM(): void {
  if (!state.wires.length || !state.jumperLibrary.length) {
    bomLabel.style.display = 'none'
    bomInner.innerHTML     = ''
    return
  }
  bomLabel.style.display = ''

  const wireLen = (from: string, to: string) => {
    const a = getHolePosition(from), b = getHolePosition(to)
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) / PITCH
  }

  const counts = new Map<string, { name: string; color: string; count: number; len: number }>()
  for (const wire of state.wires) {
    const m = matchJumper(wire.from, wire.to, state.jumperLibrary)
    let key: string, name: string, color: string, len: number
    if (m) {
      key = String(m.pitch); name = `${m.pitch}p`; color = m.color; len = m.pitch
    } else {
      len  = wireLen(wire.from, wire.to)
      key  = `__custom__${Math.round(len * 10)}`
      name = `${+len.toFixed(1)}p*`
      color = COPPER_COLOR
    }
    if (!counts.has(key)) counts.set(key, { name, color, count: 0, len })
    counts.get(key)!.count++
  }

  bomInner.innerHTML = ''
  const ul = document.createElement('ul')
  ul.className = 'bom-list'
  for (const item of [...counts.values()].sort((a, b) => a.len - b.len)) {
    const li = document.createElement('li')
    li.className = 'bom-item'

    const dot = document.createElement('span')
    dot.className        = 'bom-color-dot'
    dot.style.background = item.color

    const name = document.createElement('span')
    name.className   = 'bom-name'
    name.textContent = item.name

    const count = document.createElement('span')
    count.className   = 'bom-count'
    count.textContent = `×${item.count}`

    li.appendChild(dot); li.appendChild(name); li.appendChild(count)
    ul.appendChild(li)
  }
  bomInner.appendChild(ul)
}

const recentsLabel = document.getElementById('recents-label')                    as HTMLElement
const libraryLabel = document.querySelector('.panel-label[data-label="library"]') as HTMLElement

let lastNets: Net[] = []

// Highlight all wires in a net when hovering a connections table row
let tableHoverIds: string[] = []

function setTableHover(netRoot: string | null): void {
  for (const id of tableHoverIds)
    svg.querySelector(`[data-wire-id="${id}"]`)?.classList.remove('panel-hover')
  tableHoverIds = []
  if (!netRoot) return
  const net = lastNets.find(n => n.root === netRoot)
  if (!net) return
  for (const id of net.wireIds) {
    const el = svg.querySelector(`[data-wire-id="${id}"]`)
    if (el) { el.classList.add('panel-hover'); tableHoverIds.push(id) }
  }
}

tableInner.addEventListener('mouseover', (e) => {
  const row = (e.target as HTMLElement).closest('tr') as HTMLElement | null
  setTableHover(row?.dataset.netRoot ?? null)
})
tableInner.addEventListener('mouseleave', () => setTableHover(null))

function update(): void {
  render(svg, state)
  const recentIds = getRecentDefIds()
  renderSidebar(sidebarList, state.componentLibrary, recentIds, dismissRecent, editingDefId)
  if (recentsLabel) {
    recentsLabel.style.display = recentIds.length ? '' : 'none'
    recentsLabel.textContent   = `Recents (${recentIds.length})`
  }
  if (libraryLabel) libraryLabel.textContent = `Library (${state.componentLibrary.length})`
  componentsLabel.textContent  = `Components (${state.placedComponents.length})`
  wiresLabel.textContent       = `Wires (${state.wires.length})`
  lastNets = renderTable(tableInner, state)
  renderLayersPanel(layersList, state.placedComponents, state.componentLibrary, state.selectedId)
  renderWiresList(wiresList, state)
  renderJumperSetSelector()
  renderJumperList()
  renderBoM()
}

function fitToScreen(): void {
  const area    = canvasScrollArea.getBoundingClientRect()
  const padding = 48
  const scaleX  = (area.width  - padding) / SVG_WIDTH
  const scaleY  = (area.height - padding) / SVG_HEIGHT
  setZoom(Math.min(scaleX, scaleY))
}

initDB().then(() => {
  onStateChange(update)
  update()
  requestAnimationFrame(() => fitToScreen())
})

makeCollapsible(componentsLabel, layersList)
makeCollapsible(wiresLabel,      wiresList)
makeCollapsible(bomLabel,        bomInner)

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

let panelHoveredWireId: string | null = null

function setPanelWireHover(wireId: string | null): void {
  if (panelHoveredWireId) {
    svg.querySelector(`[data-wire-id="${panelHoveredWireId}"]`)?.classList.remove('panel-hover')
  }
  panelHoveredWireId = wireId
  if (wireId) {
    svg.querySelector(`[data-wire-id="${wireId}"]`)?.classList.add('panel-hover')
  }
}

wiresList.addEventListener('mouseover', (e) => {
  const li = (e.target as HTMLElement).closest('.wire-item') as HTMLElement | null
  const id = li?.dataset.wireId ?? null
  if (id !== panelHoveredWireId) setPanelWireHover(id)
})
wiresList.addEventListener('mouseleave', () => setPanelWireHover(null))

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
  addComponentToggle.classList.add('open')
}

function hideFormSection(): void {
  addComponentSection.style.display = 'none'
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
const rowSpanInput = document.getElementById('comp-rowspan')       as HTMLInputElement
const pinsInput    = document.getElementById('comp-pins')          as HTMLTextAreaElement

form.addEventListener('submit', (e) => {
  e.preventDefault()

  const name    = nameInput.value.trim()
  const rowSpan = parseInt(rowSpanInput.value, 10)
  if (!name || isNaN(rowSpan) || rowSpan < 1) return

  const lines = pinsInput.value
    .split('\n')
    .map(line => line.trim().split(/\s+/).filter(s => s.length > 0))
    .filter(l => l.length > 0)

  const topPins    = lines[0] ?? []
  const bottomPins = lines[1] ?? []
  const colSpan    = Math.max(topPins.length, bottomPins.length, 1)

  const pins = [
    ...topPins.map((pname, i)    => ({ name: pname, col: i, row: 'top'    as const })),
    ...bottomPins.map((pname, i) => ({ name: pname, col: i, row: 'bottom' as const })),
  ]

  if (editingDefId) {
    updateComponentDef(editingDefId, { name, colSpan, rowSpan, pins })
    exitEditMode()
  } else {
    addComponentDef({ name, colSpan, rowSpan, pins })
    nameInput.value    = ''
    rowSpanInput.value = ''
    pinsInput.value    = ''
    hideFormSection()
  }
})
