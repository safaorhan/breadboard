import type { PlacedComponent, ComponentDef } from './types'

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
    name.className    = 'layer-name'
    name.textContent  = def?.name ?? '?'

    const actions = document.createElement('div')
    actions.className = 'layer-actions'

    const visBtn = makeBtn(
      placed.hidden ? '○' : '●',
      placed.hidden ? 'Show' : 'Hide',
      'layer-btn',
      placed.id,
      'visibility',
    )

    const lockBtn = makeBtn(
      placed.locked ? '⊠' : '⊡',
      placed.locked ? 'Unlock' : 'Lock',
      placed.locked ? 'layer-btn active' : 'layer-btn',
      placed.id,
      'lock',
    )

    const delBtn = makeBtn('✕', 'Remove', 'layer-btn layer-btn-del', placed.id, 'delete')

    actions.appendChild(visBtn)
    actions.appendChild(lockBtn)
    actions.appendChild(delBtn)
    li.appendChild(name)
    li.appendChild(actions)
    list.appendChild(li)
  }
}

function makeBtn(
  text: string,
  title: string,
  className: string,
  compId: string,
  action: string,
): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.textContent      = text
  btn.title            = title
  btn.className        = className
  btn.dataset.compId   = compId
  btn.dataset.action   = action
  return btn
}
