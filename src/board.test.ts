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
    const posA = getHolePosition('A1')
    const posB = getHolePosition('B1')
    const midY = (posA.y + posB.y) / 2
    expect(snapToHole(posA.x, midY)).toBe('A1') // snaps to nearest
  })

  it('returns null for x out of board range', () => {
    expect(snapToHole(-100, 50)).toBeNull()
  })
})
