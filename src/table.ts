import type { Net } from './nets'

export function renderTable(container: HTMLElement, _nets: Net[]): void {
  container.innerHTML = '<p style="color:#666;font-size:12px">No connections yet.</p>'
}
