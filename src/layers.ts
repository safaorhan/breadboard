import type { PlacedComponent, ComponentDef, AppState } from './types'
import { getColor } from './colors'
import { wireColor } from './jumpers'
import { getHolePosition, PITCH } from './board'

// Lucide-style icons (24×24 viewBox, stroke-based)
const ICON = {
  eyeOpen: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="pointer-events:none">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`,

  eyeClosed: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="pointer-events:none">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-10-8-10-8a18.45 18.45 0 015.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 8 10 8a18.5 18.5 0 01-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>`,

  lockClosed: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="pointer-events:none">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>`,

  lockOpen: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="pointer-events:none">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 019.9-1"/>
  </svg>`,

  rotate: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="pointer-events:none">
    <path d="M21 2v6h-6"/>
    <path d="M3 12a9 9 0 0115-6.7L21 8"/>
    <path d="M3 22v-6h6"/>
    <path d="M21 12a9 9 0 01-15 6.7L3 16"/>
  </svg>`,

  trash: `<svg width="14" height="14" viewBox="0 0 24 24" style="pointer-events:none"><use href="#icon-x"/></svg>`,
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
