import type { AppState, ComponentDef, PlacedComponent } from './types'
import { getComponentPinHole, PRESET_LIBRARY } from './components'
import { COMPONENT_COLORS } from './colors'

const STORAGE_KEY = 'breadboard-state'

export const state: AppState = {
  placedComponents: [],
  wires: [],
  componentLibrary: [...PRESET_LIBRARY],
  selectedId: null,
  selectedType: null,
}

const listeners: (() => void)[] = []
let nextColorIdx = 0

// ── Persistence ─────────────────────────────────────────────────────────────

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      componentLibrary: state.componentLibrary,
      placedComponents: state.placedComponents,
      wires:            state.wires,
    }))
  } catch { /* storage unavailable or quota exceeded */ }
}

function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (Array.isArray(data.componentLibrary)) state.componentLibrary = data.componentLibrary
    if (Array.isArray(data.placedComponents)) {
      state.placedComponents = data.placedComponents.map((p: PlacedComponent) => ({
        ...p,
        rotated:     p.rotated     ?? false,
        colorIdx:    p.colorIdx    ?? 0,
        instanceNum: p.instanceNum ?? 1,
      }))
      // advance color counter past any indices already in use
      const maxIdx = state.placedComponents.reduce((m, p) => Math.max(m, p.colorIdx), -1)
      nextColorIdx = maxIdx + 1
    }
    if (Array.isArray(data.wires)) state.wires = data.wires
  } catch { /* corrupt / incompatible data — start fresh */ }
}

load()

// ── Core ─────────────────────────────────────────────────────────────────────

function notify(): void {
  listeners.forEach(fn => fn())
  save()
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
  nextColorIdx = 0
}

export function rotateComponent(id: string): void {
  const comp = state.placedComponents.find(c => c.id === id)
  if (!comp) return
  const def = state.componentLibrary.find(d => d.id === comp.defId)
  if (def) {
    const pinHoles = new Set(def.pins.map(p => getComponentPinHole(comp, p, def)))
    state.wires = state.wires.filter(w => !pinHoles.has(w.from) && !pinHoles.has(w.to))
  }
  comp.rotated = !comp.rotated
  notify()
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
    locked:      false,
    hidden:      false,
    rotated:     false,
    colorIdx:    nextColorIdx++ % COMPONENT_COLORS.length,
    instanceNum: state.placedComponents.filter(c => c.defId === defId).length + 1,
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

export function removeComponentDef(id: string): void {
  const instances = state.placedComponents.filter(c => c.defId === id)
  const def       = state.componentLibrary.find(d => d.id === id)
  if (def) {
    for (const comp of instances) {
      const pinHoles = new Set(def.pins.map(p => getComponentPinHole(comp, p, def)))
      state.wires = state.wires.filter(w => !pinHoles.has(w.from) && !pinHoles.has(w.to))
    }
  }
  state.placedComponents = state.placedComponents.filter(c => c.defId !== id)
  state.componentLibrary = state.componentLibrary.filter(d => d.id !== id)
  notify()
}

export function setComponentColor(id: string, colorIdx: number): void {
  const comp = state.placedComponents.find(c => c.id === id)
  if (!comp) return
  comp.colorIdx = colorIdx
  notify()
}

export function addComponentDef(def: Omit<ComponentDef, 'id'>): void {
  state.componentLibrary.push({ ...def, id: crypto.randomUUID() })
  notify()
}

export function updateComponentDef(id: string, updates: Omit<ComponentDef, 'id'>): void {
  const idx = state.componentLibrary.findIndex(d => d.id === id)
  if (idx === -1) return
  state.componentLibrary[idx] = { ...updates, id }
  notify()
}

export function selectItem(id: string | null, type: 'component' | 'wire' | null): void {
  state.selectedId = id
  state.selectedType = type
  notify()
}
