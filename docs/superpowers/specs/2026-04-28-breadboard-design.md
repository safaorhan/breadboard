# Breadboard Design Tool — Spec

**Date:** 2026-04-28  
**Stack:** Vanilla TypeScript + SVG, served by Vite  
**Scope:** V1 — connectivity planning only, no simulation, no auth, no persistence

---

## Overview

A web app that lets users lay out hobby electronics prototypes on a virtual breadboard. Users place components, draw jumper wires between holes, and the app derives and displays the resulting net connections in a table. No electrical simulation — connectivity analysis only.

---

## Data Model

### Board

Hardcoded to a standard 830-point breadboard:
- **Main grid:** 63 columns × 10 rows, split into two halves by a center channel
  - Top half: rows A–E
  - Bottom half: rows F–J
- **Power rails:** 4 rails (top +, top −, bottom +, bottom −), each 63 holes wide

Board structure is configurable (column count, row count) but defaults to 63×10.

Each **hole** has a unique address:
- Main grid: `"B12"`, `"F5"` (row letter + column number)
- Power rails: `"top+:5"`, `"bottom-:40"`

**Internal connections** (board-level nets, before any wires):
- All holes in the same column and same half are connected: A1–E1 form one net, F1–J1 form another
- Each power rail is one continuous net: all `top+` holes are connected, etc.

### Component

```ts
interface ComponentDef {
  id: string
  name: string
  colSpan: number        // width in grid columns
  pins: PinDef[]
}

interface PinDef {
  name: string           // e.g. "GND", "RST", "3V3"
  col: number            // column offset from anchor (0-based)
  row: 'top' | 'bottom' // which row of the DIP footprint
}

interface PlacedComponent {
  id: string
  defId: string
  anchorCol: number      // 1-based column of leftmost top pin
}
```

Pins occupy holes in the main grid. Top pins land on row E (bottom of the top half), bottom pins on row F (top of the bottom half), bridging the center channel — standard DIP placement.

**Preset library** ships with at minimum: ESP32 (38-pin, 19 columns wide).

**User-defined components** are created via a form: name, column span, and a list of pin names assigned left-to-right, top row then bottom row.

### Wire

```ts
interface Wire {
  id: string
  from: string    // hole address
  to: string      // hole address
}
```

### App State

```ts
interface AppState {
  placedComponents: PlacedComponent[]
  wires: Wire[]
  componentLibrary: ComponentDef[]
}
```

Single mutable state object. All render functions read from it; all interactions mutate it and trigger a re-render.

---

## Net Analysis

Implemented as **union-find** over all hole addresses:

1. Initialize: union all holes that are internally connected on the board (column groups + power rails)
2. For each wire, union the two hole addresses
3. For each placed component pin, record which hole it occupies
4. Group component pins by their root in the union-find — each group is a net

The connection table shows one row per net containing 2+ named pins. Columns: net index, connected pins (formatted as `ComponentName.PinName`).

---

## File Structure

```
breadboard/
├── index.html
├── src/
│   ├── main.ts          # Entry point — initialises app, wires up UI events
│   ├── board.ts         # Board definition, hole addressing, internal net groups
│   ├── components.ts    # ComponentDef type, preset library, user-defined component logic
│   ├── state.ts         # AppState, mutation functions (placeComponent, removeComponent, addWire, removeWire)
│   ├── render.ts        # Full SVG re-render from state
│   ├── drag.ts          # Drag-to-wire and drag-to-place interaction handlers
│   ├── nets.ts          # Union-find net analysis
│   └── table.ts         # Connection table DOM rendering
├── package.json
└── vite.config.ts
```

---

## Rendering

SVG canvas with a fixed hole pitch (8px per grid cell). Four layers, bottom to top:

1. **Board layer** — background rects for main grid halves and power rails; row/column labels
2. **Wire layer** — `<line>` per wire; all wires render in a neutral color (e.g. dark blue) in v1; color-coding by net type is a future enhancement
3. **Component layer** — `<rect>` per component body; `<circle>` per pin; pin name labels; body colored by type. Body structure leaves room for a future `<image>` overlay for photos.
4. **Drag preview layer** — in-progress wire line and component ghost (always on top, removed on commit/cancel)

Hole coordinates are purely `col * PITCH` and `row * PITCH` — no freeform positioning.

---

## Interactions

### Placing a Component
- Sidebar lists all components (presets + user-defined)
- Click a component → it attaches to cursor as a ghost preview snapping to columns
- Click to place; Escape or right-click to cancel
- Placed components: drag to reposition, Delete/Backspace to remove while selected

### Drawing a Wire
- Press and drag from any hole → live preview line follows cursor
- Release over a valid hole → wire committed
- Release elsewhere → cancelled
- Click a wire to select it; Delete/Backspace removes it

### Adding a Custom Component
- Form in sidebar: name, column span, pin names (comma-separated or one per line, left-to-right top then bottom)
- Submit adds to the library; component is immediately available for placement

### Connection Table
- Rendered below or beside the SVG canvas
- Updates live on every state change
- One row per net with 2+ named pins; lists all `ComponentName.PinName` entries in that net
- Nets with no named pins (bare wire loops) are omitted

---

## Non-Goals (V1)

- No auth, no persistence, no import/export
- No electrical simulation
- No component images (architecture supports adding them later)
- No undo/redo
- No multi-board support
- No zoom/pan (fixed pitch, board fits in viewport)
