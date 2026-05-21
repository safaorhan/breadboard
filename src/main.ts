import { state, onStateChange, initDB, setComponentColor, setComponentLabel, toggleComponentLock, toggleComponentVisibility, rotateComponent, removeComponent, removeWire, selectItem, getActiveProjectId, getActiveProjectName, renameProject, updateThumbnail, openProject, createProject, deleteProjectById, getAllProjects, importProjectData, renameProjectById, addComponentDef, updateComponentDef, removeComponentDef, undo, redo, setActiveJumperSet, createJumperSet, updateJumperSet, deleteJumperSetById, createProjectFromExample } from './state'
import { EXAMPLE_PROJECTS } from './examples'
import type { BBFile } from './state'
import type { Project, StoredJumperSet } from './db'
import type { ComponentDef } from './types'
import { matchJumper, COPPER_COLOR } from './jumpers'
import { COMPONENT_COLORS } from './colors'
import { initSVG, render } from './render'
import { renderWiresList } from './layers'
import { initDrag, startPlacement, cancelCurrentDrag, deleteSelected } from './drag'
import { renderTable } from './table'
import type { Net } from './nets'
import { renderLayersPanel } from './layers'
import { MARGIN_LEFT, MARGIN_TOP, PITCH, HOLE_RADIUS, ROW_Y_UNITS, SVG_WIDTH, SVG_HEIGHT, BOARD_COLS, getHolePosition } from './board'

const canvasContainer  = document.getElementById('canvas-container')   as HTMLDivElement
const canvasScrollArea = document.getElementById('canvas-scroll-area')  as HTMLDivElement
const tableInner       = document.getElementById('table-inner')         as HTMLDivElement
const layersList       = document.getElementById('layers-list')         as HTMLUListElement
const wiresList        = document.getElementById('wires-list')          as HTMLUListElement
const componentsLabel  = document.getElementById('components-label')    as HTMLElement
const wiresLabel       = document.getElementById('wires-label')         as HTMLElement
const projectNameEl    = document.getElementById('project-name')        as HTMLSpanElement
const projectNameBtn   = document.getElementById('project-name-btn')    as HTMLButtonElement
const projectNameInput = document.getElementById('project-name-input')  as HTMLInputElement
const projectsGrid     = document.getElementById('projects-grid')       as HTMLDivElement
const examplesGrid     = document.getElementById('examples-grid')       as HTMLDivElement
const examplesHeading  = document.getElementById('examples-heading')    as HTMLElement
const newProjectBtn    = document.getElementById('new-project-btn')     as HTMLButtonElement
const importProjectBtn = document.getElementById('import-project-btn')  as HTMLButtonElement
const appLogoEl        = document.getElementById('app-logo')            as HTMLDivElement
const logoMenuBtn      = document.getElementById('logo-menu-btn')       as HTMLButtonElement
const projectMenuBtn   = document.getElementById('project-menu-btn')    as HTMLButtonElement
const sidebarDropdown  = document.getElementById('sidebar-dropdown')    as HTMLDivElement
const sidebarDropdownList = document.getElementById('sidebar-dropdown-list') as HTMLUListElement
const jumperBtn           = document.getElementById('jumper-btn')             as HTMLButtonElement
const jumperPopup         = document.getElementById('jumper-popup')           as HTMLDivElement
const jumperSearch        = document.getElementById('jumper-search')          as HTMLInputElement
const jumperSearchClear   = document.getElementById('jumper-search-clear')    as HTMLButtonElement
const jumperGrid          = document.getElementById('jumper-grid')            as HTMLDivElement
const jumperCreateView    = document.getElementById('jumper-create-view')     as HTMLDivElement
const jumperCreateTitle   = document.getElementById('jumper-create-title')    as HTMLSpanElement
const jumperCreateCancel  = document.getElementById('jumper-create-cancel')   as HTMLButtonElement
const jumperSetNameInput  = document.getElementById('jumper-set-name-input')  as HTMLInputElement
const jumperPitchInput    = document.getElementById('jumper-pitch-input')     as HTMLInputElement
const jumperAddJumperBtn  = document.getElementById('jumper-add-jumper-btn')  as HTMLButtonElement
const jumperColorPickerRow= document.getElementById('jumper-color-picker-row')as HTMLDivElement
const jumperAddedList     = document.getElementById('jumper-added-list')      as HTMLUListElement
const jumperSaveBtn       = document.getElementById('jumper-save-btn')        as HTMLButtonElement
const jumperConfirmView   = document.getElementById('jumper-confirm-view')    as HTMLDivElement
const jumperConfirmNameEl = document.getElementById('jumper-confirm-name')    as HTMLElement
const jumperConfirmCancel = document.getElementById('jumper-confirm-cancel')  as HTMLButtonElement
const jumperConfirmOk     = document.getElementById('jumper-confirm-ok')      as HTMLButtonElement
const insertBtn         = document.getElementById('insert-btn')           as HTMLButtonElement
const insertPopup       = document.getElementById('insert-popup')         as HTMLDivElement
const insertSearchView  = document.getElementById('insert-search-view')   as HTMLDivElement
const insertAddView     = document.getElementById('insert-add-view')      as HTMLDivElement
const insertSearch      = document.getElementById('insert-search')        as HTMLInputElement
const insertSearchClear = document.getElementById('insert-search-clear')  as HTMLButtonElement
const insertGrid        = document.getElementById('insert-grid')          as HTMLDivElement
const insertAddCompBtn  = document.getElementById('insert-add-comp-btn')  as HTMLButtonElement
const insertAddCancel   = document.getElementById('insert-add-cancel')    as HTMLButtonElement
const insertCompForm    = document.getElementById('insert-comp-form')     as HTMLFormElement
const insertCompName    = document.getElementById('insert-comp-name')     as HTMLInputElement
const insertCompRowspan = document.getElementById('insert-comp-rowspan')  as HTMLInputElement
const insertCompPins    = document.getElementById('insert-comp-pins')     as HTMLTextAreaElement
const insertAddTitle    = document.getElementById('insert-add-title')     as HTMLSpanElement
const insertConfirmView = document.getElementById('insert-confirm-view')  as HTMLDivElement
const insertConfirmName = document.getElementById('insert-confirm-name')  as HTMLElement
const insertConfirmCancel = document.getElementById('insert-confirm-cancel') as HTMLButtonElement
const insertConfirmOk   = document.getElementById('insert-confirm-ok')   as HTMLButtonElement

function makeCollapsible(label: HTMLElement, content: HTMLElement): void {
  label.classList.add('collapsible')
  const chevron = document.createElement('span')
  chevron.className = 'collapsible-chevron'
  chevron.innerHTML = CHEVRON_SVG
  label.prepend(chevron)
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
    const factor = Math.exp(-e.deltaY / 100)
    setZoom(zoomLevel * factor, e.clientX, e.clientY)
  }
}, { passive: false })

