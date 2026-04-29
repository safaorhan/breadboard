import { state, onStateChange, addComponentDef } from './state'
import { initSVG, render, renderSidebar } from './render'
import { initDrag, startPlacement, cancelCurrentDrag, deleteSelected } from './drag'
import { analyzeNets } from './nets'
import { renderTable } from './table'

const canvasContainer = document.getElementById('canvas-container') as HTMLDivElement
const tableInner      = document.getElementById('table-inner')      as HTMLDivElement
const sidebarList     = document.getElementById('component-list')   as HTMLUListElement

const svg = initSVG(canvasContainer)
initDrag(svg)

function update(): void {
  render(svg, state)
  renderSidebar(sidebarList, state.componentLibrary)
  renderTable(tableInner, analyzeNets(state))
}

onStateChange(update)
update()

sidebarList.addEventListener('click', (e) => {
  const li = (e.target as HTMLElement).closest('[data-def-id]') as HTMLElement | null
  if (!li) return
  document.querySelectorAll('#component-list li').forEach(el => el.classList.remove('active'))
  li.classList.add('active')
  startPlacement(li.dataset.defId!)
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape')                          cancelCurrentDrag()
  if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
})

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
