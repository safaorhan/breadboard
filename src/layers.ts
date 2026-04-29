import type { PlacedComponent, ComponentDef } from './types'

const ICON = {
  eyeOpen: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 7c1.5-3.5 4-5 6-5s4.5 1.5 6 5c-1.5 3.5-4 5-6 5S2.5 10.5 1 7z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>
    <circle cx="7" cy="7" r="1.75" fill="currentColor"/>
  </svg>`,

  eyeClosed: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.5 1.5l11 11" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
    <path d="M5 4.2A6.6 6.6 0 001 7c1.5 3.5 4 5 6 5a6 6 0 003.3-1M9.5 5.5C10.5 6 11.5 6.6 13 7c-.8 1.8-2.2 3.3-4 4.1" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
  </svg>`,

  lockClosed: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="6.5" width="8" height="5.5" rx="1.25" stroke="currentColor" stroke-width="1.25"/>
    <path d="M4.75 6.5V5A2.25 2.25 0 019.25 5v1.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
  </svg>`,

  lockOpen: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="6.5" width="8" height="5.5" rx="1.25" stroke="currentColor" stroke-width="1.25"/>
    <path d="M4.75 6.5V5A2.25 2.25 0 019.25 5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
  </svg>`,

  trash: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.5 4.5h9" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
    <path d="M5.5 4.5V3h3v1.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5.5 4.5l.5 7h2l.5-7" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
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
    empty.className = 'layer-empty'
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
    actions.appendChild(iconBtn(placed.hidden ? ICON.eyeClosed : ICON.eyeOpen, placed.hidden ? 'Show' : 'Hide', 'layer-btn', placed.id, 'visibility'))
    actions.appendChild(iconBtn(placed.locked ? ICON.lockClosed : ICON.lockOpen, placed.locked ? 'Unlock' : 'Lock', placed.locked ? 'layer-btn active' : 'layer-btn', placed.id, 'lock'))
    actions.appendChild(iconBtn(ICON.trash, 'Remove', 'layer-btn layer-btn-del', placed.id, 'delete'))

    li.appendChild(name)
    li.appendChild(actions)
    list.appendChild(li)
  }
}

function iconBtn(svg: string, title: string, className: string, compId: string, action: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.innerHTML       = svg
  btn.title           = title
  btn.className       = className
  btn.dataset.compId  = compId
  btn.dataset.action  = action
  return btn
}
