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
  deleteJumperSet as dbDeleteJumperSet,
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
      const remaining = (await loadAllProjects()).sort((a, b) => b.updatedAt - a.updatedAt)
      if (remaining.length > 0) applyProjectToState(remaining[0])
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
  undoStack.length = 0
  redoStack.length = 0
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

  // Pick active project: sessionStorage → most recently modified (may be undefined if no projects)
  const sessionId = sessionStorage.getItem(SESSION_KEY)
  const project   = allProjects.find(p => p.id === sessionId)
    ?? [...allProjects].sort((a, b) => b.updatedAt - a.updatedAt)[0]

  if (project) applyProjectToState(project)
}

// ── Undo / Redo ───────────────────────────────────────────────────────────────

interface Snapshot {
  placedComponents: PlacedComponent[]
  wires:            { id: string; from: string; to: string }[]
  jumperLibrary:    import('./types').JumperDef[]
}

const MAX_UNDO   = 100
const undoStack: Snapshot[] = []
const redoStack: Snapshot[] = []

function captureSnapshot(): Snapshot {
  return {
    placedComponents: state.placedComponents.map(c => ({ ...c })),
    wires:            state.wires.map(w => ({ ...w })),
    jumperLibrary:    state.jumperLibrary.map(j => ({ ...j })),
  }
}

function pushUndo(): void {
  undoStack.push(captureSnapshot())
  if (undoStack.length > MAX_UNDO) undoStack.shift()
  redoStack.length = 0
}

function applySnapshot(snap: Snapshot): void {
  state.placedComponents = snap.placedComponents
  state.wires            = snap.wires
  state.jumperLibrary    = snap.jumperLibrary
  if (activeJumperSet) {
    activeJumperSet.jumpers = [...snap.jumperLibrary]
    saveActiveJumperSet()
  }
}

export function undo(): void {
  if (undoStack.length === 0) return
  redoStack.push(captureSnapshot())
  applySnapshot(undoStack.pop()!)
  notify()
}

export function redo(): void {
  if (redoStack.length === 0) return
  undoStack.push(captureSnapshot())
  applySnapshot(redoStack.pop()!)
  notify()
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
    const remaining = (await loadAllProjects()).sort((a, b) => b.updatedAt - a.updatedAt)
    if (remaining.length > 0) { applyProjectToState(remaining[0]); notify() }
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

export function updateJumperSet(id: string, name: string, jumpers: JumperDef[]): void {
  const set = allJumperSets.find(s => s.id === id)
  if (!set) return
  set.name    = name
  set.jumpers = [...jumpers]
  state.jumperSets = [...allJumperSets]
  saveJumperSet({ ...set }).catch(() => {})
  if (activeJumperSet?.id === id) state.jumperLibrary = [...jumpers]
  notify()
}

export function deleteJumperSetById(id: string): void {
  allJumperSets = allJumperSets.filter(s => s.id !== id)
  state.jumperSets = [...allJumperSets]
  dbDeleteJumperSet(id).catch(() => {})
  if (activeJumperSet?.id === id) {
    const fallback = allJumperSets.find(s => s.source !== 'user') ?? allJumperSets[0] ?? null
    activeJumperSet         = fallback
    state.activeJumperSetId = fallback?.id ?? null
    state.jumperLibrary     = fallback ? [...fallback.jumpers] : []
    activeProject.activeJumperSetId = state.activeJumperSetId
  }
  notify()
}

export function createJumperSet(name: string, jumpers: JumperDef[]): void {
  const set: StoredJumperSet = { id: crypto.randomUUID(), name, jumpers: [...jumpers], source: 'user' }
  allJumperSets.push(set)
  state.jumperSets = [...allJumperSets]
  saveJumperSet(set).catch(() => {})
  setActiveJumperSet(set.id)
}

export function addJumperDef(color: string, pitch: number): void {
  pushUndo()
  const set = getOrCreateUserSet()
  set.jumpers.push({ color, pitch })
  state.jumperLibrary = [...set.jumpers]
  saveActiveJumperSet()
  notify()
}

export function removeJumperDef(pitch: number): void {
  if (!activeJumperSet) return
  pushUndo()
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
  pushUndo()
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
  pushUndo()
  comp.anchorCol = anchorCol
  comp.anchorRow = anchorRow
  notify()
}

export function removeComponent(id: string): void {
  const comp = state.placedComponents.find(c => c.id === id)
  if (!comp) return
  pushUndo()
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
  pushUndo()
  state.wires.push({ id: crypto.randomUUID(), from, to })
  notify()
}

export function removeWire(id: string): void {
  pushUndo()
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
  pushUndo()
  comp.colorIdx = colorIdx
  notify()
}

export function setComponentLabel(id: string, label: string): void {
  const comp = state.placedComponents.find(c => c.id === id)
  if (!comp) return
  pushUndo()
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
  version?:          number
  name:              string
  description?:      string
  createdAt?:        number
  placedComponents:  PlacedComponent[]
  wires:             { id: string; from: string; to: string }[]
  activeJumperSetId: string | null
  componentDefs?:    ComponentDef[]
}

async function restoreEmbeddedDefs(defs: ComponentDef[]): Promise<void> {
  const systemIds = new Set(state.componentLibrary.filter(d => d.source !== 'user').map(d => d.id))
  const userIds   = new Set(state.componentLibrary.filter(d => d.source === 'user').map(d => d.id))
  for (const def of defs) {
    const isSystem = def.source !== 'user'
    if (isSystem) {
      if (systemIds.has(def.id) || userIds.has(def.id)) continue
    } else {
      if (userIds.has(def.id) || systemIds.has(def.id)) continue
    }
    const stored = { ...def, source: 'user' as const }
    state.componentLibrary.push(stored)
    await saveComponentDef(stored)
  }
}

export async function createProjectFromExample(data: BBFile): Promise<string> {
  const now = Date.now()
  if (data.componentDefs?.length) await restoreEmbeddedDefs(data.componentDefs)
  const project: Project = {
    id:                crypto.randomUUID(),
    name:              data.name,
    createdAt:         now,
    updatedAt:         now,
    placedComponents:  data.placedComponents,
    wires:             data.wires,
    activeJumperSetId: data.activeJumperSetId ?? null,
  }
  await saveProject(project)
  return project.id
}

export async function importProjectData(data: BBFile): Promise<string> {
  const now: number = Date.now()
  if (data.componentDefs?.length) await restoreEmbeddedDefs(data.componentDefs)
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
