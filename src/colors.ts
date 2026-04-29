export interface ComponentColor {
  fill:   string  // light body fill
  stroke: string  // border + chip background
  text:   string  // chip text
}

export const COMPONENT_COLORS: ComponentColor[] = [
  { fill: '#e0f0e8', stroke: '#28a745', text: '#fff' },
  { fill: '#dde8ff', stroke: '#2563eb', text: '#fff' },
  { fill: '#fff0d9', stroke: '#d97706', text: '#fff' },
  { fill: '#fde0e0', stroke: '#dc2626', text: '#fff' },
  { fill: '#ede8fc', stroke: '#7c3aed', text: '#fff' },
  { fill: '#d8f5ee', stroke: '#0d9488', text: '#fff' },
  { fill: '#fde0f0', stroke: '#db2777', text: '#fff' },
  { fill: '#e8f0ff', stroke: '#4f46e5', text: '#fff' },
  { fill: '#fefce8', stroke: '#ca8a04', text: '#fff' },
  { fill: '#ecfeff', stroke: '#0891b2', text: '#fff' },
  { fill: '#f7fee7', stroke: '#65a30d', text: '#fff' },
  { fill: '#fdf4ff', stroke: '#a21caf', text: '#fff' },
]

export function getColor(idx: number): ComponentColor {
  return COMPONENT_COLORS[idx % COMPONENT_COLORS.length]
}
