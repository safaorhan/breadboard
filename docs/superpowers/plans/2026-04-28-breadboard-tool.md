# Breadboard Design Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a vanilla TypeScript + SVG web app where users place components on a virtual breadboard, draw jumper wires between holes, and see a live connection table.

**Architecture:** Single mutable `AppState` object; all render functions read from it; all interactions mutate it and call `update()`. SVG canvas with four `<g>` layers (board, wires, components, preview). Union-find over hole addresses for net analysis.

**Tech Stack:** Vanilla TypeScript, SVG, Vite, Vitest (unit tests for pure logic modules only)

---

## File Map

| File | Responsibility |
|------|---------------|
| `index.html` | Shell HTML with sidebar + canvas + table layout |
| `src/types.ts` | All shared TypeScript interfaces |
| `src/board.ts` | Layout constants, hole addressing, internal connection groups, SVG coordinate helpers |
| `src/components.ts` | `ComponentDef` data, ESP32 preset, `getComponentPinHole` helper |
| `src/state.ts` | `AppState`, all mutation functions, change listener |
| `src/nets.ts` | Union-find class, `analyzeNets` function |
| `src/render.ts` | `initSVG`, `render`, per-layer draw functions, `renderSidebar` |
| `src/drag.ts` | Drag state machine: wire drawing, component placement, component move, selection |
| `src/table.ts` | `renderTable` — DOM table from net list |
| `src/main.ts` | Entry point: wires DOM, SVG, drag, state change, form handlers |
| `src/board.test.ts` | Unit tests for board.ts |
| `src/state.test.ts` | Unit tests for state.ts |
| `src/nets.test.ts` | Unit tests for nets.ts |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "breadboard",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0",
    "jsdom": "^24.0.0",
    "@vitest/coverage-v8": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
  },
})
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: `node_modules` directory created, no errors.

- [ ] **Step 5: Create placeholder entry files so Vite can start**

Create `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Breadboard</title>
</head>
<body>
  <p>Hello</p>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

Create `src/main.ts`:
```ts
console.log('breadboard')
```

- [ ] **Step 6: Verify dev server starts**

Run: `npm run dev`

Expected: Vite prints a local URL (e.g. `http://localhost:5173`). Open it; see "Hello". Stop with Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html src/main.ts
git commit -m "chore: scaffold Vite + TypeScript + Vitest project"
```

---

## Task 2: Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create src/types.ts**

```ts
export interface PinDef {
  name: string
  col: number        // column offset from anchorCol (0-based)
  row: 'top' | 'bottom'
}

export interface ComponentDef {
  id: string
  name: string
  colSpan: number    // number of columns the component occupies
  pins: PinDef[]
}

export interface PlacedComponent {
  id: string
  defId: string
  anchorCol: number  // 1-based column of the leftmost pin
}

export interface Wire {
  id: string
  from: string       // hole address, e.g. "E5" or "top+:12"
  to: string
}

export interface AppState {
  placedComponents: PlacedComponent[]
  wires: Wire[]
  componentLibrary: ComponentDef[]
  selectedId: string | null
  selectedType: 'component' | 'wire' | null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared TypeScript interfaces"
```

---

## Task 3: Board Module (TDD)

**Files:**
- Create: `src/board.ts`
- Create: `src/board.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/board.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  holeExists,
  getHolePosition,
  getInternalGroups,
  snapToHole,
  PITCH,
  MARGIN_LEFT,
  MARGIN_TOP,
  ROW_Y_UNITS,
  BOARD_COLS,
} from './board'

describe('holeExists', () => {
  it('accepts valid main grid holes', () => {
    expect(holeExists('A1')).toBe(true)
    expect(holeExists('E63')).toBe(true)
    expect(holeExists('F1')).toBe(true)
    expect(holeExists('J63')).toBe(true)
  })

  it('accepts valid power rail holes', () => {
    expect(holeExists('top+:1')).toBe(true)
    expect(holeExists('top-:63')).toBe(true)
    expect(holeExists('bottom+:1')).toBe(true)
    expect(holeExists('bottom-:63')).toBe(true)
  })

  it('rejects out-of-range columns', () => {
    expect(holeExists('A0')).toBe(false)
    expect(holeExists('A64')).toBe(false)
    expect(holeExists('top+:0')).toBe(false)
    expect(holeExists('top+:64')).toBe(false)
  })

  it('rejects invalid row letters', () => {
    expect(holeExists('K1')).toBe(false)
    expect(holeExists('Z10')).toBe(false)
  })

  it('rejects invalid rail names', () => {
    expect(holeExists('left+:1')).toBe(false)
  })
})

describe('getHolePosition', () => {
  it('returns correct x for column 1', () => {
    const pos = getHolePosition('A1')
    expect(pos.x).toBe(MARGIN_LEFT)
  })

  it('returns correct x for column 5', () => {
    const pos = getHolePosition('A5')
    expect(pos.x).toBe(MARGIN_LEFT + 4 * PITCH)
  })

  it('returns correct y for row A', () => {
    const pos = getHolePosition('A1')
    expect(pos.y).toBe(MARGIN_TOP + ROW_Y_UNITS['A'] * PITCH)
  })

  it('returns correct y for power rail top+', () => {
    const pos = getHolePosition('top+:1')
    expect(pos.y).toBe(MARGIN_TOP + ROW_Y_UNITS['top+'] * PITCH)
  })

  it('power rail and main grid have correct col x', () => {
    const main = getHolePosition('B12')
    const rail = getHolePosition('top+:12')
    expect(main.x).toBe(rail.x)
  })
})

describe('getInternalGroups', () => {
  it('returns 63*2 + 4 groups', () => {
    const groups = getInternalGroups()
    expect(groups.length).toBe(63 * 2 + 4)
  })

  it('top half col 1 is A1-E1', () => {
    const groups = getInternalGroups()
    const col1top = groups.find(g => g.includes('A1') && g.includes('E1'))
    expect(col1top).toEqual(['A1', 'B1', 'C1', 'D1', 'E1'])
  })

  it('bottom half col 1 is F1-J1', () => {
    const groups = getInternalGroups()
    const col1bot = groups.find(g => g.includes('F1') && g.includes('J1'))
    expect(col1bot).toEqual(['F1', 'G1', 'H1', 'I1', 'J1'])
  })

  it('top+ rail contains all 63 holes', () => {
    const groups = getInternalGroups()
    const rail = groups.find(g => g.includes('top+:1') && g.includes('top+:63'))
    expect(rail).toBeDefined()
    expect(rail!.length).toBe(63)
  })
})

