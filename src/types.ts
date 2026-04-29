export interface PinDef {
  name: string
  col: number        // column offset from anchorCol (0-based)
  row: string  // actual row letter: 'A'–'J'
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
