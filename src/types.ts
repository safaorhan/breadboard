export interface PinDef {
  name: string
  col: number              // column offset from anchorCol (0-based)
  row: 'top' | 'bottom'   // top edge or bottom edge of the component
}

export interface ComponentIllustration {
  file:    string                                             // SVG filename in lib/components/
  viewBox: { width: number; height: number }                 // from the SVG's viewBox attribute
  anchors: [                                                 // two named pins with their SVG centre coords
    { pin: string; x: number; y: number },
    { pin: string; x: number; y: number },
  ]
}

export interface ComponentDef {
  id:           string
  name:         string
  colSpan:      number    // width in columns
  rowSpan:      number    // height in y-units (same scale as ROW_Y_UNITS)
  pins:         PinDef[]
  illustration?: ComponentIllustration
  source?:      'system' | 'user'
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
  label?: string     // per-instance display name override
}

export interface Wire {
  id: string
  from: string       // hole address, e.g. "E5" or "top+:12"
  to: string
}

export interface JumperDef {
  color: string   // hex e.g. "#ff0000"
  pitch: number   // Euclidean distance in pitch units; unique within a set
}

export interface JumperSet {
  id:      string
  name:    string
  jumpers: JumperDef[]
}

export interface AppState {
  placedComponents:  PlacedComponent[]
  wires:             Wire[]
  jumperSets:        JumperSet[]        // all available sets (system + user)
  activeJumperSetId: string | null
  jumperLibrary:     JumperDef[]        // jumpers from the active set
  componentLibrary:  ComponentDef[]
  selectedId:        string | null
  selectedType:      'component' | 'wire' | null
}
