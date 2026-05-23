import { SVG_WIDTH, SVG_HEIGHT } from './board'

// Collect document CSSStyleRules so a serialized SVG can render standalone
// with the same visual styles as the live canvas. Skips @font-face/@import
// (they cause CORS errors when the SVG is decoded from a blob URL).
export function collectDocumentStyles(): string {
  const rules: string[] = []
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSStyleRule) rules.push(rule.cssText)
      }
    } catch { /* cross-origin sheet */ }
  }
  return rules.join('\n')
}

// Rasterize a board SVG into a JPEG data URL at the given pixel width.
// Clones the input SVG so the live one is untouched, embeds document CSS,
// and hides the hover-label overlay.
export async function svgToJpegDataUrl(
  svg: SVGSVGElement,
  pixelWidth = 480,
  quality = 0.8,
): Promise<string | null> {
  try {
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('width',  String(SVG_WIDTH))
    clone.setAttribute('height', String(SVG_HEIGHT))

    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    styleEl.textContent = collectDocumentStyles()
    clone.insertBefore(styleEl, clone.firstChild)

    const hoverGroup = clone.getElementById('hover-labels')
    if (hoverGroup) hoverGroup.setAttribute('visibility', 'hidden')

    const svgStr = new XMLSerializer().serializeToString(clone)
    const blob   = new Blob([svgStr], { type: 'image/svg+xml' })
    const url    = URL.createObjectURL(blob)

    return await new Promise<string | null>(resolve => {
      const img = new Image()
      const w = pixelWidth
      const h = Math.round(SVG_HEIGHT * (pixelWidth / SVG_WIDTH))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width  = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#faf8f4'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
      img.src = url
    })
  } catch {
    return null
  }
}
