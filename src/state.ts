import type { AppState, ComponentDef, JumperDef, JumperSet, PlacedComponent } from './types'
import type { StoredJumperSet } from './db'
import { getComponentPinHole } from './components'
import { COMPONENT_COLORS } from './colors'
import {
  initializeDB,
  saveProject,
  saveComponentDef,
  deleteComponentDef as dbDeleteComponentDef,
  saveJumperSet,
  type Project,
} from './db'

export const state: AppState = {
  placedComponents:  [],
  wires:             [],
  jumperSets:        [],
  activeJumperSetId: null,
  jumperLibrary:     [],
  componentLibrary:  [],
  selectedId:        null,
  selectedType:      null,
}

const listeners: (() => void)[] = []
let nextColorIdx    = 0
let activeProject: Project = {
  id: '', name: 'Default', createdAt: 0, updatedAt: 0,
  placedComponents: [], wires: [], activeJumperSetId: null,
}
let activeJumperSet: JumperSet | null = null
let allJumperSets:   StoredJumperSet[] = []

// ── Persistence ───────────────────────────────────────────────────────────────

function saveStateToDB(): void {
  activeProject.placedComponents  = state.placedComponents
  activeProject.wires             = state.wires
  activeProject.activeJumperSetId = state.activeJumperSetId
  saveProject(activeProject).catch(() => {})
}

function saveActiveJumperSet(): void {
  if (!activeJumperSet) return
  saveJumperSet({ ...activeJumperSet, source: 'user' }).catch(() => {})
}

// If no active set exists yet, create an empty user set on demand.
function getOrCreateUserSet(): JumperSet {
  if (activeJumperSet) return activeJumperSet
  const set: JumperSet = { id: crypto.randomUUID(), name: 'My Jumpers', jumpers: [] }
  activeJumperSet        = set
  state.activeJumperSetId        = set.id
  activeProject.activeJumperSetId = set.id
  saveJumperSet({ ...set, source: 'user' }).catch(() => {})
  return set
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initDB(): Promise<void> {
  const { project, componentDefs, jumperSets } = await initializeDB()

  activeProject = project

  state.placedComponents = project.placedComponents.map((p: PlacedComponent) => ({
    ...p,
    rotated:     p.rotated     ?? false,
    colorIdx:    p.colorIdx    ?? 0,
    instanceNum: p.instanceNum ?? 1,
  }))
  state.wires     = project.wires

  allJumperSets    = jumperSets
  state.jumperSets = jumperSets

  const requestedSet = jumperSets.find(s => s.id === project.activeJumperSetId) ?? null
  // If the previously active set was a system preset that got purged on re-seed,
  // fall back to the first available system set so the project isn't left with none.
  activeJumperSet = requestedSet ?? jumperSets.find(s => s.source === 'system') ?? null

  state.activeJumperSetId = activeJumperSet?.id ?? null
  state.jumperLibrary     = activeJumperSet ? [...activeJumperSet.jumpers] : []

  if (state.activeJumperSetId !== project.activeJumperSetId) {
    activeProject.activeJumperSetId = state.activeJumperSetId
    saveProject(activeProject).catch(() => {})
  }

  // StoredComponentDef extends ComponentDef, directly assignable
  state.componentLibrary = componentDefs

  const maxIdx = state.placedComponents.reduce((m, p) => Math.max(m, p.colorIdx), -1)
  nextColorIdx = maxIdx + 1
}

// ── Core ──────────────────────────────────────────────────────────────────────

function notify(): void {
  listeners.forEach(fn => fn())
  saveStateToDB()
}

export function onStateChange(fn: () => void): void {
  listeners.push(fn)
}

export function _resetStateForTest(library: ComponentDef[]): void {
  state.placedComponents  = []
  state.wires             = []
  state.jumperSets        = []
  state.activeJumperSetId = null
  state.jumperLibrary     = []
  state.componentLibrary  = library
  state.selectedId        = null
  state.selectedType      = null
  nextColorIdx    = 0
  activeJumperSet = null
  allJumperSets   = []
}

export function setActiveJumperSet(id: string | null): void {
  const set = allJumperSets.find(s => s.id === id) ?? null
  activeJumperSet         = set
  state.activeJumperSetId = set?.id ?? null
  state.jumperLibrary     = set ? [...set.jumpers] : []
  notify()
}

// ── Jumper library ────────────────────────────────────────────────────────────

export function addJumperDef(color: string, pitch: number): void {
  const set = getOrCreateUserSet()
  set.jumpers.push({ color, pitch })
  state.jumperLibrary = [...set.jumpers]
  saveActiveJumperSet()
  notify()
}

export function removeJumperDef(pitch: number): void {
  if (!activeJumperSet) return
  activeJumperSet.jumpers = activeJumperSet.jumpers.filter(j => j.pitch !== pitch)
  state.jumperLibrary = [...activeJumperSet.jumpers]
  saveActiveJumperSet()
  notify()
}

export function updateJumperDef(originalPitch: number, updates: JumperDef): void {
  if (!activeJumperSet) return
  const idx = activeJumperSet.jumpers.findIndex(j => j.pitch === originalPitch)
  if (idx === -1) return
  activeJumperSet.jumpers[idx] = updates
  state.jumperLibrary = [...activeJumperSet.jumpers]
  saveActiveJumperSet()
  notify()
}

// ── Components ────────────────────────────────────────────────────────────────

export function rotateComponent(id: string): void {
  const comp = state.placedComponents.find(c => c.id === id)
  if (!comp) return
  const def = state.componentLibrary.find(d => d.id === comp.defId)
  if (def) {
    const pinHoles = new Set(def.pins.filter(p => p.name !== '*').map(p => getComponentPinHole(comp, p, def)))
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
    const pinHoles = new Set(def.pins.filter(p => p.name !== '*').map(p => getComponentPinHole(comp, p, def)))
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
      const pinHoles = new Set(def.pins.filter(p => p.name !== '*').map(p => getComponentPinHole(comp, p, def)))
      state.wires = state.wires.filter(w => !pinHoles.has(w.from) && !pinHoles.has(w.to))
    }
  }
  state.placedComponents = state.placedComponents.filter(c => c.defId !== id)
  state.componentLibrary = state.componentLibrary.filter(d => d.id !== id)
  dbDeleteComponentDef(id).catch(() => {})
  notify()
}

export function setComponentColor(id: string, colorIdx: number): void {
  const comp = state.placedComponents.find(c => c.id === id)
  if (!comp) return
  comp.colorIdx = colorIdx
  notify()
}

export function addComponentDef(def: Omit<ComponentDef, 'id'>): void {
  const newDef = { ...def, id: crypto.randomUUID() }
  state.componentLibrary.push(newDef)
  saveComponentDef({ ...newDef, source: 'user' }).catch(() => {})
  notify()
}

export function updateComponentDef(id: string, updates: Omit<ComponentDef, 'id'>): void {
  const idx = state.componentLibrary.findIndex(d => d.id === id)
  if (idx === -1) return
  state.componentLibrary[idx] = { ...updates, id }
  saveComponentDef({ ...updates, id, source: 'user' }).catch(() => {})
  notify()
}

export function selectItem(id: string | null, type: 'component' | 'wire' | null): void {
  state.selectedId = id
  state.selectedType = type
  notify()
}
