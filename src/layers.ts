import type { PlacedComponent, ComponentDef } from './types'

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

  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="pointer-events:none">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>`,
}

export function renderLayersPanel(
  list: HTMLElement,
  placedComponents: PlacedComponent[],
  library: ComponentDef[],
  selectedId: string | null,
): void {
  list.innerHTML = ''

  if (placedComponents.length === 0) {
    const empty = document.createElement('li')
    empty.className  = 'layer-empty'
    empty.textContent = 'No components placed'
    list.appendChild(empty)
    return
  }

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

    const name = document.createElement('span')
    name.className   = 'layer-name'
    name.textContent = def?.name ?? '?'

    const actions = document.createElement('div')
    actions.className = 'layer-actions'
    actions.appendChild(iconBtn(placed.hidden ? ICON.eyeClosed : ICON.eyeOpen,  placed.hidden ? 'Show'   : 'Hide',   'layer-btn',               placed.id, 'visibility'))
    actions.appendChild(iconBtn(placed.locked ? ICON.lockClosed : ICON.lockOpen, placed.locked ? 'Unlock' : 'Lock',  placed.locked ? 'layer-btn active' : 'layer-btn', placed.id, 'lock'))
    actions.appendChild(iconBtn(ICON.trash, 'Remove', 'layer-btn layer-btn-del', placed.id, 'delete'))

    li.appendChild(name)
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
