import type { AppState, ComponentDef, JumperDef, JumperSet, PlacedComponent } from './types'
import type { StoredJumperSet } from './db'
import { getComponentPinHole } from './components'
import { COMPONENT_COLORS } from './colors'
import {
  initializeDB,
  saveProject,
  loadProject,
  loadAllProjects,
  deleteProject as dbDeleteProject,
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
  id: '', name: 'Untitled', createdAt: 0, updatedAt: 0,
  placedComponents: [], wires: [], activeJumperSetId: null,
}
let activeJumperSet: JumperSet | null = null
let allJumperSets:   StoredJumperSet[] = []

const SESSION_KEY = 'breadboard-project'

// ── Cross-tab sync ────────────────────────────────────────────────────────────
// BroadcastChannel lets tabs on the same origin notify each other when the
// shared IndexedDB changes.  Each tab only reacts to messages that concern
// its own active project so tabs working on different projects are unaffected.

const syncChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('breadboard-sync')
  : null

// Set while we are applying data that arrived from another tab so that
// saveStateToDB() and the broadcast helpers know not to echo it back.
let isExternalUpdate = false

// Debounce handle for the post-save broadcast to avoid flooding other tabs
// during rapid edits (placing a component, drawing many wires, etc.).
let broadcastSaveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleBroadcastSave(projectId: string): void {
  if (isExternalUpdate) return
  if (broadcastSaveTimer) clearTimeout(broadcastSaveTimer)
  broadcastSaveTimer = setTimeout(() => {
    broadcastSaveTimer = null
    syncChannel?.postMessage({ type: 'project-saved', projectId })
  }, 300)
}

function broadcastImmediate(type: string, projectId: string): void {
  if (isExternalUpdate) return
  syncChannel?.postMessage({ type, projectId })
}

// Re-render the UI from current state without writing back to the DB.
// Used when applying an external update so we don't echo it back.
function notifyListenersOnly(): void {
  listeners.forEach(fn => fn())
}