zoomInBtn.addEventListener('click',  () => setZoom(zoomLevel * 1.25))
zoomOutBtn.addEventListener('click', () => setZoom(zoomLevel / 1.25))
zoomLabel.addEventListener('click',  () => setZoom(1))
zoomFitBtn.addEventListener('click', () => fitToScreen())

// ── Panel resize ────────────────────────────────────────────────────────
const sidebarEl     = document.getElementById('sidebar')               as HTMLElement
const layersPanelEl = document.getElementById('layers-panel')          as HTMLElement
const sidebarHandle = document.getElementById('sidebar-resize-handle') as HTMLDivElement
const layersHandle  = document.getElementById('layers-resize-handle')  as HTMLDivElement

type ResizeDir = 'left' | 'right'
interface ResizeState {
  dir:       ResizeDir
  startX:    number
  startSize: number
  handle:    HTMLDivElement
}
let activeResize: ResizeState | null = null

function startResize(dir: ResizeDir, e: MouseEvent, handle: HTMLDivElement, el: HTMLElement): void {
  activeResize = {
    dir,
    startX:    e.clientX,
    startSize: el.offsetWidth,
    handle,
  }
  handle.classList.add('dragging')
  document.body.style.cursor     = 'ew-resize'
  document.body.style.userSelect = 'none'
}

const UI_STORAGE_KEY = 'breadboard-ui'

function saveUI(): void {
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({
      sidebarWidth: sidebarEl.offsetWidth,
      layersWidth:  layersPanelEl.offsetWidth,
    }))
  } catch { /* ignore */ }
}

function loadUI(): void {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY)
    if (!raw) return
    const { sidebarWidth, layersWidth } = JSON.parse(raw)
    if (sidebarWidth) sidebarEl.style.width      = `${sidebarWidth}px`
    if (layersWidth)  layersPanelEl.style.width   = `${layersWidth}px`
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

// ── Project name (inline rename) + sidebar dropdown ───────────────────────

function syncProjectName(): void {
  if (document.activeElement !== projectNameInput) {
    projectNameEl.textContent = getActiveProjectName()
  }
}

function commitProjectRename(): void {
  const name = projectNameInput.value.trim() || 'Untitled'
  renameProject(name)
  projectNameEl.textContent = name
  projectNameEl.style.display    = ''
  projectNameInput.style.display = 'none'
  projectNameInput.classList.remove('visible')
}

projectNameBtn.addEventListener('click', () => {
  if (projectNameInput.classList.contains('visible')) return
  projectNameInput.value = getActiveProjectName()
  projectNameEl.style.display    = 'none'
  projectNameInput.style.display = ''
  projectNameInput.classList.add('visible')
  projectNameInput.select()
})

projectNameInput.addEventListener('blur',    commitProjectRename)
projectNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter')  { e.preventDefault(); projectNameInput.blur() }
  if (e.key === 'Escape') { projectNameInput.value = getActiveProjectName(); projectNameInput.blur() }
})

// ── Sidebar dropdown ──────────────────────────────────────────────────────

function showSidebarDropdown(
  anchor: HTMLElement,
  items: { label: string; action: () => void }[],
): void {
  sidebarDropdownList.innerHTML = ''
  for (const item of items) {
    const li = document.createElement('li')
    li.textContent = item.label
    li.addEventListener('click', () => { hideSidebarDropdown(); item.action() })
    sidebarDropdownList.appendChild(li)
  }
  const rect = anchor.getBoundingClientRect()
  sidebarDropdown.style.top  = `${rect.bottom + 4}px`
  sidebarDropdown.style.left = `${rect.left}px`
  sidebarDropdown.classList.add('visible')
}

function hideSidebarDropdown(): void {
  sidebarDropdown.classList.remove('visible')
  projectMenuBtn.classList.remove('active')
}

logoMenuBtn.addEventListener('click', () => {
  showSidebarDropdown(logoMenuBtn, [
    { label: 'All Projects', action: () => showProjectsScreen() },
  ])
})

projectMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  if (sidebarDropdown.classList.contains('visible')) {
    hideSidebarDropdown(); return
  }
  projectMenuBtn.classList.add('active')
  showSidebarDropdown(projectMenuBtn, [
    { label: 'Export Project', action: async () => {
      const all = await getAllProjects()
      const current = all.find(p => p.id === getActiveProjectId())
      if (current) exportProject(current)
    }},
  ])
})

document.addEventListener('click', (e) => {
  if (!sidebarDropdown.contains(e.target as Node) &&
      !logoMenuBtn.contains(e.target as Node) &&
      !projectMenuBtn.contains(e.target as Node)) {
    hideSidebarDropdown()
  }
})

// ── Project delete confirmation ───────────────────────────────────────────

const projectConfirmDialog = document.getElementById('project-confirm-dialog') as HTMLDivElement
const projectConfirmMsg    = document.getElementById('project-confirm-msg')    as HTMLParagraphElement
const projectConfirmCancel = document.getElementById('project-confirm-cancel') as HTMLButtonElement
const projectConfirmOk     = document.getElementById('project-confirm-ok')     as HTMLButtonElement

let pendingProjectDelete: { project: Project; card: HTMLDivElement } | null = null

function showProjectConfirm(project: Project, card: HTMLDivElement): void {
  pendingProjectDelete = { project, card }
  projectConfirmMsg.innerHTML = `Delete <strong>${project.name}</strong>? This cannot be undone.`
  projectConfirmDialog.classList.add('visible')
}

function hideProjectConfirm(): void {
  projectConfirmDialog.classList.remove('visible')
  pendingProjectDelete = null
}

projectConfirmCancel.addEventListener('click', hideProjectConfirm)

projectConfirmOk.addEventListener('click', async () => {
  if (!pendingProjectDelete) return
  const { project, card } = pendingProjectDelete
  hideProjectConfirm()
  await deleteProjectById(project.id)
  card.remove()
})

projectConfirmDialog.addEventListener('click', (e) => {
  if (e.target === projectConfirmDialog) hideProjectConfirm()
})

// ── Thumbnail capture ─────────────────────────────────────────────────────

// Collect all CSSStyleRules from the document so the serialized SVG
// renders with the same visual styles as the live canvas.
function collectDocumentStyles(): string {
  const rules: string[] = []
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        // Skip @font-face and @import — they cause CORS errors in blob URLs
        if (rule instanceof CSSStyleRule) rules.push(rule.cssText)
      }
    } catch { /* cross-origin sheet */ }
  }
  return rules.join('\n')
}