describe('snapToHole', () => {
  it('snaps exactly on hole A1', () => {
    const pos = getHolePosition('A1')
    expect(snapToHole(pos.x, pos.y)).toBe('A1')
  })

  it('snaps to nearest hole within PITCH/2', () => {
    const pos = getHolePosition('B5')
    expect(snapToHole(pos.x + 3, pos.y + 3)).toBe('B5')
  })

  it('returns null when too far from any hole', () => {
    // Between A and B rows vertically, off by more than PITCH/2
    const posA = getHolePosition('A1')
    const posB = getHolePosition('B1')
    const midY = (posA.y + posB.y) / 2
    expect(snapToHole(posA.x, midY)).toBe('A1') // snaps to nearest
  })

  it('returns null for x out of board range', () => {
    expect(snapToHole(-100, 50)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: All tests FAIL with "Cannot find module './board'" or similar.

- [ ] **Step 3: Implement src/board.ts**

```ts
export const SVG_NS = 'http://www.w3.org/2000/svg'
export const PITCH = 12
export const HOLE_RADIUS = 3.5
export const MARGIN_LEFT = 40
export const MARGIN_TOP = 20
export const MARGIN_RIGHT = 20
export const MARGIN_BOTTOM = 20
export const BOARD_COLS = 63

export const TOP_ROWS = ['A', 'B', 'C', 'D', 'E'] as const
export const BOTTOM_ROWS = ['F', 'G', 'H', 'I', 'J'] as const
export const ALL_ROWS = [...TOP_ROWS, ...BOTTOM_ROWS] as const
export const RAIL_NAMES = ['top+', 'top-', 'bottom+', 'bottom-'] as const

export type RowName = typeof ALL_ROWS[number]
export type RailName = typeof RAIL_NAMES[number]

// y-position in grid units (multiply by PITCH, add MARGIN_TOP to get SVG y)
export const ROW_Y_UNITS: Record<string, number> = {
  'top+':    0,
  'top-':    1,
  // gap at unit 2
  'A':       3,
  'B':       4,
  'C':       5,
  'D':       6,
  'E':       7,
  // channel gap at unit 8
  'F':       9,
  'G':      10,
  'H':      11,
  'I':      12,
  'J':      13,
  // gap at unit 14
  'bottom+': 15,
  'bottom-': 16,
}

export const SVG_WIDTH  = MARGIN_LEFT + BOARD_COLS * PITCH + MARGIN_RIGHT
export const SVG_HEIGHT = MARGIN_TOP  + 17 * PITCH + MARGIN_BOTTOM

export function holeExists(address: string): boolean {
  if (address.includes(':')) {
    const colon = address.lastIndexOf(':')
    const rail = address.slice(0, colon)
    const col  = parseInt(address.slice(colon + 1), 10)
    return (RAIL_NAMES as readonly string[]).includes(rail)
      && col >= 1 && col <= BOARD_COLS
  }
  const row = address[0]
  const col = parseInt(address.slice(1), 10)
  return (ALL_ROWS as readonly string[]).includes(row)
    && col >= 1 && col <= BOARD_COLS
}

export function getHolePosition(address: string): { x: number; y: number } {
  if (address.includes(':')) {
    const colon = address.lastIndexOf(':')
    const rail  = address.slice(0, colon)
    const col   = parseInt(address.slice(colon + 1), 10)
    return {
      x: MARGIN_LEFT + (col - 1) * PITCH,
      y: MARGIN_TOP  + ROW_Y_UNITS[rail] * PITCH,
    }
  }
  const row = address[0]
  const col = parseInt(address.slice(1), 10)
  return {
    x: MARGIN_LEFT + (col - 1) * PITCH,
    y: MARGIN_TOP  + ROW_Y_UNITS[row] * PITCH,
  }
}

export function getInternalGroups(): string[][] {
  const groups: string[][] = []

  for (let col = 1; col <= BOARD_COLS; col++) {
    groups.push(TOP_ROWS.map(r => `${r}${col}`))
    groups.push(BOTTOM_ROWS.map(r => `${r}${col}`))
  }

  for (const rail of RAIL_NAMES) {
    const holes: string[] = []
    for (let col = 1; col <= BOARD_COLS; col++) {
      holes.push(`${rail}:${col}`)
    }
    groups.push(holes)
  }

  return groups
}

export function snapToHole(svgX: number, svgY: number): string | null {
  const col = Math.round((svgX - MARGIN_LEFT) / PITCH) + 1
  if (col < 1 || col > BOARD_COLS) return null

  let bestKey: string | null = null
  let bestDist = Infinity

  for (const [key, yUnit] of Object.entries(ROW_Y_UNITS)) {
    const holeY = MARGIN_TOP + yUnit * PITCH
    const dist  = Math.abs(svgY - holeY)
    if (dist < bestDist) {
      bestDist = dist
      bestKey  = key
    }
  }

  if (!bestKey || bestDist > PITCH / 2) return null

  if ((RAIL_NAMES as readonly string[]).includes(bestKey)) {
    return `${bestKey}:${col}`
  }
  return `${bestKey}${col}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: All board tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/board.ts src/board.test.ts
git commit -m "feat: add board module with hole addressing and internal connection groups"
```

---

## Task 4: State Module (TDD)

**Files:**
- Create: `src/state.ts`
- Create: `src/state.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/state.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  state,
  placeComponent,
  removeComponent,
  addWire,
  removeWire,
  addComponentDef,
  selectItem,
  onStateChange,
  _resetStateForTest,
} from './state'
import type { ComponentDef } from './types'

const mockDef: ComponentDef = {
  id: 'test-def',
  name: 'TestChip',
  colSpan: 2,
  pins: [
    { name: 'VCC', col: 0, row: 'top' },
    { name: 'GND', col: 1, row: 'bottom' },
  ],
}

beforeEach(() => {
  _resetStateForTest([mockDef])
})

describe('placeComponent', () => {
  it('adds a placed component', () => {
    placeComponent('test-def', 5)
    expect(state.placedComponents).toHaveLength(1)
    expect(state.placedComponents[0].defId).toBe('test-def')
    expect(state.placedComponents[0].anchorCol).toBe(5)
  })

  it('does nothing for unknown defId', () => {
    placeComponent('no-such-def', 5)
    expect(state.placedComponents).toHaveLength(0)
  })

  it('assigns a unique id', () => {
    placeComponent('test-def', 1)
    placeComponent('test-def', 3)
    const ids = state.placedComponents.map(c => c.id)
    expect(new Set(ids).size).toBe(2)
  })
})

describe('removeComponent', () => {
  it('removes the component by id', () => {
    placeComponent('test-def', 5)
    const id = state.placedComponents[0].id
    removeComponent(id)
    expect(state.placedComponents).toHaveLength(0)
  })

  it('removes wires connected to its pins', () => {
    placeComponent('test-def', 5)
    const id = state.placedComponents[0].id
    // VCC pin is at E5 (col offset 0, row top → row E, col anchorCol+0=5)
    addWire('E5', 'E10')
    expect(state.wires).toHaveLength(1)
    removeComponent(id)
    expect(state.wires).toHaveLength(0)
  })
})

describe('addWire', () => {
  it('adds a wire', () => {
    addWire('A1', 'B1')
    expect(state.wires).toHaveLength(1)
    expect(state.wires[0].from).toBe('A1')
    expect(state.wires[0].to).toBe('B1')
  })

  it('ignores self-connections', () => {
    addWire('A1', 'A1')
    expect(state.wires).toHaveLength(0)
  })
})

describe('removeWire', () => {
  it('removes the wire by id', () => {
    addWire('A1', 'B1')
    const id = state.wires[0].id
    removeWire(id)
    expect(state.wires).toHaveLength(0)
  })
})

describe('addComponentDef', () => {
  it('adds to library with generated id', () => {
    const before = state.componentLibrary.length
    addComponentDef({ name: 'LED', colSpan: 1, pins: [{ name: 'A', col: 0, row: 'top' }] })
    expect(state.componentLibrary).toHaveLength(before + 1)
    const added = state.componentLibrary[state.componentLibrary.length - 1]
    expect(added.name).toBe('LED')
    expect(added.id).toBeTruthy()
  })
})

describe('selectItem', () => {
  it('sets selectedId and selectedType', () => {
    selectItem('abc', 'wire')
    expect(state.selectedId).toBe('abc')
    expect(state.selectedType).toBe('wire')
  })

  it('clears selection with null', () => {
    selectItem('abc', 'wire')
    selectItem(null, null)
    expect(state.selectedId).toBeNull()
    expect(state.selectedType).toBeNull()
  })
})

describe('onStateChange', () => {
  it('calls listener after mutation', () => {
    let calls = 0
    onStateChange(() => { calls++ })
    addWire('A1', 'B5')
    expect(calls).toBe(1)
    removeWire(state.wires[0].id)
    expect(calls).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL — "Cannot find module './state'".

- [ ] **Step 3: Implement src/state.ts**

```ts
import type { AppState, ComponentDef, PlacedComponent } from './types'
import { getComponentPinHole } from './components'
import { PRESET_LIBRARY } from './components'

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

export function placeComponent(defId: string, anchorCol: number): void {
  const def = state.componentLibrary.find(d => d.id === defId)
  if (!def) return
  const placed: PlacedComponent = {
    id: crypto.randomUUID(),
    defId,
    anchorCol,
  }
  state.placedComponents.push(placed)
  notify()
}

export function moveComponent(id: string, anchorCol: number): void {
  const comp = state.placedComponents.find(c => c.id === id)
  if (!comp) return
  comp.anchorCol = anchorCol
  notify()
}

export function removeComponent(id: string): void {
  const comp = state.placedComponents.find(c => c.id === id)
  if (!comp) return
  const def = state.componentLibrary.find(d => d.id === comp.defId)
  if (def) {
    const pinHoles = new Set(def.pins.map(p => getComponentPinHole(comp, p)))
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
```

Note: `state.ts` imports from `components.ts`. Create a stub `src/components.ts` now so the import resolves:

```ts
// src/components.ts (stub — full implementation in Task 6)
import type { ComponentDef } from './types'
import type { PlacedComponent, PinDef } from './types'

export const PRESET_LIBRARY: ComponentDef[] = []

export function getComponentPinHole(placed: PlacedComponent, pin: PinDef): string {
  const col = placed.anchorCol + pin.col
  const row = pin.row === 'top' ? 'E' : 'F'
  return `${row}${col}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: All state tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state.ts src/state.test.ts src/components.ts
git commit -m "feat: add state module with mutation functions and change listener"
```

---

## Task 5: Net Analysis (TDD)

**Files:**
- Create: `src/nets.ts`
- Create: `src/nets.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/nets.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { analyzeNets } from './nets'
import { state, _resetStateForTest, placeComponent, addWire } from './state'
import type { ComponentDef } from './types'

const chipA: ComponentDef = {
  id: 'chip-a',
  name: 'ChipA',
  colSpan: 2,
  pins: [
    { name: 'OUT', col: 0, row: 'top' },   // lands on E(anchorCol+0)
    { name: 'GND', col: 1, row: 'bottom' }, // lands on F(anchorCol+1)
  ],
}

const chipB: ComponentDef = {
  id: 'chip-b',
  name: 'ChipB',
  colSpan: 2,
  pins: [
    { name: 'IN',  col: 0, row: 'top' },
    { name: 'PWR', col: 1, row: 'bottom' },
  ],
}

beforeEach(() => {
  _resetStateForTest([chipA, chipB])
})

describe('analyzeNets', () => {
  it('returns empty array with no components', () => {
    expect(analyzeNets(state)).toEqual([])
  })

  it('returns empty array with one component and no wires', () => {
    placeComponent('chip-a', 10)
    expect(analyzeNets(state)).toEqual([])
  })

  it('connects pins in the same board column', () => {
    // ChipA at col 10: OUT at E10, GND at F11
    // ChipB at col 10: IN at E10 — same hole as ChipA OUT
    placeComponent('chip-a', 10)
    placeComponent('chip-b', 10)
    const nets = analyzeNets(state)
    // E10 is shared between ChipA.OUT and ChipB.IN
    // A10..E10 are internally connected, and F10..J10 are internally connected
    // But E10 is in the top half group with A10-E10, and E10 is ChipA.OUT and ChipB.IN
    const net = nets.find(n =>
      n.pins.some(p => p.pinName === 'OUT') &&
      n.pins.some(p => p.pinName === 'IN')
    )
    expect(net).toBeDefined()
  })

  it('connects pins joined by a wire', () => {
    placeComponent('chip-a', 5)  // OUT at E5
    placeComponent('chip-b', 20) // IN at E20
    addWire('E5', 'E20')
    const nets = analyzeNets(state)
    const net = nets.find(n =>
      n.pins.some(p => p.pinName === 'OUT') &&
      n.pins.some(p => p.pinName === 'IN')
    )
    expect(net).toBeDefined()
    expect(net!.pins).toHaveLength(2)
  })

  it('does not include nets with fewer than 2 named pins', () => {
    placeComponent('chip-a', 5) // OUT at E5, GND at F6
    // Wire within the same board-internal group — no second named pin
    addWire('A5', 'B5') // A5 and B5 are already internally connected; net has only ChipA.OUT
    const nets = analyzeNets(state)
    // OUT at E5 is in the same internal group as A5-E5, but GND is at F6
    // That net has only ChipA.OUT — should be excluded (< 2 pins)
    const outNet = nets.find(n => n.pins.some(p => p.pinName === 'OUT'))
    expect(outNet).toBeUndefined()
  })

  it('connects pins via power rail', () => {
    // Wire ChipA GND (F11) to top+ rail, and ChipB PWR (F21) to top+ rail
    placeComponent('chip-a', 10)  // GND at F11
    placeComponent('chip-b', 20)  // PWR at F21
    addWire('F11', 'top+:11')
    addWire('F21', 'top+:21')
    const nets = analyzeNets(state)
    const net = nets.find(n =>
      n.pins.some(p => p.pinName === 'GND') &&
      n.pins.some(p => p.pinName === 'PWR')
    )
    expect(net).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL — "Cannot find module './nets'".

- [ ] **Step 3: Implement src/nets.ts**

```ts
import type { AppState } from './types'
import { getInternalGroups } from './board'
import { getComponentPinHole } from './components'

export interface PinRef {
  componentId: string
  componentName: string
  pinName: string
  hole: string
}

export interface Net {
  root: string
  pins: PinRef[]
}

class UnionFind {
  private parent = new Map<string, string>()

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x)
    const p = this.parent.get(x)!
    if (p !== x) {
      const root = this.find(p)
      this.parent.set(x, root)
      return root
    }
    return x
  }

  union(x: string, y: string): void {
    const rx = this.find(x)
    const ry = this.find(y)
    if (rx !== ry) this.parent.set(rx, ry)
  }
}

export function analyzeNets(state: AppState): Net[] {
  const uf = new UnionFind()

  for (const group of getInternalGroups()) {
    for (let i = 1; i < group.length; i++) {
      uf.union(group[0], group[i])
    }
  }

  for (const wire of state.wires) {
    uf.union(wire.from, wire.to)
  }

  const netMap = new Map<string, PinRef[]>()

  for (const placed of state.placedComponents) {
    const def = state.componentLibrary.find(d => d.id === placed.defId)
    if (!def) continue
    for (const pin of def.pins) {
      const hole = getComponentPinHole(placed, pin)
      const root = uf.find(hole)
      if (!netMap.has(root)) netMap.set(root, [])
      netMap.get(root)!.push({
        componentId: placed.id,
        componentName: def.name,
        pinName: pin.name,
        hole,
      })
    }
  }

  return Array.from(netMap.entries())
    .filter(([, pins]) => pins.length >= 2)
    .map(([root, pins]) => ({ root, pins }))
}
```

- [ ] **Step 4: Run all tests to verify they pass**

Run: `npm test`

Expected: All board, state, and net tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nets.ts src/nets.test.ts
git commit -m "feat: add union-find net analysis"
```

---

## Task 6: Component Definitions

**Files:**
- Modify: `src/components.ts` (replace the stub)

- [ ] **Step 1: Replace stub with full implementation**

Overwrite `src/components.ts`:

```ts
import type { ComponentDef, PlacedComponent, PinDef } from './types'

export function getComponentPinHole(placed: PlacedComponent, pin: PinDef): string {
  const col = placed.anchorCol + pin.col
  const row = pin.row === 'top' ? 'E' : 'F'
  return `${row}${col}`
}

// ESP32-WROOM-32 DevKit v1 (30-pin, 15 per side, 15 columns wide)
// Top row (row E): left side of chip, left-to-right
// Bottom row (row F): right side of chip, left-to-right
const ESP32: ComponentDef = {
  id: 'preset-esp32',
  name: 'ESP32',
  colSpan: 15,
  pins: [
    // Top row (left side): col 0 → 14
    { name: 'GND',  col: 0,  row: 'top' },
    { name: '3V3',  col: 1,  row: 'top' },
    { name: 'EN',   col: 2,  row: 'top' },
    { name: 'VP',   col: 3,  row: 'top' },
    { name: 'VN',   col: 4,  row: 'top' },
    { name: 'D34',  col: 5,  row: 'top' },
    { name: 'D35',  col: 6,  row: 'top' },
    { name: 'D32',  col: 7,  row: 'top' },
    { name: 'D33',  col: 8,  row: 'top' },
    { name: 'D25',  col: 9,  row: 'top' },
    { name: 'D26',  col: 10, row: 'top' },
    { name: 'D27',  col: 11, row: 'top' },
    { name: 'D14',  col: 12, row: 'top' },
    { name: 'D12',  col: 13, row: 'top' },
    { name: 'D13',  col: 14, row: 'top' },
    // Bottom row (right side): col 0 → 14
    { name: 'VIN',  col: 0,  row: 'bottom' },
    { name: 'GND2', col: 1,  row: 'bottom' },
    { name: 'D23',  col: 2,  row: 'bottom' },
    { name: 'D22',  col: 3,  row: 'bottom' },
    { name: 'TX0',  col: 4,  row: 'bottom' },
    { name: 'RX0',  col: 5,  row: 'bottom' },
    { name: 'D21',  col: 6,  row: 'bottom' },
    { name: 'D19',  col: 7,  row: 'bottom' },
    { name: 'D18',  col: 8,  row: 'bottom' },
    { name: 'D5',   col: 9,  row: 'bottom' },
    { name: 'D17',  col: 10, row: 'bottom' },
    { name: 'D16',  col: 11, row: 'bottom' },
    { name: 'D4',   col: 12, row: 'bottom' },
    { name: 'D0',   col: 13, row: 'bottom' },
    { name: 'D15',  col: 14, row: 'bottom' },
  ],
}

export const PRESET_LIBRARY: ComponentDef[] = [ESP32]
```

- [ ] **Step 2: Run all tests to confirm still passing**

Run: `npm test`

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components.ts
git commit -m "feat: add ESP32 preset to component library"
```

---

## Task 7: HTML + CSS Layout

**Files:**
- Modify: `index.html`
- Create: `src/style.css`

- [ ] **Step 1: Overwrite index.html with full layout**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Breadboard</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <div id="app">
    <aside id="sidebar">
      <h2>Components</h2>
      <ul id="component-list"></ul>
      <hr />
      <h3>Custom Component</h3>
      <form id="add-component-form">
        <label>
          Name
          <input id="comp-name" type="text" placeholder="e.g. SSD1306" required />
        </label>
        <label>
          Column span
          <input id="comp-colspan" type="number" min="1" max="40" placeholder="e.g. 4" required />
        </label>
        <label>
          Pins (one per line, top row left→right then bottom row left→right)
          <textarea id="comp-pins" rows="6" placeholder="VCC&#10;GND&#10;SDA&#10;SCL"></textarea>
        </label>
        <button type="submit">Add to Library</button>
      </form>
    </aside>

    <main id="main">
      <div id="canvas-container"></div>
      <div id="table-container">
        <h3>Connections</h3>
        <div id="table-inner"></div>
      </div>
    </main>
  </div>

  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create src/style.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, sans-serif;
  font-size: 13px;
  background: #1a1a1a;
  color: #e0e0e0;
  height: 100vh;
  overflow: hidden;
}

#app {
  display: flex;
  height: 100vh;
}

#sidebar {
  width: 200px;
  min-width: 200px;
  background: #242424;
  border-right: 1px solid #333;
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

#sidebar h2 { font-size: 14px; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; }
#sidebar h3 { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }

#component-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

#component-list li {
  padding: 6px 8px;
  background: #333;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
}

#component-list li:hover { background: #444; }
#component-list li.active { background: #2a5a8a; }

#add-component-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

#add-component-form label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: #999;
}

#add-component-form input,
#add-component-form textarea {
  background: #1a1a1a;
  border: 1px solid #444;
  color: #e0e0e0;
  border-radius: 3px;
  padding: 4px 6px;
  font-size: 12px;
  font-family: inherit;
}

#add-component-form button {
  background: #2a5a8a;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px;
  cursor: pointer;
  font-size: 12px;
}

#add-component-form button:hover { background: #3a6a9a; }

#main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 16px;
  gap: 16px;
}

#canvas-container svg {
  display: block;
  cursor: crosshair;
}

#canvas-container svg.placing { cursor: cell; }

#table-container h3 {
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

#table-inner table {
  border-collapse: collapse;
  font-size: 12px;
  width: 100%;
}

#table-inner th, #table-inner td {
  border: 1px solid #333;
  padding: 4px 8px;
  text-align: left;
}

#table-inner th { background: #2a2a2a; color: #aaa; }
#table-inner tr:nth-child(even) { background: #1e1e1e; }

/* SVG styles */
.hole { fill: #1a1a1a; stroke: #555; stroke-width: 0.5; cursor: crosshair; }
.hole:hover { stroke: #88aaff; stroke-width: 1.5; }
.hole.occupied { fill: #2a2a2a; }
.power-hole { fill: #1a1a1a; stroke: #666; stroke-width: 0.5; }
.top-plus-hole  { stroke: #cc3333; }
.top-minus-hole { stroke: #4444cc; }
.bottom-plus-hole  { stroke: #cc3333; }
.bottom-minus-hole { stroke: #4444cc; }

.component-body {
  fill: #2d4a2d;
  stroke: #4a7a4a;
  stroke-width: 1;
  cursor: move;
}
.component-body.selected { stroke: #88ffaa; stroke-width: 2; }
.component-body:hover { stroke: #6aaa6a; }

.component-label { fill: #88ff88; font-size: 8px; font-family: monospace; pointer-events: none; }
.pin-label { fill: #aaffaa; font-size: 6px; font-family: monospace; pointer-events: none; }
.pin-hole { fill: #888; stroke: none; pointer-events: all; cursor: crosshair; }
.pin-hole:hover { fill: #88aaff; }

.wire { stroke: #4488ff; stroke-width: 1.5; stroke-linecap: round; cursor: pointer; }
.wire:hover { stroke: #88aaff; stroke-width: 2; }
.wire.selected { stroke: #ffaa44; stroke-width: 2; }

.preview-wire { stroke: #88aaff; stroke-width: 1.5; stroke-dasharray: 4 3; pointer-events: none; }
.ghost-body { fill: #2d4a2d; stroke: #88ffaa; stroke-width: 1; opacity: 0.6; pointer-events: none; }

.board-bg-top    { fill: #1e2e1e; }
.board-bg-bottom { fill: #1e2e1e; }
.rail-bg-plus    { fill: #2a1a1a; }
.rail-bg-minus   { fill: #1a1a2a; }

.col-label, .row-label { fill: #555; font-size: 7px; font-family: monospace; user-select: none; pointer-events: none; }
```

- [ ] **Step 3: Commit**

```bash
git add index.html src/style.css
git commit -m "feat: add HTML layout and CSS styles"
```

---

## Task 8: Render — Board Layer

**Files:**
- Create: `src/render.ts`
- Modify: `src/main.ts` (stub update)

- [ ] **Step 1: Create src/render.ts with board layer**

```ts
import type { AppState, ComponentDef, PlacedComponent } from './types'
import {
  SVG_NS, PITCH, HOLE_RADIUS, MARGIN_LEFT, MARGIN_TOP,
  BOARD_COLS, TOP_ROWS, BOTTOM_ROWS, RAIL_NAMES,
  ROW_Y_UNITS, SVG_WIDTH, SVG_HEIGHT, getHolePosition,
} from './board'
import { getComponentPinHole } from './components'

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K]
}

function getLayer(svg: SVGSVGElement, id: string): SVGGElement {
  return svg.querySelector(`#${id}`) as SVGGElement
}

export function clearLayer(svg: SVGSVGElement, id: string): void {
  const layer = getLayer(svg, id)
  while (layer.firstChild) layer.removeChild(layer.firstChild)
}

export function initSVG(container: HTMLElement): SVGSVGElement {
  const svg = svgEl('svg')
  svg.setAttribute('width', String(SVG_WIDTH))
  svg.setAttribute('height', String(SVG_HEIGHT))
  svg.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`)

  for (const id of ['board-layer', 'wire-layer', 'component-layer', 'preview-layer']) {
    const g = svgEl('g')
    g.id = id
    svg.appendChild(g)
  }

  container.appendChild(svg)
  return svg
}

export function render(svg: SVGSVGElement, state: AppState): void {
  clearLayer(svg, 'board-layer')
  clearLayer(svg, 'wire-layer')
  clearLayer(svg, 'component-layer')
  renderBoardLayer(svg, state)
  renderWireLayer(svg, state)
  renderComponentLayer(svg, state)
}

function renderBoardLayer(svg: SVGSVGElement, state: AppState): void {
  const layer = getLayer(svg, 'board-layer')
  const occupiedHoles = getOccupiedHoles(state)

  // Rail backgrounds
  const railConfigs = [
    { rail: 'top+',    cls: 'rail-bg-plus'  },
    { rail: 'top-',    cls: 'rail-bg-minus' },
    { rail: 'bottom+', cls: 'rail-bg-plus'  },
    { rail: 'bottom-', cls: 'rail-bg-minus' },
  ]
  for (const { rail, cls } of railConfigs) {
    const y = MARGIN_TOP + ROW_Y_UNITS[rail] * PITCH
    const rect = svgEl('rect')
    rect.setAttribute('x', String(MARGIN_LEFT - 4))
    rect.setAttribute('y', String(y - HOLE_RADIUS - 2))
    rect.setAttribute('width', String(BOARD_COLS * PITCH + 4))
    rect.setAttribute('height', String(HOLE_RADIUS * 2 + 4))
    rect.setAttribute('rx', '3')
    rect.setAttribute('class', cls)
    layer.appendChild(rect)
  }

  // Main grid backgrounds
  const topY    = MARGIN_TOP + ROW_Y_UNITS['A'] * PITCH
  const topH    = 5 * PITCH
  const bottomY = MARGIN_TOP + ROW_Y_UNITS['F'] * PITCH
  const bottomH = 5 * PITCH

  for (const [y, h, cls] of [
    [topY - HOLE_RADIUS - 2, topH + HOLE_RADIUS * 2, 'board-bg-top'],
    [bottomY - HOLE_RADIUS - 2, bottomH + HOLE_RADIUS * 2, 'board-bg-bottom'],
  ] as [number, number, string][]) {
    const rect = svgEl('rect')
    rect.setAttribute('x', String(MARGIN_LEFT - 4))
    rect.setAttribute('y', String(y))
    rect.setAttribute('width', String(BOARD_COLS * PITCH + 4))
    rect.setAttribute('height', String(h))
    rect.setAttribute('class', cls)
    layer.appendChild(rect)
  }

  // Power rail holes
  const railHoleCls: Record<string, string> = {
    'top+':    'power-hole top-plus-hole',
    'top-':    'power-hole top-minus-hole',
    'bottom+': 'power-hole bottom-plus-hole',
    'bottom-': 'power-hole bottom-minus-hole',
  }
  for (const rail of RAIL_NAMES) {
    for (let col = 1; col <= BOARD_COLS; col++) {
      const addr = `${rail}:${col}`
      const { x, y } = getHolePosition(addr)
      const circle = svgEl('circle')
      circle.setAttribute('cx', String(x))
      circle.setAttribute('cy', String(y))
      circle.setAttribute('r',  String(HOLE_RADIUS))
      circle.setAttribute('class', railHoleCls[rail])
      circle.dataset.hole = addr
      layer.appendChild(circle)
    }
  }

  // Main grid holes
  const allRows = [...TOP_ROWS, ...BOTTOM_ROWS]
  for (const row of allRows) {
    for (let col = 1; col <= BOARD_COLS; col++) {
      const addr = `${row}${col}`
      const { x, y } = getHolePosition(addr)
      const circle = svgEl('circle')
      circle.setAttribute('cx', String(x))
      circle.setAttribute('cy', String(y))
      circle.setAttribute('r',  String(HOLE_RADIUS))
      circle.setAttribute('class', occupiedHoles.has(addr) ? 'hole occupied' : 'hole')
      circle.dataset.hole = addr
      layer.appendChild(circle)
    }
  }

  // Column labels every 5 columns
  for (let col = 5; col <= BOARD_COLS; col += 5) {
    const x = MARGIN_LEFT + (col - 1) * PITCH
    const label = svgEl('text')
    label.setAttribute('x', String(x))
    label.setAttribute('y', String(MARGIN_TOP - 6))
    label.setAttribute('text-anchor', 'middle')
    label.setAttribute('class', 'col-label')
    label.textContent = String(col)
    layer.appendChild(label)
  }

  // Row labels
  for (const row of allRows) {
    const { y } = getHolePosition(`${row}1`)
    const label = svgEl('text')
    label.setAttribute('x', String(MARGIN_LEFT - 8))
    label.setAttribute('y', String(y + 3))
    label.setAttribute('text-anchor', 'end')
    label.setAttribute('class', 'row-label')
    label.textContent = row
    layer.appendChild(label)
  }
}

function getOccupiedHoles(state: AppState): Set<string> {
  const occupied = new Set<string>()
  for (const placed of state.placedComponents) {
    const def = state.componentLibrary.find(d => d.id === placed.defId)
    if (!def) continue
    for (const pin of def.pins) {
      occupied.add(getComponentPinHole(placed, pin))
    }
  }
  return occupied
}

function renderWireLayer(svg: SVGSVGElement, _state: AppState): void {
  // Implemented in Task 9
}

function renderComponentLayer(svg: SVGSVGElement, _state: AppState): void {
  // Implemented in Task 9
}

export function renderSidebar(list: HTMLElement, library: ComponentDef[]): void {
  list.innerHTML = ''
  for (const def of library) {
    const li = document.createElement('li')
    li.textContent = def.name
    li.dataset.defId = def.id
    list.appendChild(li)
  }
}
```

- [ ] **Step 2: Update src/main.ts to show the board**

```ts
import { state, onStateChange } from './state'
import { initSVG, render, renderSidebar } from './render'
import { analyzeNets } from './nets'
import { renderTable } from './table'

const canvasContainer = document.getElementById('canvas-container') as HTMLDivElement
const tableInner      = document.getElementById('table-inner')      as HTMLDivElement
const sidebarList     = document.getElementById('component-list')   as HTMLUListElement

const svg = initSVG(canvasContainer)

function update(): void {
  render(svg, state)
  renderSidebar(sidebarList, state.componentLibrary)
  renderTable(tableInner, analyzeNets(state))
}

onStateChange(update)
update()
```

- [ ] **Step 3: Create stub src/table.ts so the import resolves**

```ts
import type { Net } from './nets'

export function renderTable(container: HTMLElement, _nets: Net[]): void {
  container.innerHTML = '<p style="color:#666;font-size:12px">No connections yet.</p>'
}
```

- [ ] **Step 4: Run dev server and verify board renders**

Run: `npm run dev`

Open `http://localhost:5173`. Expected: Dark background, breadboard grid visible with holes, row labels (A–J), column labels (5, 10, …), colored power rail strips. Stop server.

- [ ] **Step 5: Commit**

```bash
git add src/render.ts src/table.ts src/main.ts
git commit -m "feat: render board layer with holes, rails, and labels"
```

---

## Task 9: Render — Component + Wire Layers

**Files:**
- Modify: `src/render.ts`

- [ ] **Step 1: Replace stub renderWireLayer and renderComponentLayer**

In `src/render.ts`, replace the two stub functions:

```ts
function renderWireLayer(svg: SVGSVGElement, state: AppState): void {
  const layer = getLayer(svg, 'wire-layer')
  for (const wire of state.wires) {
    const from = getHolePosition(wire.from)
    const to   = getHolePosition(wire.to)
    const line = svgEl('line')
    line.setAttribute('x1', String(from.x))
    line.setAttribute('y1', String(from.y))
    line.setAttribute('x2', String(to.x))
    line.setAttribute('y2', String(to.y))
    line.setAttribute('class', wire.id === state.selectedId ? 'wire selected' : 'wire')
    line.dataset.wireId = wire.id
    layer.appendChild(line)
  }
}

function renderComponentLayer(svg: SVGSVGElement, state: AppState): void {
  const layer = getLayer(svg, 'component-layer')
  for (const placed of state.placedComponents) {
    const def = state.componentLibrary.find(d => d.id === placed.defId)
    if (!def) continue
    renderPlacedComponent(layer, placed, def, state.selectedId)
  }
}

function renderPlacedComponent(
  layer: SVGGElement,
  placed: PlacedComponent,
  def: ComponentDef,
  selectedId: string | null,
): void {
  const topPos    = getHolePosition(`E${placed.anchorCol}`)
  const bottomPos = getHolePosition(`F${placed.anchorCol + def.colSpan - 1}`)

  const x = topPos.x - HOLE_RADIUS - 1
  const y = topPos.y - HOLE_RADIUS - 1
  const w = def.colSpan * PITCH + HOLE_RADIUS * 2 + 2
  const h = (bottomPos.y - topPos.y) + HOLE_RADIUS * 2 + 2

  const g = svgEl('g')
  g.dataset.componentId = placed.id

  const body = svgEl('rect')
  body.setAttribute('x', String(x))
  body.setAttribute('y', String(y))
  body.setAttribute('width', String(w))
  body.setAttribute('height', String(h))
  body.setAttribute('class', placed.id === selectedId ? 'component-body selected' : 'component-body')
  body.dataset.componentId = placed.id
  g.appendChild(body)

  // Component name label
  const nameLabel = svgEl('text')
  nameLabel.setAttribute('x', String(x + w / 2))
  nameLabel.setAttribute('y', String(y + h / 2 + 3))
  nameLabel.setAttribute('text-anchor', 'middle')
  nameLabel.setAttribute('class', 'component-label')
  nameLabel.textContent = def.name
  g.appendChild(nameLabel)

  // Pin holes and labels
  for (const pin of def.pins) {
    const addr       = getComponentPinHole(placed, pin)
    const { x: px, y: py } = getHolePosition(addr)

    const circle = svgEl('circle')
    circle.setAttribute('cx', String(px))
    circle.setAttribute('cy', String(py))
    circle.setAttribute('r',  String(HOLE_RADIUS))
    circle.setAttribute('class', 'pin-hole')
    circle.dataset.hole = addr
    g.appendChild(circle)

    const labelY = pin.row === 'top'
      ? py - HOLE_RADIUS - 2
      : py + HOLE_RADIUS + 7

    const label = svgEl('text')
    label.setAttribute('x', String(px))
    label.setAttribute('y', String(labelY))
    label.setAttribute('text-anchor', 'middle')
    label.setAttribute('class', 'pin-label')
    label.textContent = pin.name
    g.appendChild(label)
  }

  layer.appendChild(g)
}
```

Also add `renderGhostComponent` and `renderPreviewWire` exports used by `drag.ts` in later tasks:

```ts
export function renderGhostComponent(svg: SVGSVGElement, def: ComponentDef, anchorCol: number): void {
  clearLayer(svg, 'preview-layer')
  const layer = getLayer(svg, 'preview-layer')

  const topPos    = getHolePosition(`E${anchorCol}`)
  const bottomPos = getHolePosition(`F${anchorCol + def.colSpan - 1}`)

  const x = topPos.x - HOLE_RADIUS - 1
  const y = topPos.y - HOLE_RADIUS - 1
  const w = def.colSpan * PITCH + HOLE_RADIUS * 2 + 2
  const h = (bottomPos.y - topPos.y) + HOLE_RADIUS * 2 + 2

  const rect = svgEl('rect')
  rect.setAttribute('x', String(x))
  rect.setAttribute('y', String(y))
  rect.setAttribute('width', String(w))
  rect.setAttribute('height', String(h))
  rect.setAttribute('class', 'ghost-body')
  layer.appendChild(rect)
}

export function renderPreviewWire(svg: SVGSVGElement, fromHole: string, toX: number, toY: number): void {
  clearLayer(svg, 'preview-layer')
  const layer  = getLayer(svg, 'preview-layer')
  const from   = getHolePosition(fromHole)
  const line   = svgEl('line')
  line.setAttribute('x1', String(from.x))
  line.setAttribute('y1', String(from.y))
  line.setAttribute('x2', String(toX))
  line.setAttribute('y2', String(toY))
  line.setAttribute('class', 'preview-wire')
  layer.appendChild(line)
}
```

- [ ] **Step 2: Run dev server and verify**

Run: `npm run dev`

Open `http://localhost:5173`. Manually test by temporarily adding to `main.ts` (after `update()`):

```ts
import { placeComponent } from './state'
placeComponent('preset-esp32', 5)
```

Expected: ESP32 component visible on the board with green body, pin holes, pin name labels. Remove the test line after verifying.

- [ ] **Step 3: Commit**

```bash
git add src/render.ts
git commit -m "feat: render component bodies, pin holes, and wires"
```

---

## Task 10: Drag — Wire Drawing

**Files:**
- Create: `src/drag.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create src/drag.ts**

```ts
import {
  state,
  addWire, removeWire,
  placeComponent, moveComponent, removeComponent,
  selectItem,
} from './state'
import { snapToHole, getHolePosition, BOARD_COLS, PITCH, MARGIN_LEFT } from './board'
import { clearLayer, renderGhostComponent, renderPreviewWire } from './render'

type DragMode =
  | { mode: 'idle' }
  | { mode: 'wiring';   fromHole: string }
  | { mode: 'placing';  defId: string }
  | { mode: 'moving';   componentId: string; startAnchorCol: number }

let svg: SVGSVGElement
let dragMode: DragMode = { mode: 'idle' }

export function initDrag(svgEl: SVGSVGElement): void {
  svg = svgEl
  svg.addEventListener('mousedown',  onMouseDown)
  svg.addEventListener('mousemove',  onMouseMove)
  svg.addEventListener('mouseup',    onMouseUp)
  svg.addEventListener('click',      onSVGClick)
  svg.addEventListener('contextmenu', e => { e.preventDefault(); cancelCurrentDrag() })
}

export function startPlacement(defId: string): void {
  selectItem(null, null)
  dragMode = { mode: 'placing', defId }
  svg.classList.add('placing')
}

export function cancelCurrentDrag(): void {
  dragMode = { mode: 'idle' }
  clearLayer(svg, 'preview-layer')
  svg.classList.remove('placing')
}

export function deleteSelected(): void {
  if (!state.selectedId) return
  if (state.selectedType === 'component') removeComponent(state.selectedId)
  else if (state.selectedType === 'wire')  removeWire(state.selectedId)
  selectItem(null, null)
}

function getSVGPoint(e: MouseEvent): { x: number; y: number } {
  const rect = svg.getBoundingClientRect()
  const scaleX = parseFloat(svg.getAttribute('width')  ?? '1') / rect.width
  const scaleY = parseFloat(svg.getAttribute('height') ?? '1') / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top)  * scaleY,
  }
}

function onMouseDown(e: MouseEvent): void {
  if (e.button !== 0) return

  const target = e.target as SVGElement

  // Start wire drawing from any hole
  if (target.dataset.hole) {
    e.stopPropagation()
    dragMode = { mode: 'wiring', fromHole: target.dataset.hole }
    return
  }

  // Start component move from component body
  if (target.dataset.componentId && dragMode.mode === 'idle') {
    e.stopPropagation()
    const comp = state.placedComponents.find(c => c.id === target.dataset.componentId)
    if (comp) {
      selectItem(comp.id, 'component')
      dragMode = { mode: 'moving', componentId: comp.id, startAnchorCol: comp.anchorCol }
    }
  }
}

function onMouseMove(e: MouseEvent): void {
  const { x, y } = getSVGPoint(e)

  if (dragMode.mode === 'wiring') {
    renderPreviewWire(svg, dragMode.fromHole, x, y)
    return
  }

  if (dragMode.mode === 'placing') {
    const def = state.componentLibrary.find(d => d.id === (dragMode as { defId: string }).defId)
    if (!def) return
    const raw = Math.round((x - MARGIN_LEFT) / PITCH) + 1
    const anchorCol = Math.max(1, Math.min(raw, BOARD_COLS - def.colSpan + 1))
    renderGhostComponent(svg, def, anchorCol)
    return
  }

  if (dragMode.mode === 'moving') {
    const dm = dragMode as { mode: 'moving'; componentId: string; startAnchorCol: number }
    const comp = state.placedComponents.find(c => c.id === dm.componentId)
    if (!comp) return
    const def = state.componentLibrary.find(d => d.id === comp.defId)
    if (!def) return
    const raw = Math.round((x - MARGIN_LEFT) / PITCH) + 1
    const anchorCol = Math.max(1, Math.min(raw, BOARD_COLS - def.colSpan + 1))
    renderGhostComponent(svg, def, anchorCol)
  }
}

function onMouseUp(e: MouseEvent): void {
  if (dragMode.mode === 'wiring') {
    const { x, y } = getSVGPoint(e)
    const toHole = snapToHole(x, y)
    if (toHole && toHole !== dragMode.fromHole) {
      addWire(dragMode.fromHole, toHole)
    }
    dragMode = { mode: 'idle' }
    clearLayer(svg, 'preview-layer')
    return
  }

  if (dragMode.mode === 'moving') {
    const dm = dragMode as { mode: 'moving'; componentId: string }
    const { x } = getSVGPoint(e)
    const comp = state.placedComponents.find(c => c.id === dm.componentId)
    if (comp) {
      const def = state.componentLibrary.find(d => d.id === comp.defId)
      if (def) {
        const raw = Math.round((x - MARGIN_LEFT) / PITCH) + 1
        const anchorCol = Math.max(1, Math.min(raw, BOARD_COLS - def.colSpan + 1))
        moveComponent(dm.componentId, anchorCol)
      }
    }
    dragMode = { mode: 'idle' }
    clearLayer(svg, 'preview-layer')
  }
}

function onSVGClick(e: MouseEvent): void {
  const target = e.target as SVGElement

  // Select a wire
  if (target.dataset.wireId) {
    selectItem(target.dataset.wireId, 'wire')
    return
  }

  // Select or deselect component
  if (target.dataset.componentId) {
    selectItem(target.dataset.componentId, 'component')
    return
  }

  // Complete component placement
  if (dragMode.mode === 'placing') {
    const dm = dragMode as { mode: 'placing'; defId: string }
    const def = state.componentLibrary.find(d => d.id === dm.defId)
    if (!def) return
    const { x } = getSVGPoint(e)
    const raw = Math.round((x - MARGIN_LEFT) / PITCH) + 1
    const anchorCol = Math.max(1, Math.min(raw, BOARD_COLS - def.colSpan + 1))
    placeComponent(dm.defId, anchorCol)
    dragMode = { mode: 'idle' }
    clearLayer(svg, 'preview-layer')
    svg.classList.remove('placing')
    return
  }

  // Click on empty space deselects
  if (!target.dataset.hole && !target.dataset.wireId && !target.dataset.componentId) {
    selectItem(null, null)
  }
}
```

- [ ] **Step 2: Wire drag into main.ts**

Update `src/main.ts`:

```ts
import { state, onStateChange } from './state'
import { initSVG, render, renderSidebar } from './render'
import { initDrag, startPlacement, cancelCurrentDrag, deleteSelected } from './drag'
import { analyzeNets } from './nets'
import { renderTable } from './table'

const canvasContainer = document.getElementById('canvas-container') as HTMLDivElement
const tableInner      = document.getElementById('table-inner')      as HTMLDivElement
const sidebarList     = document.getElementById('component-list')   as HTMLUListElement

const svg = initSVG(canvasContainer)
initDrag(svg)

function update(): void {
  render(svg, state)
  renderSidebar(sidebarList, state.componentLibrary)
  renderTable(tableInner, analyzeNets(state))
}

onStateChange(update)
update()

sidebarList.addEventListener('click', (e) => {
  const li = (e.target as HTMLElement).closest('[data-def-id]') as HTMLElement | null
  if (!li) return
  document.querySelectorAll('#component-list li').forEach(el => el.classList.remove('active'))
  li.classList.add('active')
  startPlacement(li.dataset.defId!)
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape')                          cancelCurrentDrag()
  if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
})
```

- [ ] **Step 3: Test wire drawing manually**

Run: `npm run dev`

1. Open `http://localhost:5173`
2. Temporarily add `placeComponent('preset-esp32', 5)` to `main.ts` after `update()`, save, and reload
3. Press and drag from one pin hole to another — a dashed blue line should follow the cursor
4. Release on a hole — a solid blue wire should appear
5. Click the wire — it turns orange (selected)
6. Press Delete — wire is removed
7. Remove the test `placeComponent` call

- [ ] **Step 4: Commit**

```bash
git add src/drag.ts src/main.ts
git commit -m "feat: wire drawing, component move, selection and deletion interactions"
```

---

## Task 11: Component Placement Interaction

This is already implemented in `drag.ts` via `startPlacement` and `onSVGClick`. This task verifies it works end-to-end.

- [ ] **Step 1: Test component placement manually**

Run: `npm run dev`

1. Open `http://localhost:5173`
2. Click "ESP32" in the sidebar — cursor should change to `cell`
3. Hover over the board — a ghost (transparent) ESP32 component should follow the cursor, snapping to columns
4. Click to place — the component appears on the board
5. Right-click or press Escape while placing — ghost disappears, placement cancelled
6. Place a component, click on it — it highlights (selected)
7. Press Delete — component removed
8. Drag a placed component to a new column — it moves

- [ ] **Step 2: Commit**

```bash
git commit --allow-empty -m "test: verify component placement interaction manually"
```

---

## Task 12: Connection Table

**Files:**
- Modify: `src/table.ts`

- [ ] **Step 1: Replace stub with full implementation**

Overwrite `src/table.ts`:

```ts
import type { Net } from './nets'

export function renderTable(container: HTMLElement, nets: Net[]): void {
  container.innerHTML = ''

  if (nets.length === 0) {
    container.innerHTML = '<p style="color:#555;font-size:12px">No connections yet.</p>'
    return
  }

  const table = document.createElement('table')
  const thead = table.createTHead()
  const headerRow = thead.insertRow()
  headerRow.innerHTML = '<th>Net</th><th>Connected Pins</th>'

  const tbody = table.createTBody()
  nets.forEach((net, i) => {
    const row  = tbody.insertRow()
    const pins = net.pins.map(p => `${p.componentName}.${p.pinName}`).join(', ')
    const netCell = row.insertCell()
    netCell.textContent = `Net ${i + 1}`
    const pinsCell = row.insertCell()
    pinsCell.textContent = pins
  })

  container.appendChild(table)
}
```

- [ ] **Step 2: Test connection table manually**

Run: `npm run dev`

1. Place two ESP32 components such that some pins share a column (e.g., both at col 5 — GND at E5 overlaps)
2. Expected: "Connections" section shows a table row with both component pins listed
3. Draw a wire between a pin of one component and a pin of the other
4. Expected: Net table updates immediately with the connected pins

- [ ] **Step 3: Run all unit tests**

Run: `npm test`

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/table.ts
git commit -m "feat: live connection table from net analysis"
```

---

## Task 13: Custom Component Form

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add form handler to main.ts**

First, update the state import at the top of `src/main.ts` to add `addComponentDef`:

```ts
import { state, onStateChange, addComponentDef } from './state'
```

Then add the following to `src/main.ts` (after the `keydown` listener):

```ts
const form        = document.getElementById('add-component-form') as HTMLFormElement
const nameInput   = document.getElementById('comp-name')          as HTMLInputElement
const colSpanInput = document.getElementById('comp-colspan')      as HTMLInputElement
const pinsInput   = document.getElementById('comp-pins')          as HTMLTextAreaElement

form.addEventListener('submit', (e) => {
  e.preventDefault()

  const name     = nameInput.value.trim()
  const colSpan  = parseInt(colSpanInput.value, 10)
  const pinNames = pinsInput.value
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  if (!name || isNaN(colSpan) || colSpan < 1) return

  const topCount    = Math.ceil(pinNames.length / 2)
  const bottomCount = Math.floor(pinNames.length / 2)

  const pins = [
    ...pinNames.slice(0, topCount).map((pname, i) => ({
      name: pname, col: i, row: 'top' as const,
    })),
    ...pinNames.slice(topCount, topCount + bottomCount).map((pname, i) => ({
      name: pname, col: i, row: 'bottom' as const,
    })),
  ]

  addComponentDef({ name, colSpan, pins })

  // Reset form
  nameInput.value    = ''
  colSpanInput.value = ''
  pinsInput.value    = ''
})
```

- [ ] **Step 2: Test custom component form manually**

Run: `npm run dev`

1. Fill in name: `SSD1306`, column span: `4`, pins (one per line): `VCC`, `GND`, `SCL`, `SDA`
2. Click "Add to Library" — "SSD1306" appears in the component list
3. Click it, place on the board — component renders with 2 top pins and 2 bottom pins
4. Draw a wire from SSD1306.GND to ESP32.GND — both appear in the connection table

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: custom component form — add user-defined components to library"
```

---

## Task 14: Run All Tests + Final Verification

- [ ] **Step 1: Run all unit tests**

Run: `npm test`

Expected output:
```
✓ src/board.test.ts (N tests)
✓ src/state.test.ts (N tests)
✓ src/nets.test.ts (N tests)

Test Files: 3 passed (3)
Tests: N passed (N)
```

All tests must PASS before proceeding.

- [ ] **Step 2: Full manual test of the golden path**

Run: `npm run dev`, open `http://localhost:5173`.

1. Click ESP32 in the sidebar, place it on the board at column 10
2. Add a custom component: name=Resistor, colSpan=2, pins: pin1 / pin2
3. Place two Resistors on the board
4. Draw a wire from ESP32.D5 to Resistor1.pin1
5. Draw a wire from Resistor1.pin2 to Resistor2.pin1
6. Draw a wire from Resistor2.pin2 to ESP32.GND
7. Expected: Connection table shows at least 4 nets including the resistor chain
8. Click a wire and press Delete — wire removed, table updates
9. Click a component and press Delete — component and its wires removed, table updates
10. Click ESP32 in sidebar again, press Escape during placement — ghost disappears, nothing placed

- [ ] **Step 3: Build to verify no TypeScript errors**

Run: `npm run build`

Expected: Build completes without errors. `dist/` directory created.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete breadboard design tool v1"
```