if (syncChannel) {
  syncChannel.onmessage = async (event: MessageEvent<{ type: string; projectId: string }>) => {
    const { type, projectId } = event.data

    if (type === 'project-saved' && projectId === activeProject.id) {
      // Another tab saved our project — reload the fresh version from DB.
      const fresh = await loadProject(projectId)
      if (!fresh) return
      isExternalUpdate = true
      applyProjectToState(fresh)
      notifyListenersOnly()
      isExternalUpdate = false
    }

    if (type === 'project-deleted' && projectId === activeProject.id) {
      // Another tab deleted the project we have open — switch to the next one.
      const remaining = (await loadAllProjects()).sort((a, b) => b.updatedAt - a.updatedAt)
      if (remaining.length > 0) {
        applyProjectToState(remaining[0])
      } else {
        const newId  = await createProject()
        const fresh  = await loadProject(newId)
        if (fresh) applyProjectToState(fresh)
      }
      notifyListenersOnly()
    }
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────

function saveStateToDB(): void {
  if (isExternalUpdate) return
  activeProject.placedComponents  = state.placedComponents
  activeProject.wires             = state.wires
  activeProject.activeJumperSetId = state.activeJumperSetId
  saveProject(activeProject)
    .then(() => scheduleBroadcastSave(activeProject.id))
    .catch(() => {})
}

function saveActiveJumperSet(): void {
  if (!activeJumperSet) return
  saveJumperSet({ ...activeJumperSet, source: 'user' }).catch(() => {})
}

function getOrCreateUserSet(): JumperSet {
  if (activeJumperSet) return activeJumperSet
  const set: JumperSet = { id: crypto.randomUUID(), name: 'My Jumpers', jumpers: [] }
  activeJumperSet                 = set
  state.activeJumperSetId         = set.id
  activeProject.activeJumperSetId = set.id
  saveJumperSet({ ...set, source: 'user' }).catch(() => {})
  return set
}

// ── Apply a project record into in-memory state ───────────────────────────────

function applyProjectToState(project: Project): void {
  activeProject = project
  sessionStorage.setItem(SESSION_KEY, project.id)

  state.placedComponents = project.placedComponents.map((p: PlacedComponent) => ({
    ...p,
    rotated:     p.rotated     ?? false,
    colorIdx:    p.colorIdx    ?? 0,
    instanceNum: p.instanceNum ?? 1,
  }))
  state.wires        = project.wires
  state.selectedId   = null
  state.selectedType = null

  const requestedSet = allJumperSets.find(s => s.id === project.activeJumperSetId) ?? null
  activeJumperSet = requestedSet ?? allJumperSets.find(s => s.source === 'system') ?? null

  state.activeJumperSetId = activeJumperSet?.id ?? null
  state.jumperLibrary     = activeJumperSet ? [...activeJumperSet.jumpers] : []

  if (state.activeJumperSetId !== project.activeJumperSetId) {
    activeProject.activeJumperSetId = state.activeJumperSetId
    saveProject(activeProject).catch(() => {})
  }

  const maxIdx = state.placedComponents.reduce((m, p) => Math.max(m, p.colorIdx), -1)
  nextColorIdx = maxIdx + 1
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initDB(): Promise<void> {
  const { allProjects, componentDefs, jumperSets } = await initializeDB()

  allJumperSets    = jumperSets
  state.jumperSets = jumperSets
  state.componentLibrary = componentDefs

  // Pick active project: sessionStorage → most recently modified
  const sessionId = sessionStorage.getItem(SESSION_KEY)
  const project   = allProjects.find(p => p.id === sessionId)
    ?? [...allProjects].sort((a, b) => b.updatedAt - a.updatedAt)[0]

  applyProjectToState(project)
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

// ── Project management ────────────────────────────────────────────────────────

export function getActiveProjectId():   string { return activeProject.id }
export function getActiveProjectName(): string { return activeProject.name }

export async function getAllProjects(): Promise<Project[]> {
  return loadAllProjects()
}

export function renameProject(name: string): void {
  activeProject.name = name.trim() || 'Untitled'
  saveProject(activeProject)
    .then(() => broadcastImmediate('project-saved', activeProject.id))
    .catch(() => {})
}

export async function renameProjectById(id: string, name: string): Promise<void> {
  if (id === activeProject.id) { renameProject(name); return }
  const project = await loadProject(id)
  if (!project) return
  project.name = name.trim() || 'Untitled'
  saveProject(project)
    .then(() => broadcastImmediate('project-saved', id))
    .catch(() => {})
}

export function updateThumbnail(dataURL: string): void {
  activeProject.thumbnail = dataURL
  saveProject(activeProject).catch(() => {})
  // No broadcast — thumbnail updates are cosmetic and would cause
  // unnecessary reloads in other tabs.
}

export async function openProject(projectId: string): Promise<void> {
  const project = await loadProject(projectId)
  if (!project) return
  applyProjectToState(project)
  notify()
}

export async function createProject(): Promise<string> {
  const now = Date.now()
  const project: Project = {
    id:                crypto.randomUUID(),
    name:              'Untitled',
    createdAt:         now,
    updatedAt:         now,
    placedComponents:  [],
    wires:             [],
    activeJumperSetId: null,
  }
  await saveProject(project)
  return project.id
}

export async function deleteProjectById(id: string): Promise<void> {
  await dbDeleteProject(id)
  broadcastImmediate('project-deleted', id)
  if (id === activeProject.id) {
    const remaining = await loadAllProjects()
    if (remaining.length > 0) {
      const next = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0]
      applyProjectToState(next)
      notify()
    } else {
      const newId = await createProject()
      const fresh = await loadProject(newId)
      if (fresh) { applyProjectToState(fresh); notify() }
    }
  }
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

export function setComponentLabel(id: string, label: string): void {
  const comp = state.placedComponents.find(c => c.id === id)
  if (!comp) return
  comp.label = label || undefined
  notify()
}

export function addComponentDef(def: Omit<ComponentDef, 'id' | 'source'>): void {
  const newDef: ComponentDef = { ...def, id: crypto.randomUUID(), source: 'user' }
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

export interface BBFile {
  version:           number
  name:              string
  createdAt:         number
  placedComponents:  PlacedComponent[]
  wires:             { id: string; from: string; to: string }[]
  activeJumperSetId: string | null
}

export async function importProjectData(data: BBFile): Promise<string> {
  const now: number = Date.now()
  const project: Project = {
    id:                crypto.randomUUID(),
    name:              data.name || 'Imported',
    createdAt:         data.createdAt || now,
    updatedAt:         now,
    placedComponents:  data.placedComponents,
    wires:             data.wires,
    activeJumperSetId: data.activeJumperSetId ?? null,
  }
  await saveProject(project)
  return project.id
}