async function captureAndSaveThumbnail(): Promise<void> {
  try {
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('width',  String(SVG_WIDTH))
    clone.setAttribute('height', String(SVG_HEIGHT))

    // Embed document CSS so classes like .hole, .wire, .component-body render
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    styleEl.textContent = collectDocumentStyles()
    clone.insertBefore(styleEl, clone.firstChild)

    // Hide hover-label overlays in the thumbnail
    const hoverGroup = clone.getElementById('hover-labels')
    if (hoverGroup) hoverGroup.setAttribute('visibility', 'hidden')

    const svgStr = new XMLSerializer().serializeToString(clone)
    const blob   = new Blob([svgStr], { type: 'image/svg+xml' })
    const url    = URL.createObjectURL(blob)

    await new Promise<void>((resolve) => {
      const img     = new Image()
      const THUMB_W = 480
      const THUMB_H = Math.round(SVG_HEIGHT * (THUMB_W / SVG_WIDTH))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width  = THUMB_W
        canvas.height = THUMB_H
        const ctx = canvas.getContext('2d')!
        // Fill with the board background before drawing so semi-transparent
        // SVG fills (board trench, rail overlays) composite correctly.
        ctx.fillStyle = '#faf8f4'
        ctx.fillRect(0, 0, THUMB_W, THUMB_H)
        ctx.drawImage(img, 0, 0, THUMB_W, THUMB_H)
        URL.revokeObjectURL(url)
        updateThumbnail(canvas.toDataURL('image/jpeg', 0.8))
        resolve()
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve() }
      img.src = url
    })
  } catch { /* ignore — thumbnail is optional */ }
}

let thumbnailTimer: ReturnType<typeof setTimeout> | null = null
function scheduleThumbnail(): void {
  if (thumbnailTimer) clearTimeout(thumbnailTimer)
  thumbnailTimer = setTimeout(() => {
    thumbnailTimer = null
    captureAndSaveThumbnail()
  }, 5000)
}

// ── Import / export ───────────────────────────────────────────────────────

function exportProject(project: Project): void {
  const data: BBFile = {
    version:           1,
    name:              project.name,
    createdAt:         project.createdAt,
    placedComponents:  project.placedComponents,
    wires:             project.wires,
    activeJumperSetId: project.activeJumperSetId ?? null,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${project.name.replace(/[^a-z0-9_-]/gi, '_') || 'project'}.bb`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function importProject(): Promise<void> {
  const input    = document.createElement('input')
  input.type     = 'file'
  input.accept   = '.bb'
  await new Promise<void>(resolve => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (!file) { resolve(); return }
      if (!file.name.endsWith('.bb')) {
        alert('Please select a .bb file.')
        resolve(); return
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('File is too large (max 5 MB).')
        resolve(); return
      }
      let data: unknown
      try { data = JSON.parse(await file.text()) } catch {
        alert('File is not valid JSON.')
        resolve(); return
      }
      if (
        typeof data !== 'object' || data === null ||
        (data as Record<string, unknown>).version !== 1 ||
        !Array.isArray((data as Record<string, unknown>).placedComponents) ||
        !Array.isArray((data as Record<string, unknown>).wires)
      ) {
        alert('File is not a valid Breadboard project.')
        resolve(); return
      }
      const id = await importProjectData(data as BBFile)
      await openProject(id)
      showCanvasScreen()
      resolve()
    })
    input.click()
  })
}

// ── Projects screen ───────────────────────────────────────────────────────

function formatRelativeDate(ts: number): string {
  const diff  = Date.now() - ts
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  <  1) return 'Just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  === 1) return 'Yesterday'
  if (days  <  7) return `${days} days ago`
  return new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric',
    year:  days > 365 ? 'numeric' : undefined,
  }).format(new Date(ts))
}

const CHEVRON_SVG   = `<i class="ph ph-caret-down"           style="pointer-events:none;font-size:10px"></i>`
const THREE_DOT_SVG = `<i class="ph ph-dots-three-vertical"  style="pointer-events:none;font-size:15px"></i>`
const PENCIL_SVG    = `<i class="ph ph-pencil-simple"        style="pointer-events:none;font-size:13px"></i>`
const TRASH_SVG     = `<i class="ph ph-x"                    style="pointer-events:none;font-size:13px"></i>`

async function renderProjectsScreen(): Promise<void> {
  const projects = (await getAllProjects()).sort((a, b) => b.updatedAt - a.updatedAt)
  projectsGrid.innerHTML = ''

  // "New project" card
  const newCard = document.createElement('div')
  newCard.className = 'project-card project-card-new'
  newCard.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
    <span>New project</span>`
  newCard.addEventListener('click', async () => {
    const id = await createProject()
    await openProject(id)
    showCanvasScreen()
  })
  projectsGrid.appendChild(newCard)

  for (const project of projects) {
    projectsGrid.appendChild(buildProjectCard(project))
  }

  // Examples
  examplesGrid.innerHTML = ''
  examplesHeading.style.display = EXAMPLE_PROJECTS.length ? '' : 'none'
  for (const example of EXAMPLE_PROJECTS) {
    const card = document.createElement('div')
    card.className = 'project-card example-card'

    const thumb = document.createElement('div')
    thumb.className = 'project-card-thumb'
    const ph = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    ph.setAttribute('width', '48'); ph.setAttribute('height', '48')
    ph.setAttribute('viewBox', '0 0 18 18'); ph.setAttribute('fill', 'none')
    ph.classList.add('project-card-thumb-placeholder')
    ph.innerHTML = `<rect x="1" y="5" width="16" height="8" rx="1.5" fill="currentColor" opacity="0.3"/>
      <circle cx="4" cy="9" r="1.4" fill="currentColor"/><circle cx="7" cy="9" r="1.4" fill="currentColor"/>
      <circle cx="10" cy="9" r="1.4" fill="currentColor"/><circle cx="13" cy="9" r="1.4" fill="currentColor"/>`
    thumb.appendChild(ph)
    card.appendChild(thumb)

    const info = document.createElement('div')
    info.className = 'project-card-info'

    const infoText = document.createElement('div')
    infoText.className = 'project-card-info-text'

    const nameEl = document.createElement('div')
    nameEl.className   = 'project-card-name'
    nameEl.textContent = example.name

    const desc = document.createElement('div')
    desc.className   = 'project-card-date'
    desc.textContent = example.description

    infoText.append(nameEl, desc)
    info.append(infoText)
    card.appendChild(info)

    card.addEventListener('click', async () => {
      const id = await createProjectFromExample(example)
      await openProject(id)
      showCanvasScreen()
      showSnackbar(`Created a new project using "${example.name}" template.`)
    })

    examplesGrid.appendChild(card)
  }
}

function buildProjectCard(project: Project): HTMLDivElement {
  const card = document.createElement('div')
  card.className = 'project-card'

  // Thumbnail
  const thumb = document.createElement('div')
  thumb.className = 'project-card-thumb'
  if (project.thumbnail) {
    const img = document.createElement('img')
    img.src = project.thumbnail
    img.alt = project.name
    thumb.appendChild(img)
  } else {
    const ph = document.createElement('svg')
    ph.setAttribute('width', '48')
    ph.setAttribute('height', '48')
    ph.setAttribute('viewBox', '0 0 18 18')
    ph.setAttribute('fill', 'none')
    ph.classList.add('project-card-thumb-placeholder')
    ph.innerHTML = `<rect x="1" y="5" width="16" height="8" rx="1.5" fill="currentColor" opacity="0.3"/>
      <circle cx="4" cy="9" r="1.4" fill="currentColor"/><circle cx="7" cy="9" r="1.4" fill="currentColor"/>
      <circle cx="10" cy="9" r="1.4" fill="currentColor"/><circle cx="13" cy="9" r="1.4" fill="currentColor"/>`
    thumb.appendChild(ph)
  }
  card.appendChild(thumb)

  // Info
  const info = document.createElement('div')
  info.className = 'project-card-info'

  const nameEl = document.createElement('div')
  nameEl.className   = 'project-card-name'
  nameEl.textContent = project.name

  const nameInput = document.createElement('input')
  nameInput.type        = 'text'
  nameInput.className   = 'project-card-name-input'
  nameInput.spellcheck  = false
  nameInput.autocomplete = 'off'

  const dateEl = document.createElement('div')
  dateEl.className   = 'project-card-date'
  dateEl.textContent = formatRelativeDate(project.updatedAt)

  // Three-dot menu button
  const menuBtn = document.createElement('button')
  menuBtn.className = 'project-card-menu-btn'
  menuBtn.title     = 'More options'
  menuBtn.innerHTML = THREE_DOT_SVG

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (sidebarDropdown.classList.contains('visible') && sidebarDropdown.dataset.anchor === project.id) {
      hideSidebarDropdown()
      return
    }
    sidebarDropdown.dataset.anchor = project.id
    showSidebarDropdown(menuBtn, [
      { label: 'Rename', action: () => {
        nameEl.style.display = 'none'
        nameInput.value      = project.name
        nameInput.classList.add('visible')
        nameInput.focus()
        nameInput.select()
      }},
      { label: 'Export', action: () => exportProject(project) },
      { label: 'Delete', action: () => showProjectConfirm(project, card) },
    ])
  })

  const infoText = document.createElement('div')
  infoText.className = 'project-card-info-text'
  infoText.appendChild(nameEl)
  infoText.appendChild(nameInput)
  infoText.appendChild(dateEl)

  info.appendChild(infoText)
  info.appendChild(menuBtn)
  card.appendChild(info)

  // Inline rename handlers
  const commitCardRename = async () => {
    const newName = nameInput.value.trim() || 'Untitled'
    project.name          = newName
    nameEl.textContent    = newName
    nameEl.style.display  = ''
    nameInput.classList.remove('visible')
    await renameProjectById(project.id, newName)
    if (project.id === getActiveProjectId()) projectNameEl.textContent = newName
  }

  nameInput.addEventListener('blur',    commitCardRename)
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); nameInput.blur() }
    if (e.key === 'Escape') { nameInput.value = project.name; nameInput.blur() }
  })

  // Click card body to open
  card.addEventListener('click', async () => {
    if (nameInput.classList.contains('visible')) return
    await openProject(project.id)
    showCanvasScreen()
  })

  return card
}

