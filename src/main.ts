import { state, onStateChange } from './state'
import { initSVG, render, renderSidebar } from './render'
import { analyzeNets } from './nets'
import { renderTable } from './table'

const canvasContainer = document.getElementById('canvas-container') as HTMLDivElement
const tableInner      = document.getElementById('table-inner')      as HTMLDivElement
const sidebarList     = document.getElementById('component-list')   as HTMLUListElement

const svg = initSVG(canvasContainer)

function update(): void {
  render(svg, state)
  renderSidebar(sidebarList, state.componentLibrary)
  renderTable(tableInner, analyzeNets(state))
}

onStateChange(update)
update()
