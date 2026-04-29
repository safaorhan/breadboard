import { state, onStateChange, addComponentDef, toggleComponentLock } from './state'
import { initSVG, render, renderSidebar } from './render'
import { initDrag, startPlacement, cancelCurrentDrag, deleteSelected } from './drag'
import { analyzeNets } from './nets'
import { renderTable } from './table'

const canvasContainer = document.getElementById('canvas-container') as HTMLDivElement
const tableInner      = document.getElementById('table-inner')      as HTMLDivElement
const sidebarList     = document.getElementById('component-list')   as HTMLUListElement
const ctxMenu         = document.getElementById('context-menu')     as HTMLDivElement
const ctxLockItem     = document.getElementById('ctx-toggle-lock')  as HTMLLIElement

const svg = initSVG(canvasContainer)
initDrag(svg)

function update(): void {
  render(svg, state)
  renderSidebar(sidebarList, state.componentLibrary)
  renderTable(tableInner, analyzeNets(state))
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
  if (compEl?.dataset.componentId) {
    showContextMenu(e.clientX, e.clientY, compEl.dataset.componentId)
  } else {
    hideContextMenu()
    cancelCurrentDrag()
  }
})

document.addEventListener('click', (e) => {
  if (!ctxMenu.contains(e.target as Node)) hideContextMenu()
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