// ── Routing ───────────────────────────────────────────────────────────────

function navigate(path: string, replace = false): void {
  const url = new URL(location.href)
  url.hash  = path
  if (replace) history.replaceState(null, '', url)
  else         history.pushState(null, '', url)
}

async function handleRoute(): Promise<void> {
  const hash = location.hash.replace(/^#/, '') || '/'

  if (hash === '/' || hash === '') {
    document.body.classList.add('projects-mode')
    await renderProjectsScreen()
    return
  }

  const m = hash.match(/^\/project\/(.+)$/)
  if (m) {
    const id       = m[1]
    const projects = await getAllProjects()
    if (projects.some(p => p.id === id)) {
      if (id !== getActiveProjectId()) await openProject(id)
      document.body.classList.remove('projects-mode')
      syncProjectName()
      update()
    } else {
      navigate('/', true)
      document.body.classList.add('projects-mode')
      await renderProjectsScreen()
    }
    return
  }

  // Unknown hash — fall back to current project
  navigate(`/project/${getActiveProjectId()}`, true)
  document.body.classList.remove('projects-mode')
  syncProjectName()
  update()
}

async function showProjectsScreen(): Promise<void> {
  await captureAndSaveThumbnail()
  navigate('/')
  document.body.classList.add('projects-mode')
  await renderProjectsScreen()
}

function showCanvasScreen(): void {
  navigate(`/project/${getActiveProjectId()}`)
  document.body.classList.remove('projects-mode')
  syncProjectName()
  update()
}

let snackbarTimer: ReturnType<typeof setTimeout> | null = null
const snackbarEl = document.getElementById('snackbar') as HTMLDivElement

function showSnackbar(message: string, durationMs = 3500): void {
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbarEl.textContent = message
  snackbarEl.classList.add('visible')
  snackbarTimer = setTimeout(() => {
    snackbarEl.classList.remove('visible')
    snackbarTimer = null
  }, durationMs)
}

appLogoEl.addEventListener('click', () => {
  if (document.body.classList.contains('projects-mode')) {
    showCanvasScreen()
  } else {
    showProjectsScreen()
  }
})

newProjectBtn.addEventListener('click', async () => {
  const id = await createProject()
  await openProject(id)
  showCanvasScreen()
})

importProjectBtn.addEventListener('click', () => { importProject() })

sidebarHandle.addEventListener('mousedown', (e) => startResize('left',  e, sidebarHandle, sidebarEl))
layersHandle.addEventListener('mousedown',  (e) => startResize('right', e, layersHandle,  layersPanelEl))

document.addEventListener('mousemove', (e) => {
  if (!activeResize) return
  const delta = e.clientX - activeResize.startX
  const raw   = activeResize.dir === 'left'
    ? activeResize.startSize + delta
    : activeResize.startSize - delta
  const el    = activeResize.dir === 'left' ? sidebarEl : layersPanelEl
  el.style.width = `${Math.max(160, Math.min(480, raw))}px`
})

document.addEventListener('mouseup', () => {
  if (!activeResize) return
  activeResize.handle.classList.remove('dragging')
  document.body.style.cursor     = ''
  document.body.style.userSelect = ''
  activeResize = null
  saveUI()
})

// ── Jumper popup ──────────────────────────────────────────────────────────────

function buildJumperSetItem(set: StoredJumperSet): HTMLElement {
  const isUser = set.source === 'user'

  const row = document.createElement('div')
  row.className = ['jumper-set-item', set.id === state.activeJumperSetId ? 'active' : ''].filter(Boolean).join(' ')

  const check = document.createElement('span')
  check.className = 'jumper-set-check'
  if (set.id === state.activeJumperSetId) check.innerHTML = `<i class="ph ph-check" style="font-size:12px"></i>`

  const name = document.createElement('span')
  name.className   = 'jumper-set-name'
  name.textContent = set.name

  const swatches = document.createElement('span')
  swatches.className = 'jumper-set-swatches'
  set.jumpers.slice(0, 6).forEach(j => {
    const dot = document.createElement('span')
    dot.className        = 'jumper-set-swatch'
    dot.style.background = j.color
    swatches.appendChild(dot)
  })

  const count = document.createElement('span')
  count.className   = 'jumper-set-count'
  count.textContent = `${set.jumpers.length}`

  const actions = document.createElement('div')
  actions.className = 'jumper-set-actions'

  if (isUser) {
    const editBtn = document.createElement('button')
    editBtn.type      = 'button'
    editBtn.className = 'jumper-set-action-btn'
    editBtn.title     = 'Edit'
    editBtn.innerHTML = `<i class="ph ph-pencil-simple" style="pointer-events:none;font-size:13px"></i>`
    editBtn.addEventListener('click', e => { e.stopPropagation(); showJumperCreateView(set) })
    actions.appendChild(editBtn)
  }

  const dupBtn = document.createElement('button')
  dupBtn.type      = 'button'
  dupBtn.className = 'jumper-set-action-btn'
  dupBtn.title     = 'Duplicate'
  dupBtn.innerHTML = `<i class="ph ph-copy" style="pointer-events:none;font-size:13px"></i>`
  dupBtn.addEventListener('click', e => {
    e.stopPropagation()
    e.preventDefault()
    createJumperSet(`Copy of ${set.name}`, [...set.jumpers])
    renderJumperGrid()
  })
  actions.appendChild(dupBtn)

  if (isUser) {
    const delBtn = document.createElement('button')
    delBtn.type      = 'button'
    delBtn.className = 'jumper-set-action-btn jumper-set-action-delete'
    delBtn.title     = 'Delete'
    delBtn.innerHTML = `<i class="ph ph-x" style="pointer-events:none;font-size:13px"></i>`
    delBtn.addEventListener('click', e => { e.stopPropagation(); showJumperConfirmView(set.id, set.name) })
    actions.appendChild(delBtn)
  }

  row.append(check, name, swatches, count, actions)
  row.addEventListener('click', (e) => { e.stopPropagation(); setActiveJumperSet(set.id); renderJumperGrid() })
  return row
}

function renderJumperGrid(): void {
  jumperGrid.innerHTML = ''
  const q = jumperSearch.value.trim().toLowerCase()
  const sets = state.jumperSets as StoredJumperSet[]
  const matches = q ? sets.filter(s => s.name.toLowerCase().includes(q)) : sets

  const standard = matches.filter(s => s.source !== 'user')
  const user     = matches.filter(s => s.source === 'user')

  const sections: { label: string; items: StoredJumperSet[] }[] = []
  if (standard.length) sections.push({ label: 'Standard Library', items: standard })
  if (user.length)     sections.push({ label: 'User Library', items: user })

  if (!matches.length) {
    const empty = document.createElement('div')
    empty.className   = 'insert-section-header'
    empty.textContent = 'No results'
    jumperGrid.appendChild(empty)
    return
  }

  for (const { label, items } of sections) {
    jumperGrid.appendChild(makeInsertSectionHeader(label))
    for (const set of items) jumperGrid.appendChild(buildJumperSetItem(set))
  }
}

function showJumperPopup(): void {
  hideInsertPopup()
  jumperPopup.classList.add('visible')
  jumperBtn.classList.add('active')
  jumperSearch.value = ''
  jumperSearchClear.classList.remove('visible')
  jumperCreateView.style.display  = 'none'
  jumperConfirmView.style.display = 'none'
  document.getElementById('jumper-search-view')!.style.display = ''
  renderJumperGrid()
  requestAnimationFrame(() => jumperSearch.focus())
}

function hideJumperPopup(): void {
  jumperPopup.classList.remove('visible')
  jumperBtn.classList.remove('active')
}

jumperBtn.addEventListener('click', () => {
  if (jumperPopup.classList.contains('visible')) hideJumperPopup()
  else showJumperPopup()
})

jumperSearch.addEventListener('input', () => {
  jumperSearchClear.classList.toggle('visible', jumperSearch.value.length > 0)
  renderJumperGrid()
})

jumperSearchClear.addEventListener('click', () => {
  jumperSearch.value = ''
  jumperSearchClear.classList.remove('visible')
  renderJumperGrid()
  jumperSearch.focus()
})

// ── Jumper set create view ────────────────────────────────────────────────────

const JUMPER_PRESET_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63',
  '#ffffff', '#2c3e50',
]

