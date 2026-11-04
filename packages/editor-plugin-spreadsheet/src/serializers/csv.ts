import Papa from 'papaparse'
import type { SpreadsheetSheetSnapshot, SpreadsheetWorkbookSnapshot } from '../types'
import { cellAddress, createWorkbookSnapshot, sheetBounds } from '../model/workbook'

export function importCsv(text: string, name = 'Workbook', delimiter?: string) {
  const result = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: false })
  if (result.errors.length && !result.data.length) throw new Error(result.errors[0].message)
  const value = createWorkbookSnapshot({ workbookName: name.replace(/\.[^.]+$/, '') })
  const sheet = value.sheets[0]
  sheet.name = 'Sheet1'
  result.data.forEach((row, rowIndex) => {
    row.forEach((input, columnIndex) => {
      if (input !== '') sheet.cells[cellAddress(rowIndex + 1, columnIndex + 1)] = { input }
    })
  })
  return { value, diagnostics: [] }
}

export function exportCsv(sheet: SpreadsheetSheetSnapshot) {
  const { maxRow, maxColumn } = sheetBounds(sheet)
  const rows = Array.from({ length: maxRow }, (_, rowIndex) =>
    Array.from({ length: maxColumn }, (_, columnIndex) =>
      sheet.cells[cellAddress(rowIndex + 1, columnIndex + 1)]?.input ?? ''
    )
  )
  return Papa.unparse(rows)
}

export function selectedSheet(snapshot: SpreadsheetWorkbookSnapshot) {
  return snapshot.sheets.find(sheet => sheet.id === snapshot.selectedSheetId) ?? snapshot.sheets[0]
}
