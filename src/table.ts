import type { Net } from './nets'

export function renderTable(container: HTMLElement, nets: Net[]): void {
  container.innerHTML = ''

  if (nets.length === 0) {
    container.innerHTML = '<p>No connections yet.</p>'
    return
  }

  const table = document.createElement('table')
  const thead = table.createTHead()
  const hRow  = thead.insertRow()
  for (const txt of ['Net', 'Component', 'Pin', '', 'Component', 'Pin']) {
    const th = document.createElement('th')
    th.textContent = txt
    hRow.appendChild(th)
  }

  const tbody = table.createTBody()

  nets.forEach((net, i) => {
    const label = `Net ${i + 1}`
    const { pins } = net

    if (pins.length < 2) return

    // Anchor is the first pin; pair it with every other pin in the net
    const anchor = pins[0]
    const others  = pins.slice(1)

    others.forEach((pin, j) => {
      const row = tbody.insertRow()

      // Net label cell — rowspan across all pairs for this net
      if (j === 0) {
        const netTd = row.insertCell()
        netTd.textContent  = label
        netTd.rowSpan      = others.length
        netTd.className    = 'net-label'
      }

      addCell(row, anchor.componentName, 'comp-name')
      addCell(row, anchor.pinName,       'pin-name')

      const arrow = row.insertCell()
      arrow.innerHTML = `<span class="net-arrow">↔</span>`

      addCell(row, pin.componentName, 'comp-name')
      addCell(row, pin.pinName,       'pin-name')
    })
  })

  container.appendChild(table)
}

function addCell(row: HTMLTableRowElement, text: string, cls: string): void {
  const td = row.insertCell()
  td.textContent = text
  td.className   = cls
}