let newJumpers:          import('./types').JumperDef[] = []
let selectedJumperColor: string = JUMPER_PRESET_COLORS[0]

function buildJumperColorPicker(): void {
  jumperColorPickerRow.innerHTML = ''

  JUMPER_PRESET_COLORS.forEach(color => {
    const btn = document.createElement('button')
    btn.className        = 'jumper-color-swatch'
    btn.style.background = color
    btn.title            = color
    btn.type             = 'button'
    if (color === selectedJumperColor) btn.classList.add('selected')
    btn.addEventListener('click', () => {
      selectedJumperColor = color
      jumperColorPickerRow.querySelectorAll('.jumper-color-swatch, .jumper-custom-color-wrap').forEach(el => el.classList.remove('selected'))
      btn.classList.add('selected')
    })
    jumperColorPickerRow.appendChild(btn)
  })

  // Custom color picker
  const wrap = document.createElement('label')
  wrap.className        = 'jumper-custom-color-wrap'
  wrap.title            = 'Custom color'
  wrap.style.background = '#888'

  const input = document.createElement('input')
  input.type  = 'color'
  input.value = '#888888'
  input.addEventListener('input', () => {
    selectedJumperColor   = input.value
    wrap.style.background = input.value
    jumperColorPickerRow.querySelectorAll('.jumper-color-swatch, .jumper-custom-color-wrap').forEach(el => el.classList.remove('selected'))
    wrap.classList.add('selected')
  })

  wrap.appendChild(input)
  jumperColorPickerRow.appendChild(wrap)
}

function renderJumperAddedList(): void {
  jumperAddedList.innerHTML = ''
  for (const j of newJumpers) {
    const li = document.createElement('li')
    li.className = 'jumper-added-item'

    const dot = document.createElement('span')
    dot.className        = 'jumper-added-dot'
    dot.style.background = j.color

    const label = document.createElement('span')
    label.className   = 'jumper-added-label'
    label.textContent = `${j.pitch}p`

    const remove = document.createElement('button')
    remove.className = 'jumper-added-remove'
    remove.title     = 'Remove'
    remove.innerHTML = `<i class="ph ph-x" style="pointer-events:none"></i>`
    remove.addEventListener('click', (e) => {
      e.stopPropagation()
      newJumpers = newJumpers.filter(x => x !== j)
      renderJumperAddedList()
      updateJumperSaveBtn()
    })

    li.append(dot, label, remove)
    jumperAddedList.appendChild(li)
  }
}

