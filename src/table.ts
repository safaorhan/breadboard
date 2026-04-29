import type { Net } from './nets'

export function renderTable(container: HTMLElement, nets: Net[]): void {
  container.innerHTML = ''

  if (nets.length === 0) {
    container.innerHTML = '<p style="color:#555;font-size:12px">No connections yet.</p>'
    return
  }

  const table = document.createElement('table')
  const thead = table.createTHead()
  const headerRow = thead.insertRow()
  headerRow.innerHTML = '<th>Net</th><th>Connected Pins</th>'

  const tbody = table.createTBody()
  nets.forEach((net, i) => {
    const row  = tbody.insertRow()
    const pins = net.pins.map(p => `${p.componentName}.${p.pinName}`).join(', ')
    const netCell = row.insertCell()
    netCell.textContent = `Net ${i + 1}`
    const pinsCell = row.insertCell()
    pinsCell.textContent = pins
  })

  container.appendChild(table)
}
