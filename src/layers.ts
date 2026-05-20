import type { PlacedComponent, ComponentDef, AppState } from './types'
import { getColor } from './colors'
import { wireColor } from './jumpers'
import { getHolePosition, PITCH } from './board'

const ICON = {
  eyeOpen:    `<i class="ph ph-eye"              style="pointer-events:none;font-size:14px"></i>`,
  eyeClosed:  `<i class="ph ph-eye-slash"        style="pointer-events:none;font-size:14px"></i>`,
  lockClosed: `<i class="ph ph-lock-simple"      style="pointer-events:none;font-size:14px"></i>`,
  lockOpen:   `<i class="ph ph-lock-simple-open" style="pointer-events:none;font-size:14px"></i>`,
  rotate:     `<i class="ph ph-arrow-clockwise"  style="pointer-events:none;font-size:14px"></i>`,
  trash:      `<i class="ph ph-x"               style="pointer-events:none;font-size:14px"></i>`,
}

export function renderLayersPanel(
  list: HTMLElement,
  placedComponents: PlacedComponent[],
  library: ComponentDef[],
  selectedId: string | null,
): void {
  list.innerHTML = ''

  if (placedComponents.length === 0) return

  for (let i = placedComponents.length - 1; i >= 0; i--) {
    const placed = placedComponents[i]
    const def    = library.find(d => d.id === placed.defId)

    const li = document.createElement('li')
    li.className = [
      'layer-item',
      placed.id === selectedId ? 'selected' : '',
      placed.hidden ? 'layer-hidden' : '',
    ].filter(Boolean).join(' ')
    li.dataset.compId = placed.id

    const colorDot = document.createElement('button')
    colorDot.className        = 'layer-color-btn'
    colorDot.title            = 'Change color'
    colorDot.dataset.action   = 'color'
    colorDot.dataset.compId   = placed.id
    colorDot.style.background = getColor(placed.colorIdx).stroke

    const name = document.createElement('span')
    name.className   = 'layer-name'
    name.textContent = placed.label ?? (def?.name ?? '?')

    const actions = document.createElement('div')
    actions.className = 'layer-actions'
    actions.appendChild(iconBtn(placed.hidden ? ICON.eyeClosed : ICON.eyeOpen,   placed.hidden  ? 'Show'     : 'Hide',   'layer-btn',                            placed.id, 'visibility'))
    actions.appendChild(iconBtn(placed.locked ? ICON.lockClosed : ICON.lockOpen, placed.locked  ? 'Unlock'   : 'Lock',  placed.locked  ? 'layer-btn active' : 'layer-btn', placed.id, 'lock'))
    actions.appendChild(iconBtn(ICON.rotate, placed.rotated ? 'Unrotate' : 'Rotate', placed.rotated ? 'layer-btn active' : 'layer-btn', placed.id, 'rotate'))
    actions.appendChild(iconBtn(ICON.trash,  'Remove', 'layer-btn layer-btn-del', placed.id, 'delete'))

    li.appendChild(colorDot)
    li.appendChild(name)
    li.appendChild(actions)
    list.appendChild(li)
  }
}

function resolveEndpoint(hole: string): string {
  if (hole.includes(':')) {
    const rail = hole.slice(0, hole.lastIndexOf(':'))
    if (rail === 'top+' || rail === 'bottom+') return 'VCC'
    if (rail === 'top-' || rail === 'bottom-') return 'GND'
    return hole
  }
  return hole   // raw hole ID: e.g. "J13", "A6"
}

export function renderWiresList(list: HTMLElement, state: AppState): void {
  list.innerHTML = ''

  if (state.wires.length === 0) return

  const wireLen = (from: string, to: string) => {
    const a = getHolePosition(from), b = getHolePosition(to)
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) / PITCH
  }

  for (const wire of [...state.wires].sort((a, b) => wireLen(a.from, a.to) - wireLen(b.from, b.to))) {
    const li = document.createElement('li')
    li.className = ['wire-item', wire.id === state.selectedId ? 'selected' : ''].filter(Boolean).join(' ')
    li.dataset.wireId = wire.id

    const dot = document.createElement('span')
    dot.className        = 'wire-color-dot'
    dot.style.background = wireColor(wire.from, wire.to, state.jumperLibrary)

    const from = document.createElement('span')
    from.className   = 'wire-endpoint'
    from.textContent = resolveEndpoint(wire.from)

    const sep = document.createElement('span')
    sep.className   = 'wire-sep'
    sep.textContent = '-'

    const to = document.createElement('span')
    to.className   = 'wire-endpoint'
    to.textContent = resolveEndpoint(wire.to)

    const actions = document.createElement('div')
    actions.className = 'wire-actions'

    const len = document.createElement('span')
    len.className   = 'wire-len'
    len.textContent = `${+wireLen(wire.from, wire.to).toFixed(1)}p`

    const del = document.createElement('button')
    del.className   = 'layer-btn layer-btn-del'
    del.title       = 'Delete wire'
    del.innerHTML   = ICON.trash
    del.dataset.wireId = wire.id
    del.dataset.action = 'delete-wire'

    actions.appendChild(len)
    actions.appendChild(del)

    li.appendChild(dot)
    li.appendChild(from)
    li.appendChild(sep)
    li.appendChild(to)
    li.appendChild(actions)
    list.appendChild(li)
  }
}

function iconBtn(svg: string, title: string, className: string, compId: string, action: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.innerHTML      = svg
  btn.title          = title
  btn.className      = className
  btn.dataset.compId = compId
  btn.dataset.action = action
  return btn
}