function updateJumperAddBtn(): void {
  const pitch = parseInt(jumperPitchInput.value, 10)
  const pitchOk = !isNaN(pitch) && pitch >= 1
  const duplicate = newJumpers.some(j => j.pitch === pitch)
  jumperAddJumperBtn.disabled = !pitchOk || duplicate
}

function updateJumperSaveBtn(): void {
  jumperSaveBtn.disabled = !jumperSetNameInput.value.trim() || newJumpers.length === 0
}

let editingJumperSetId:   string | null = null
let pendingJumperDeleteId: string | null = null

function showJumperSearchView(): void {
  jumperCreateView.style.display  = 'none'
  jumperConfirmView.style.display = 'none'
  document.getElementById('jumper-search-view')!.style.display = ''
  editingJumperSetId = null
  requestAnimationFrame(() => jumperSearch.focus())
}

function showJumperCreateView(editSet?: StoredJumperSet): void {
  document.getElementById('jumper-search-view')!.style.display = 'none'
  jumperConfirmView.style.display = 'none'
  jumperCreateView.style.display  = ''
  editingJumperSetId = editSet?.id ?? null
  jumperCreateTitle.textContent = editSet ? 'Edit Jumper Set' : 'Create Jumper Set'
  jumperSaveBtn.textContent     = editSet ? 'Save changes'    : 'Save jumper set'
  newJumpers = editSet ? [...editSet.jumpers] : []
  selectedJumperColor = JUMPER_PRESET_COLORS[0]
  jumperSetNameInput.value = editSet?.name ?? ''
  jumperPitchInput.value   = ''
  jumperAddJumperBtn.disabled = true
  updateJumperSaveBtn()
  buildJumperColorPicker()
  renderJumperAddedList()
  requestAnimationFrame(() => jumperSetNameInput.focus())
}

function showJumperConfirmView(id: string, name: string): void {
  document.getElementById('jumper-search-view')!.style.display = 'none'
  jumperCreateView.style.display  = 'none'
  jumperConfirmView.style.display = ''
  pendingJumperDeleteId = id
  jumperConfirmNameEl.textContent = name
}

document.getElementById('jumper-create-btn')!.addEventListener('click', () => showJumperCreateView())
jumperCreateCancel.addEventListener('click', showJumperSearchView)

jumperConfirmCancel.addEventListener('click', () => { pendingJumperDeleteId = null; showJumperSearchView() })
jumperConfirmOk.addEventListener('click', () => {
  if (pendingJumperDeleteId) { deleteJumperSetById(pendingJumperDeleteId); pendingJumperDeleteId = null }
  showJumperSearchView()
  renderJumperGrid()
})

jumperSetNameInput.addEventListener('input', updateJumperSaveBtn)
jumperPitchInput.addEventListener('input', updateJumperAddBtn)

jumperAddJumperBtn.addEventListener('click', () => {
  const pitch = parseInt(jumperPitchInput.value, 10)
  if (isNaN(pitch) || pitch < 1) return
  newJumpers = [...newJumpers, { color: selectedJumperColor, pitch }]
  newJumpers.sort((a, b) => a.pitch - b.pitch)
  jumperPitchInput.value = ''
  updateJumperAddBtn()
  updateJumperSaveBtn()
  renderJumperAddedList()
  jumperPitchInput.focus()
})

jumperSaveBtn.addEventListener('click', () => {
  const name = jumperSetNameInput.value.trim()
  if (!name || newJumpers.length === 0) return
  if (editingJumperSetId) {
    updateJumperSet(editingJumperSetId, name, newJumpers)
    editingJumperSetId = null
  } else {
    createJumperSet(name, newJumpers)
  }
  showJumperSearchView()
  renderJumperGrid()
})

// ── Insert popup ─────────────────────────────────────────────────────────────

function getRecentDefIds(): string[] {
  const seen = new Set<string>()
  const recent: string[] = []
  for (let i = state.placedComponents.length - 1; i >= 0; i--) {
    const { defId } = state.placedComponents[i]
    if (!seen.has(defId) && state.componentLibrary.some(d => d.id === defId)) {
      seen.add(defId)
      recent.unshift(defId)
      if (recent.length >= 12) break
    }
  }
  return recent
}

function buildInsertGridItem(def: ComponentDef): HTMLElement {
  if (def.source === 'user') {
    const container = document.createElement('div')
    container.className = 'insert-item insert-user-item'

    const nameEl = document.createElement('span')
    nameEl.className   = 'insert-item-name'
    nameEl.textContent = def.name

    const actions = document.createElement('div')
    actions.className = 'insert-item-actions'

    const editBtn = document.createElement('button')
    editBtn.type      = 'button'
    editBtn.className = 'insert-item-action'
    editBtn.title     = 'Edit'
    editBtn.innerHTML = PENCIL_SVG
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      showInsertAddForm(def)
    })

    const deleteBtn = document.createElement('button')
    deleteBtn.type      = 'button'
    deleteBtn.className = 'insert-item-action insert-item-delete'
    deleteBtn.title     = 'Delete'
    deleteBtn.innerHTML = TRASH_SVG
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      showInsertConfirmView(def.id, def.name)
    })

    actions.append(editBtn, deleteBtn)
    container.append(nameEl, actions)
    container.addEventListener('click', () => {
      hideInsertPopup()
      startPlacement(def.id)
    })
    return container
  }

  const btn = document.createElement('button')
  btn.className = 'insert-item'
  btn.type      = 'button'

  const name = document.createElement('span')
  name.className   = 'insert-item-name'
  name.textContent = def.name

  btn.appendChild(name)
  btn.addEventListener('click', () => {
    hideInsertPopup()
    startPlacement(def.id)
  })
  return btn
}

function makeInsertSectionHeader(text: string): HTMLDivElement {
  const hdr = document.createElement('div')
  hdr.className   = 'insert-section-header'
  hdr.textContent = text
  return hdr
}

function renderInsertGrid(): void {
  insertGrid.innerHTML = ''
  const q = insertSearch.value.trim().toLowerCase()

  if (!q) {
    const recentIds = getRecentDefIds()
    if (recentIds.length) {
      insertGrid.appendChild(makeInsertSectionHeader('Recents'))
      for (const id of recentIds) {
        const def = state.componentLibrary.find(d => d.id === id)
        if (def) insertGrid.appendChild(buildInsertGridItem(def))
      }
    }
    return
  }

  const matches  = state.componentLibrary.filter(d => d.name.toLowerCase().includes(q))
  const standard = matches.filter(d => d.source !== 'user')
  const user     = matches.filter(d => d.source === 'user')

  if (standard.length) {
    insertGrid.appendChild(makeInsertSectionHeader('Standard Library'))
    for (const def of standard) insertGrid.appendChild(buildInsertGridItem(def))
  }
  if (user.length) {
    insertGrid.appendChild(makeInsertSectionHeader('User Library'))
    for (const def of user) insertGrid.appendChild(buildInsertGridItem(def))
  }
  if (!matches.length) {
    const empty = document.createElement('div')
    empty.className   = 'insert-section-header'
    empty.textContent = 'No results'
    insertGrid.appendChild(empty)
  }
}

