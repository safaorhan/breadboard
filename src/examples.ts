import type { BBFile } from './state'

const exampleModules = import.meta.glob('../lib/projects/*.json', { eager: true })

export const EXAMPLE_PROJECTS: BBFile[] =
  Object.values(exampleModules).map(m => (m as { default: BBFile }).default)
