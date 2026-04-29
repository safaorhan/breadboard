import type { AppState, ComponentDef, PlacedComponent } from './types'
import { getComponentPinHole, PRESET_LIBRARY } from './components'

export const state: AppState = {
  placedComponents: [],
  wires: [],
  componentLibrary: [...PRESET_LIBRARY],
  selectedId: null,
  selectedType: null,
}

const listeners: (() => void)[] = []

function notify(): void {
  listeners.forEach(fn => fn())
}

export function onStateChange(fn: () => void): void {
  listeners.push(fn)
}

export function _resetStateForTest(library: ComponentDef[]): void {
  state.placedComponents = []
  state.wires = []
  state.componentLibrary = library
  state.selectedId = null
  state.selectedType = null
}

export function toggleComponentLock(id: string): void {
  const comp = state.placedComponents.find(c => c.id === id)
  if (!comp) return
  comp.locked = !comp.locked
  notify()
}

export function toggleComponentVisibility(id: string): void {
  const comp = state.placedComponents.find(c => c.id === id)
  if (!comp) return
  comp.hidden = !comp.hidden
  notify()
}

export function placeComponent(defId: string, anchorCol: number, anchorRow = 'E'): void {
  const def = state.componentLibrary.find(d => d.id === defId)
  if (!def) return
  const placed: PlacedComponent = {
    id: crypto.randomUUID(),
    defId,
    anchorCol,
    anchorRow,
    locked: false,
    hidden: false,
  }
  state.placedComponents.push(placed)
  notify()
}

export function moveComponent(id: string, anchorCol: number, anchorRow: string): void {
  const comp = state.placedComponents.find(c => c.id === id)
  if (!comp) return
  comp.anchorCol = anchorCol
  comp.anchorRow = anchorRow
  notify()
}

export function removeComponent(id: string): void {
  const comp = state.placedComponents.find(c => c.id === id)
  if (!comp) return
  const def = state.componentLibrary.find(d => d.id === comp.defId)
  if (def) {
    const pinHoles = new Set(def.pins.map(p => getComponentPinHole(comp, p, def)))
    state.wires = state.wires.filter(w => !pinHoles.has(w.from) && !pinHoles.has(w.to))
  }
  state.placedComponents = state.placedComponents.filter(c => c.id !== id)
  notify()
}

export function addWire(from: string, to: string): void {
  if (from === to) return
  state.wires.push({ id: crypto.randomUUID(), from, to })
  notify()
}

export function removeWire(id: string): void {
  state.wires = state.wires.filter(w => w.id !== id)
  notify()
}

export function addComponentDef(def: Omit<ComponentDef, 'id'>): void {
  state.componentLibrary.push({ ...def, id: crypto.randomUUID() })
  notify()
}

export function selectItem(id: string | null, type: 'component' | 'wire' | null): void {
  state.selectedId = id
  state.selectedType = type
  notify()
}