function showInsertPopup(): void {
  hideJumperPopup()
  insertPopup.classList.add('visible')
  insertBtn.classList.add('active')
  insertSearch.value = ''
  insertSearchClear.classList.remove('visible')
  renderInsertGrid()
  requestAnimationFrame(() => insertSearch.focus())
}

function hideInsertPopup(): void {
  insertPopup.classList.remove('visible')
  insertBtn.classList.remove('active')
  showInsertSearchView()
}

insertBtn.addEventListener('click', () => {
  if (insertPopup.classList.contains('visible')) hideInsertPopup()
  else showInsertPopup()
})

insertSearch.addEventListener('input', () => {
  insertSearchClear.classList.toggle('visible', insertSearch.value.length > 0)
  renderInsertGrid()
})

insertSearchClear.addEventListener('click', () => {
  insertSearch.value = ''
  insertSearchClear.classList.remove('visible')
  renderInsertGrid()
  insertSearch.focus()
})

const insertCompSubmitBtn = insertCompForm.querySelector('button[type="submit"]') as HTMLButtonElement

let editingCompId:   string | null = null
let pendingDeleteId: string | null = null

function updateInsertSubmitBtn(): void {
  insertCompSubmitBtn.disabled = !insertCompName.value.trim() || !insertCompRowspan.value.trim()
}

insertCompName.addEventListener('input',    updateInsertSubmitBtn)
insertCompRowspan.addEventListener('input', updateInsertSubmitBtn)

function showInsertAddForm(def?: ComponentDef): void {
  insertSearchView.style.display  = 'none'
  insertConfirmView.style.display = 'none'
  insertAddView.style.display     = ''

  editingCompId = def?.id ?? null

  if (def) {
    insertCompName.value    = def.name
    insertCompRowspan.value = String(def.rowSpan)
    const topPins    = def.pins.filter(p => p.row === 'top').sort((a, b) => a.col - b.col).map(p => p.name)
    const bottomPins = def.pins.filter(p => p.row === 'bottom').sort((a, b) => a.col - b.col).map(p => p.name)
    insertCompPins.value = [topPins.join(' '), bottomPins.join(' ')].filter(l => l.length > 0).join('\n')
    insertAddTitle.textContent       = 'Edit Component'
    insertCompSubmitBtn.textContent  = 'Update Component'
  } else {
    insertCompName.value    = ''
    insertCompRowspan.value = ''
    insertCompPins.value    = ''
    insertAddTitle.textContent       = 'Add Component'
    insertCompSubmitBtn.textContent  = 'Add to library'
  }

  updateInsertSubmitBtn()
  requestAnimationFrame(() => insertCompName.focus())
}

function showInsertSearchView(): void {
  insertAddView.style.display     = 'none'
  insertConfirmView.style.display = 'none'
  insertSearchView.style.display  = ''
  editingCompId = null
  renderInsertGrid()
  requestAnimationFrame(() => insertSearch.focus())
}

function showInsertConfirmView(id: string, name: string): void {
  insertSearchView.style.display  = 'none'
  insertAddView.style.display     = 'none'
  insertConfirmView.style.display = ''
  pendingDeleteId = id
  insertConfirmName.textContent = name
}

insertConfirmCancel.addEventListener('click', () => {
  pendingDeleteId = null
  showInsertSearchView()
})

insertConfirmOk.addEventListener('click', () => {
  if (pendingDeleteId) {
    removeComponentDef(pendingDeleteId)
    pendingDeleteId = null
  }
  showInsertSearchView()
})

insertAddCompBtn.addEventListener('click', () => showInsertAddForm())
insertAddCancel.addEventListener('click',  showInsertSearchView)

