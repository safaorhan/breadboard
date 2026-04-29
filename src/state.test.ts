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
    { name: 'VCC', col: 0, row: 'E' },
    { name: 'GND', col: 1, row: 'F' },
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
