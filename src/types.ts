export interface PinDef {
  name: string
  col: number              // column offset from anchorCol (0-based)
  row: 'top' | 'bottom'   // top edge or bottom edge of the component
}

export interface ComponentDef {
  id: string
  name: string
  colSpan: number    // width in columns
  rowSpan: number    // height in y-units (same scale as ROW_Y_UNITS)
  pins: PinDef[]
}

export interface PlacedComponent {
  id: string
  defId: string
  anchorCol: number  // 1-based column of the leftmost pin
  anchorRow: string  // row letter of the top edge (e.g. 'E')
  locked: boolean
  hidden: boolean
  rotated: boolean
  colorIdx: number
  instanceNum: number
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
