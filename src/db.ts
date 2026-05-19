import type { ComponentDef, JumperSet, PlacedComponent, Wire } from './types'
import { PRESET_LIBRARY, PRESET_JUMPER_LIBRARY } from './components'

const DB_NAME    = 'breadboard'
const DB_VERSION = 2   // bump only for schema changes (new/removed stores, indexes)
const SEED_VERSION = 6 // bump whenever lib/components or lib/jumper-sets content changes

export interface Project {
  id:                string
  name:              string
  createdAt:         number
  updatedAt:         number
  placedComponents:  PlacedComponent[]
  wires:             Wire[]
  activeJumperSetId: string | null
  thumbnail?:        string   // JPEG data URL, generated on canvas capture
}

export interface StoredComponentDef extends ComponentDef {
  source: 'system' | 'user'
}

export interface StoredJumperSet extends JumperSet {
  source: 'system' | 'user'
}

let _db: IDBDatabase | null = null

function idbReq<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror   = () => reject(request.error)
  })
}

function openDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db         = (event.target as IDBOpenDBRequest).result
      const oldVersion = event.oldVersion

      if (oldVersion < 1) {
        db.createObjectStore('projects',      { keyPath: 'id' })
        db.createObjectStore('componentDefs', { keyPath: 'id' })
        db.createObjectStore('meta',          { keyPath: 'key' })
      }

      if (oldVersion < 2) {
        if (db.objectStoreNames.contains('jumperDefs'))
          db.deleteObjectStore('jumperDefs')
        if (!db.objectStoreNames.contains('jumperSets'))
          db.createObjectStore('jumperSets', { keyPath: 'id' })
      }
    }

    request.onsuccess = () => { _db = request.result; resolve() }
    request.onerror   = () => reject(request.error)
  })
}

// ── Meta ──────────────────────────────────────────────────────────────────────

async function getMeta(key: string): Promise<unknown> {
  const store = _db!.transaction('meta', 'readonly').objectStore('meta')
  const row   = await idbReq(store.get(key)) as { key: string; value: unknown } | undefined
  return row?.value
}

async function setMeta(key: string, value: unknown): Promise<void> {
  const store = _db!.transaction('meta', 'readwrite').objectStore('meta')
  await idbReq(store.put({ key, value }))
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function saveProject(project: Project): Promise<void> {
  const store = _db!.transaction('projects', 'readwrite').objectStore('projects')
  await idbReq(store.put({ ...project, updatedAt: Date.now() }))
}

export async function loadProject(id: string): Promise<Project | null> {
  const store = _db!.transaction('projects', 'readonly').objectStore('projects')
  return (await idbReq(store.get(id))) ?? null
}

export async function loadAllProjects(): Promise<Project[]> {
  const store = _db!.transaction('projects', 'readonly').objectStore('projects')
  return idbReq(store.getAll())
}

export async function deleteProject(id: string): Promise<void> {
  const store = _db!.transaction('projects', 'readwrite').objectStore('projects')
  await idbReq(store.delete(id))
}

// ── Component defs ────────────────────────────────────────────────────────────

export async function saveComponentDef(def: StoredComponentDef): Promise<void> {
  const store = _db!.transaction('componentDefs', 'readwrite').objectStore('componentDefs')
  await idbReq(store.put(def))
}

export async function deleteComponentDef(id: string): Promise<void> {
  const store = _db!.transaction('componentDefs', 'readwrite').objectStore('componentDefs')
  await idbReq(store.delete(id))
}

async function loadAllComponentDefs(): Promise<StoredComponentDef[]> {
  const store = _db!.transaction('componentDefs', 'readonly').objectStore('componentDefs')
  return idbReq(store.getAll())
}

// ── Jumper sets ───────────────────────────────────────────────────────────────

export async function saveJumperSet(set: StoredJumperSet): Promise<void> {
  const store = _db!.transaction('jumperSets', 'readwrite').objectStore('jumperSets')
  await idbReq(store.put(set))
}

export async function deleteJumperSet(id: string): Promise<void> {
  const store = _db!.transaction('jumperSets', 'readwrite').objectStore('jumperSets')
  await idbReq(store.delete(id))
}

async function loadAllJumperSets(): Promise<StoredJumperSet[]> {
  const store = _db!.transaction('jumperSets', 'readonly').objectStore('jumperSets')
  return idbReq(store.getAll())
}

// ── First-run seeding ─────────────────────────────────────────────────────────

async function seedSystemDefs(): Promise<void> {
  for (const def of await loadAllComponentDefs()) {
    if (def.source === 'system') await deleteComponentDef(def.id)
  }
  for (const def of PRESET_LIBRARY) {
    await saveComponentDef({ ...def, source: 'system' })
  }
  for (const set of await loadAllJumperSets()) {
    if (set.source === 'system') await deleteJumperSet(set.id)
  }
  for (const set of PRESET_JUMPER_LIBRARY) {
    await saveJumperSet({ ...set, source: 'system' })
  }
}

// ── localStorage migration ────────────────────────────────────────────────────

const LS_STATE_KEY = 'breadboard-state'

async function migrateFromLocalStorage(): Promise<string | null> {
  try {
    const raw = localStorage.getItem(LS_STATE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)

    let activeJumperSetId: string | null = null
    if (Array.isArray(data.jumperLibrary) && data.jumperLibrary.length > 0) {
      const setId = crypto.randomUUID()
      await saveJumperSet({ id: setId, name: 'My Jumpers', jumpers: data.jumperLibrary, source: 'user' })
      activeJumperSetId = setId
    }

    const projectId = crypto.randomUUID()
    const now       = Date.now()
    await saveProject({
      id:                projectId,
      name:              'Default',
      createdAt:         now,
      updatedAt:         now,
      placedComponents:  Array.isArray(data.placedComponents) ? data.placedComponents : [],
      wires:             Array.isArray(data.wires)            ? data.wires            : [],
      activeJumperSetId,
    })

    const presetIds = new Set(PRESET_LIBRARY.map(d => d.id))
    if (Array.isArray(data.componentLibrary)) {
      for (const def of data.componentLibrary) {
        if (!presetIds.has(def.id)) await saveComponentDef({ ...def, source: 'user' })
      }
    }

    localStorage.removeItem(LS_STATE_KEY)
    return projectId
  } catch {
    return null
  }
}

// ── Public init ───────────────────────────────────────────────────────────────

export interface DBInitResult {
  allProjects:   Project[]
  componentDefs: StoredComponentDef[]
  jumperSets:    StoredJumperSet[]
}

export async function initializeDB(): Promise<DBInitResult> {
  await openDB()

  const seededVersion = await getMeta('seededVersion') as number | undefined
  if (seededVersion !== SEED_VERSION) {
    await seedSystemDefs()
    await setMeta('seededVersion', SEED_VERSION)
  }

  // Ensure at least one project exists
  let allProjects = await loadAllProjects()
  if (allProjects.length === 0) {
    const migratedId = await migrateFromLocalStorage()
    if (!migratedId) {
      const now = Date.now()
      await saveProject({
        id: crypto.randomUUID(), name: 'Untitled',
        createdAt: now, updatedAt: now,
        placedComponents: [], wires: [], activeJumperSetId: null,
      })
    }
    allProjects = await loadAllProjects()
  }

  const componentDefs = await loadAllComponentDefs()
  const jumperSets    = await loadAllJumperSets()

  return { allProjects, componentDefs, jumperSets }
}
