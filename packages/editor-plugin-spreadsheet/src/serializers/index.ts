import type { LcDocumentSource } from '@langeditor/core'
import type { SpreadsheetExportFormat, SpreadsheetWorkbookSnapshot } from '../types'

export async function importSpreadsheet(source: LcDocumentSource) {
  const { importDocumentSource } = await import('./source')
  return importDocumentSource(source)
}

export async function exportSpreadsheet(snapshot: SpreadsheetWorkbookSnapshot, format: SpreadsheetExportFormat) {
  if (format === 'xlsx') {
    const { exportXlsx } = await import('./xlsx')
    return exportXlsx(snapshot)
  }
  const { exportCsv, selectedSheet } = await import('./csv')
  return exportCsv(selectedSheet(snapshot))
}
