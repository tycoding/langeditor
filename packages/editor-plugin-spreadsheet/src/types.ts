import type {
  LcDocumentPageLayout,
  LcDocumentSelection,
  LcDocumentSession,
  LcDocumentSource,
} from '@langeditor/core'

export interface SpreadsheetCellSnapshot {
  input: string
  style?: Record<string, unknown>
}

export type SpreadsheetHorizontalAlignment = 'general' | 'left' | 'center' | 'right'
export type SpreadsheetVerticalAlignment = 'top' | 'center' | 'bottom'

export interface SpreadsheetCellStylePatch {
  font?: {
    family?: string
    size?: number
    bold?: boolean
    italic?: boolean
    underline?: boolean
    color?: string
  }
  fill?: { color?: string }
  alignment?: {
    horizontal?: SpreadsheetHorizontalAlignment
    vertical?: SpreadsheetVerticalAlignment
    wrapText?: boolean
  }
}

export interface SpreadsheetSelectionStyle {
  fontFamily: string
  fontSize: number
  bold: boolean
  italic: boolean
  underline: boolean
  fontColor: string
  fillColor: string
  horizontal: SpreadsheetHorizontalAlignment
  vertical: SpreadsheetVerticalAlignment
  wrapText: boolean
}

export interface SpreadsheetMergeSnapshot {
  startRow: number
  startColumn: number
  endRow: number
  endColumn: number
}

export interface SpreadsheetSheetSnapshot {
  id: string
  name: string
  cells: Record<string, SpreadsheetCellSnapshot>
  merges?: SpreadsheetMergeSnapshot[]
  columnWidths?: Record<string, number>
  rowHeights?: Record<string, number>
}

export interface SpreadsheetWorkbookSnapshot extends Record<string, unknown> {
  kind: 'langeditor-spreadsheet'
  version: 1
  name: string
  sheets: SpreadsheetSheetSnapshot[]
  selectedSheetId: string
  pageLayout: LcDocumentPageLayout
  metadata?: Record<string, unknown>
}

export interface SpreadsheetRangeSelection extends LcDocumentSelection {
  kind: 'spreadsheet-range'
  sheetId: string
  sheetName: string
  startRow: number
  startColumn: number
  endRow: number
  endColumn: number
  address: string
}

export interface SpreadsheetImportDiagnostic {
  code: 'macros-ignored' | 'charts-unsupported' | 'images-unsupported' | 'styles-partial' | 'range-truncated'
  severity: 'info' | 'warning'
  sheet?: string
  detail?: string
}

export interface SpreadsheetPluginOptions {
  initialRows?: number
  initialColumns?: number
  maxContextCells?: number
  workbookName?: string
}

export interface SpreadsheetPluginOptionsRoot {
  spreadsheet?: SpreadsheetPluginOptions
}

export type SpreadsheetExportFormat = 'xlsx' | 'csv'

export type SpreadsheetOperation =
  | { type: 'spreadsheet.set-cell'; payload: { sheetId?: string; row: number; column: number; input: string } }
  | { type: 'spreadsheet.set-range'; payload: { sheetId?: string; row: number; column: number; values: string[][] } }
  | { type: 'spreadsheet.clear-range'; payload?: { sheetId?: string } }
  | { type: 'spreadsheet.insert-rows'; payload?: { sheetId?: string; row?: number; count?: number } }
  | { type: 'spreadsheet.insert-columns'; payload?: { sheetId?: string; column?: number; count?: number } }
  | { type: 'spreadsheet.add-sheet'; payload?: { name?: string } }
  | { type: 'spreadsheet.rename-sheet'; payload: { sheetId?: string; name: string } }
  | { type: 'spreadsheet.set-style'; payload: SpreadsheetCellStylePatch }
  | { type: 'spreadsheet.clear-formatting'; payload?: Record<string, never> }
  | { type: 'spreadsheet.merge-cells'; payload?: Record<string, never> }
  | { type: 'spreadsheet.unmerge-cells'; payload?: Record<string, never> }
  | {
      type: 'spreadsheet.select-range'
      payload: {
        sheetId: string
        startRow: number
        startColumn: number
        endRow: number
        endColumn: number
      }
    }
  | { type: 'spreadsheet.import'; payload: { source: LcDocumentSource } }
  | { type: 'spreadsheet.export'; payload: { format: SpreadsheetExportFormat } }

export interface SpreadsheetDocumentSession extends LcDocumentSession<SpreadsheetWorkbookSnapshot> {
  getSpreadsheetState: () => {
    value: SpreadsheetWorkbookSnapshot
    selection: SpreadsheetRangeSelection
    selectionStyle: SpreadsheetSelectionStyle
    merged: boolean
    diagnostics: SpreadsheetImportDiagnostic[]
  }
  setActiveSheet: (sheetId: string) => void
  setRangeSelection: (selection: SpreadsheetRangeSelection) => void
  getFormattedCellValue: (sheetId: string, row: number, column: number) => string
}
