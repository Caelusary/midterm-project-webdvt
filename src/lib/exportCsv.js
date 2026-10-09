const HEADERS = ['Date', 'Description', 'Type', 'Category', 'Amount', 'Note']

// Excel and Sheets execute a cell that opens with one of these, so a
// description like =HYPERLINK(...) becomes a live formula in whoever's
// spreadsheet the file lands in. Prefixing an apostrophe forces it to text.
const FORMULA_START = /^[=+\-@\t\r]/

/**
 * A field is quoted whenever it contains a comma, quote, or newline, and inner
 * quotes are doubled — the CSV escaping rule spreadsheets actually expect.
 */
function escapeField(value) {
  let text = String(value ?? '')
  if (FORMULA_START.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function transactionsToCsv(transactions) {
  const rows = transactions.map(item =>
    [item.date, item.description, item.type, item.category, item.amount, item.note]
      .map(escapeField)
      .join(',')
  )
  return [HEADERS.join(','), ...rows].join('\r\n')
}

// U+FEFF. Written as an escape rather than a literal so it cannot be mistaken
// for stray whitespace by a linter or a future reader.
const BOM = '\uFEFF'

export function downloadCsv(filename, csv) {
  // The BOM makes Excel read the file as UTF-8; without it peso signs mangle.
  downloadBlob(filename, new Blob([BOM, csv], { type: 'text/csv;charset=utf-8;' }))
}

export function downloadJson(filename, data) {
  downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Revoking synchronously can abort the download in Firefox and Safari, which
  // read the blob on a separate thread after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
