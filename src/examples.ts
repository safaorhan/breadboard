import type { PlacedComponent } from './types'

export interface ExampleProject {
  name:              string
  description:       string
  placedComponents:  PlacedComponent[]
  wires:             { id: string; from: string; to: string }[]
  activeJumperSetId: string | null
}

const exampleModules = import.meta.glob('../lib/projects/*.json', { eager: true })

export const EXAMPLE_PROJECTS: ExampleProject[] =
  Object.values(exampleModules).map(m => (m as { default: ExampleProject }).default)