insertCompForm.addEventListener('submit', (e) => {
  e.preventDefault()
  const name    = insertCompName.value.trim()
  const rowSpan = parseInt(insertCompRowspan.value, 10)
  if (!name || isNaN(rowSpan) || rowSpan < 1) return

  const lines = insertCompPins.value
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

  if (editingCompId) {
    updateComponentDef(editingCompId, { name, colSpan, rowSpan, pins, source: 'user' })
    editingCompId = null
  } else {
    addComponentDef({ name, colSpan, rowSpan, pins })
  }
  showInsertSearchView()
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
  colorPicker.style.left  = `${rect.right + 6}px`
  colorPicker.style.right = ''
  colorPicker.classList.add('visible')
}

function hideColorPicker(): void {
  colorPickerTarget = null
  colorPicker.classList.remove('visible')
}

const bomLabel          = document.getElementById('bom-label')          as HTMLElement
const bomInner          = document.getElementById('bom-inner')          as HTMLDivElement
const connectionsLabel   = document.getElementById('connections-label')   as HTMLElement
const connectionsDivider = document.getElementById('connections-divider') as HTMLElement
const componentsDivider  = document.getElementById('components-divider')  as HTMLElement
const wiresDivider       = document.getElementById('wires-divider')       as HTMLElement

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

  const counts = new Map<string, { name: string; color: string; count: number; len: number; wireIds: string[] }>()
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
    if (!counts.has(key)) counts.set(key, { name, color, count: 0, len, wireIds: [] })
    const entry = counts.get(key)!
    entry.count++
    entry.wireIds.push(wire.id)
  }

  bomInner.innerHTML = ''
  const ul = document.createElement('ul')
  ul.className = 'bom-list'
  for (const item of [...counts.values()].sort((a, b) => a.len - b.len)) {
    const li = document.createElement('li')
    li.className         = 'bom-item'
    li.dataset.wireIds   = item.wireIds.join(' ')

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

let bomHoverIds: string[] = []

function setBomHover(wireIds: string[]): void {
  for (const id of bomHoverIds)
    svg.querySelector(`[data-wire-id="${id}"]`)?.classList.remove('panel-hover')
  bomHoverIds = []
  for (const id of wireIds) {
    const el = svg.querySelector(`[data-wire-id="${id}"]`)
    if (el) { el.classList.add('panel-hover'); bomHoverIds.push(id) }
  }
  svg.classList.toggle('has-highlight', bomHoverIds.length > 0)
}

bomInner.addEventListener('mouseover', (e) => {
  const item = (e.target as HTMLElement).closest('.bom-item') as HTMLElement | null
  setBomHover(item?.dataset.wireIds?.split(' ').filter(Boolean) ?? [])
})
bomInner.addEventListener('mouseleave', () => setBomHover([]))

let lastNets: Net[] = []

// Highlight all wires in a net when hovering a connections table row
let tableHoverIds: string[] = []

function setTableHover(netRoot: string | null): void {
  for (const id of tableHoverIds)
    svg.querySelector(`[data-wire-id="${id}"]`)?.classList.remove('panel-hover')
  tableHoverIds = []
  if (netRoot) {
    const net = lastNets.find(n => n.root === netRoot)
    if (net) {
      for (const id of net.wireIds) {
        const el = svg.querySelector(`[data-wire-id="${id}"]`)
        if (el) { el.classList.add('panel-hover'); tableHoverIds.push(id) }
      }
    }
  }
  svg.classList.toggle('has-highlight', tableHoverIds.length > 0)
}

tableInner.addEventListener('mouseover', (e) => {
  const row = (e.target as HTMLElement).closest('.conn-item') as HTMLElement | null
  setTableHover(row?.dataset.netRoot ?? null)
})
tableInner.addEventListener('mouseleave', () => setTableHover(null))

function update(): void {
  render(svg, state)
  componentsLabel.querySelector('.label-text')!.textContent = `Components (${state.placedComponents.length})`
  wiresLabel.querySelector('.label-text')!.textContent      = `Jumpers (${state.wires.length})`
  lastNets = renderTable(tableInner, state)
  const hasConnections = lastNets.length > 0
  connectionsDivider.style.display = hasConnections ? '' : 'none'
  connectionsLabel.style.display   = hasConnections ? '' : 'none'
  tableInner.style.display         = hasConnections ? '' : 'none'

  const hasComponents = state.placedComponents.length > 0
  const hasWires      = state.wires.length > 0
  componentsDivider.style.display = hasComponents ? '' : 'none'
  componentsLabel.style.display   = hasComponents ? '' : 'none'
  layersList.style.display        = hasComponents ? '' : 'none'
  wiresDivider.style.display    = hasWires ? '' : 'none'
  wiresLabel.style.display      = hasWires ? '' : 'none'
  wiresList.style.display       = hasWires ? '' : 'none'

  renderLayersPanel(layersList, state.placedComponents, state.componentLibrary, state.selectedId)
  renderWiresList(wiresList, state)
  renderBoM()
}

function fitToScreen(): void {
  const area    = canvasScrollArea.getBoundingClientRect()
  const padding = 48
  const scaleX  = (area.width  - padding) / SVG_WIDTH
  const scaleY  = (area.height - padding) / SVG_HEIGHT
  setZoom(Math.min(scaleX, scaleY))
}

initDB().then(async () => {
  onStateChange(() => { update(); syncProjectName(); scheduleThumbnail() })

  // Set a default URL if the page was opened with no hash
  if (!location.hash || location.hash === '#') {
    navigate(`/project/${getActiveProjectId()}`, true)
  }

  await handleRoute()

  if (!document.body.classList.contains('projects-mode')) {
    requestAnimationFrame(() => fitToScreen())
  }
})

window.addEventListener('popstate', () => handleRoute())

makeCollapsible(componentsLabel,  layersList)
makeCollapsible(wiresLabel,       wiresList)
makeCollapsible(connectionsLabel, tableInner)
makeCollapsible(bomLabel,         bomInner)

// Close popups when clicking outside
document.addEventListener('click', (e) => {
  if (
    insertPopup.classList.contains('visible') &&
    !insertPopup.contains(e.target as Node) &&
    !insertBtn.contains(e.target as Node)
  ) hideInsertPopup()

  if (
    jumperPopup.classList.contains('visible') &&
    !jumperPopup.contains(e.target as Node) &&
    !jumperBtn.contains(e.target as Node)
  ) hideJumperPopup()
})

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
  if (!ctxMenu.contains(e.target as Node))     hideContextMenu()
  if (!colorPicker.contains(e.target as Node)) hideColorPicker()
})

// Close insert popup on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideInsertPopup()
})

// --- Layers panel ---

let lastLayerClickId   = ''
let lastLayerClickTime = 0

function startLayerItemRename(compId: string): void {
  const placed = state.placedComponents.find(c => c.id === compId)
  if (!placed) return
  const def = state.componentLibrary.find(d => d.id === placed.defId)
  if (!def) return
  // Re-query the li after any re-render caused by the first click
  const li = layersList.querySelector(`[data-comp-id="${compId}"]`) as HTMLElement | null
  if (!li) return
  const nameEl = li.querySelector('.layer-name') as HTMLElement
  if (!nameEl || nameEl.querySelector('input')) return

  const currentName = nameEl.textContent ?? def.name
  const input = document.createElement('input')
  input.type       = 'text'
  input.value      = currentName
  input.className  = 'layer-name-input'
  input.spellcheck = false
  nameEl.textContent = ''
  nameEl.appendChild(input)
  input.focus()
  input.select()

  const commit = () => {
    const newLabel = input.value.trim()
    setComponentLabel(compId, newLabel)
  }
  input.addEventListener('blur',    commit)
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter')  { ev.preventDefault(); input.blur() }
    if (ev.key === 'Escape') { input.value = currentName; input.blur() }
  })
}

layersList.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  const li     = target.closest('.layer-item')  as HTMLElement | null
  const btn    = target.closest('[data-action]') as HTMLElement | null
  if (!li) return
  const compId = li.dataset.compId
  if (!compId) return
  e.stopPropagation()

  const action = btn?.dataset.action
  if      (action === 'visibility') toggleComponentVisibility(compId)
  else if (action === 'lock')       toggleComponentLock(compId)
  else if (action === 'rotate')     rotateComponent(compId)
  else if (action === 'delete')     removeComponent(compId)
  else if (action === 'color')      showColorPicker(compId, btn as HTMLElement)
  else {
    const now = Date.now()
    if (compId === lastLayerClickId && now - lastLayerClickTime < 500) {
      // Double-click detected — start rename (re-query element after re-render)
      lastLayerClickId = ''
      requestAnimationFrame(() => startLayerItemRename(compId))
    } else {
      lastLayerClickId   = compId
      lastLayerClickTime = now
      selectItem(compId, 'component')
    }
  }
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
  svg.classList.toggle('has-highlight', wireId !== null)
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

// --- Keyboard ---

document.addEventListener('keydown', (e) => {
  const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
  if (e.key === 'Escape') {
    hideContextMenu(); cancelCurrentDrag()
    if (state.selectedId) selectItem(null, null)
  }
  if (!inInput && (e.key === 'Delete' || e.key === 'Backspace')) deleteSelected()
  if ((e.ctrlKey || e.metaKey) && e.key === '=')  { e.preventDefault(); setZoom(zoomLevel * 1.25) }
  if ((e.ctrlKey || e.metaKey) && e.key === '-')  { e.preventDefault(); setZoom(zoomLevel / 1.25) }
  if ((e.ctrlKey || e.metaKey) && e.key === '0')  { e.preventDefault(); setZoom(1) }
  if (!inInput && (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
  if (!inInput && (e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
})

