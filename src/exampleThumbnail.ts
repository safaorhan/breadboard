import type { BBFile } from './state'
import type { AppState, PlacedComponent } from './types'
import { state } from './state'
import { initSVG, render } from './render'
import { svgToJpegDataUrl } from './svgExport'
import { getExampleThumbnail, saveExampleThumbnail } from './db'

// cyrb53 — small, well-distributed 53-bit hash. Sufficient for cache keying
// across the handful of examples we ship.
function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

// Stable hash of the parts of a BBFile that affect rendering. Changing any of
// these invalidates the cached thumbnail automatically.
function hashExample(file: BBFile): string {
  const canonical = JSON.stringify({
    placed: file.placedComponents.map(p => [
      p.defId, p.anchorCol, p.anchorRow, p.rotated ?? false, p.colorIdx ?? 0,
    ]),
    wires: file.wires.map(w => [w.from, w.to]),
    setId: file.activeJumperSetId ?? null,
  })
  return cyrb53(canonical)
}

function buildOffscreenState(file: BBFile): AppState {
  const activeSet = state.jumperSets.find(s => s.id === file.activeJumperSetId) ?? null
  return {
    placedComponents: file.placedComponents.map((p: PlacedComponent) => ({
      ...p,
      rotated:     p.rotated     ?? false,
      colorIdx:    p.colorIdx    ?? 0,
      instanceNum: p.instanceNum ?? 1,
    })),
    wires:             file.wires,
    jumperSets:        state.jumperSets,
    activeJumperSetId: activeSet?.id ?? null,
    jumperLibrary:     activeSet ? [...activeSet.jumpers] : [],
    componentLibrary:  state.componentLibrary,
    selectedId:        null,
    selectedType:      null,
  }
}

export async function getOrRenderExampleThumbnail(file: BBFile): Promise<string | null> {
  const hash   = hashExample(file)
  const cached = await getExampleThumbnail(hash)
  if (cached) return cached.dataUrl

  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none'
  document.body.appendChild(container)
  try {
    const svg     = initSVG(container)
    render(svg, buildOffscreenState(file))
    const dataUrl = await svgToJpegDataUrl(svg)
    if (dataUrl) await saveExampleThumbnail(hash, dataUrl)
    return dataUrl
  } finally {
    container.remove()
  }
}
