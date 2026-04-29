import { describe, it, expect, beforeEach } from 'vitest'
import { analyzeNets } from './nets'
import { state, _resetStateForTest, placeComponent, addWire } from './state'
import type { ComponentDef } from './types'

const chipA: ComponentDef = {
  id: 'chip-a',
  name: 'ChipA',
  colSpan: 2,
  pins: [
    { name: 'OUT', col: 0, row: 'E' },
    { name: 'GND', col: 1, row: 'F' },
  ],
}

const chipB: ComponentDef = {
  id: 'chip-b',
  name: 'ChipB',
  colSpan: 2,
  pins: [
    { name: 'IN',  col: 0, row: 'E' },
    { name: 'PWR', col: 1, row: 'F' },
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
    placeComponent('chip-a', 10)
    placeComponent('chip-b', 10)
    const nets = analyzeNets(state)
    const net = nets.find(n =>
      n.pins.some(p => p.pinName === 'OUT') &&
      n.pins.some(p => p.pinName === 'IN')
    )
    expect(net).toBeDefined()
  })

  it('connects pins joined by a wire', () => {
    placeComponent('chip-a', 5)
    placeComponent('chip-b', 20)
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
    placeComponent('chip-a', 5)
    addWire('A5', 'B5')
    const nets = analyzeNets(state)
    const outNet = nets.find(n => n.pins.some(p => p.pinName === 'OUT'))
    expect(outNet).toBeUndefined()
  })

  it('connects pins via power rail', () => {
    placeComponent('chip-a', 10)
    placeComponent('chip-b', 20)
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
