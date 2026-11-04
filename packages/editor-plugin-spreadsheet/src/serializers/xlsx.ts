import * as XLSX from '@e965/xlsx'
import type {
  Alignment,
  BorderStyle,
  Borders,
  Cell,
  CellValue,
  Color,
  Fill,
  FillPatterns,
  Font,
  PaperSize,
  Workbook,
  Worksheet,
} from 'exceljs'
import type {
  SpreadsheetCellSnapshot,
  SpreadsheetImportDiagnostic,
  SpreadsheetSheetSnapshot,
  SpreadsheetWorkbookSnapshot,
} from '../types'
import { createWorkbookSnapshot, defaultPageLayout } from '../model/workbook'

function inputFromCell(cell: XLSX.CellObject) {
  if (cell.f) return `=${cell.f}`
  if (cell.v instanceof Date) return cell.v.toISOString()
  if (cell.v === undefined || cell.v === null) return ''
  return String(cell.v)
}

function cellStyle(cell: XLSX.CellObject): Record<string, unknown> | undefined {
  const style = cell.s
  const result = style && typeof style === 'object' ? { ...style } : {}
  if (typeof cell.z === 'string') result.numFmt = cell.z
  return Object.keys(result).length ? result : undefined
}

function sheetSnapshot(name: string, worksheet: XLSX.WorkSheet, index: number): SpreadsheetSheetSnapshot {
  const cells: Record<string, SpreadsheetCellSnapshot> = {}
  if (worksheet['!ref']) {
    const range = XLSX.utils.decode_range(worksheet['!ref'])
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let column = range.s.c; column <= range.e.c; column += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: column })
        const source = worksheet[address] as XLSX.CellObject | undefined
        if (!source) continue
        const input = inputFromCell(source)
        if (input !== '') cells[address] = { input, style: cellStyle(source) }
      }
    }
  }
  return {
    id: `sheet-${index + 1}-${Math.random().toString(36).slice(2)}`,
    name,
    cells,
    merges: worksheet['!merges']?.map(range => ({
      startRow: range.s.r + 1,
      startColumn: range.s.c + 1,
      endRow: range.e.r + 1,
      endColumn: range.e.c + 1,
    })),
    columnWidths: Object.fromEntries(
      (worksheet['!cols'] ?? []).flatMap((column, columnIndex) =>
        typeof column.wpx === 'number' ? [[String(columnIndex + 1), column.wpx]] : []
      )
    ),
    rowHeights: Object.fromEntries(
      (worksheet['!rows'] ?? []).flatMap((row, rowIndex) =>
        typeof row.hpx === 'number' ? [[String(rowIndex + 1), row.hpx]] : []
      )
    ),
  }
}

export function importXlsx(data: ArrayBuffer | Uint8Array, name = 'Workbook') {
  const workbook = XLSX.read(data, { type: 'array', cellStyles: true, cellDates: true, bookVBA: true })
  const sheets = workbook.SheetNames.map((sheetName, index) =>
    sheetSnapshot(sheetName, workbook.Sheets[sheetName], index)
  )
  const fallback = createWorkbookSnapshot({ workbookName: name.replace(/\.[^.]+$/, '') })
  const value: SpreadsheetWorkbookSnapshot = {
    ...fallback,
    sheets: sheets.length ? sheets : fallback.sheets,
    selectedSheetId: sheets[0]?.id ?? fallback.selectedSheetId,
    pageLayout: defaultPageLayout(),
  }
  const diagnostics: SpreadsheetImportDiagnostic[] = []
  if (workbook.vbaraw) diagnostics.push({ code: 'macros-ignored', severity: 'warning' })
  if (workbook.SheetNames.some(sheetName => workbook.Sheets[sheetName]?.['!type'] === 'chart')) {
    diagnostics.push({ code: 'charts-unsupported', severity: 'warning' })
  }
  if (sheets.some(sheet => Object.values(sheet.cells).some(cell => cell.style))) {
    diagnostics.push({ code: 'styles-partial', severity: 'info' })
  }
  return { value, diagnostics }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function excelColor(value: unknown): Partial<Color> | undefined {
  if (typeof value === 'string') {
    const hex = value.replace(/^#/, '')
    if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) {
      return { argb: hex.length === 6 ? `FF${hex.toUpperCase()}` : hex.toUpperCase() }
    }
  }
  if (!isRecord(value)) return undefined
  if (typeof value.theme === 'number') return { theme: value.theme }
  return excelColor(value.argb ?? value.rgb)
}

function excelFont(value: unknown): Partial<Font> | undefined {
  if (!isRecord(value)) return undefined
  const font: Partial<Font> = {}
  if (typeof value.name === 'string') font.name = value.name
  if (typeof value.sz === 'number') font.size = value.sz
  if (typeof value.bold === 'boolean') font.bold = value.bold
  if (typeof value.italic === 'boolean') font.italic = value.italic
  if (typeof value.underline === 'boolean' || typeof value.underline === 'string') {
    font.underline = value.underline as Font['underline']
  }
  if (typeof value.strike === 'boolean') font.strike = value.strike
  const color = excelColor(value.color)
  if (color) font.color = color
  return Object.keys(font).length ? font : undefined
}

function excelFill(value: unknown): Fill | undefined {
  if (!isRecord(value)) return undefined
  const fgColor = excelColor(value.fgColor)
  const bgColor = excelColor(value.bgColor)
  if (!fgColor && !bgColor) return undefined
  return {
    type: 'pattern',
    pattern: typeof value.patternType === 'string'
      ? value.patternType as FillPatterns
      : 'solid',
    ...(fgColor ? { fgColor } : {}),
    ...(bgColor ? { bgColor } : {}),
  }
}

function excelAlignment(value: unknown): Partial<Alignment> | undefined {
  if (!isRecord(value)) return undefined
  const alignment: Partial<Alignment> = {}
  if (value.horizontal === 'left' || value.horizontal === 'center' || value.horizontal === 'right') {
    alignment.horizontal = value.horizontal
  }
  if (value.vertical === 'top' || value.vertical === 'bottom') alignment.vertical = value.vertical
  else if (value.vertical === 'center') alignment.vertical = 'middle'
  if (typeof value.wrapText === 'boolean') alignment.wrapText = value.wrapText
  if (typeof value.textRotation === 'number') alignment.textRotation = value.textRotation
  return Object.keys(alignment).length ? alignment : undefined
}

function excelBorder(value: unknown): Partial<Borders> | undefined {
  if (!isRecord(value)) return undefined
  const borders: Partial<Borders> = {}
  for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
    const source = value[edge]
    if (!isRecord(source) || typeof source.style !== 'string') continue
    borders[edge] = {
      style: source.style as BorderStyle,
      ...(excelColor(source.color) ? { color: excelColor(source.color) } : {}),
    }
  }
  return Object.keys(borders).length ? borders : undefined
}

function applyCellStyle(target: Cell, source: SpreadsheetCellSnapshot) {
  if (!isRecord(source.style)) return
  const font = excelFont(source.style.font)
  const fill = excelFill(source.style.fill)
  const alignment = excelAlignment(source.style.alignment)
  const border = excelBorder(source.style.border)
  if (font) target.font = font
  if (fill) target.fill = fill
  if (alignment) target.alignment = alignment
  if (border) target.border = border
  if (typeof source.style.numFmt === 'string') target.numFmt = source.style.numFmt
}

function excelCellValue(input: string): CellValue {
  if (input.startsWith('=')) return { formula: input.slice(1) }
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(input)) return Number(input)
  if (/^(true|false)$/i.test(input)) return input.toLowerCase() === 'true'
  return input
}

function pageRegionText(region: SpreadsheetWorkbookSnapshot['pageLayout']['header']) {
  if (!region?.enabled) return undefined
  const escape = (value: string) => value.replaceAll('&', '&&')
  const values = [
    region.left ? `&L${escape(region.left)}` : '',
    region.center ? `&C${escape(region.center)}` : '',
    region.right ? `&R${escape(region.right)}` : '',
  ]
  if (region.showPageNumber) values.push(`${region.center ? '&C' : '&R'}&P`)
  return values.join('') || undefined
}

function applyPageLayout(worksheet: Worksheet, snapshot: SpreadsheetWorkbookSnapshot) {
  const layout = snapshot.pageLayout
  const paperSize: PaperSize | undefined = layout.paper?.toUpperCase() === 'A4'
    ? 9 as PaperSize
    : layout.paper?.toUpperCase() === 'A5'
      ? 11 as PaperSize
      : undefined
  worksheet.pageSetup = {
    ...(paperSize ? { paperSize } : {}),
    ...(layout.orientation ? { orientation: layout.orientation } : {}),
    ...(layout.margins ? {
      margins: {
        top: layout.margins.top / 25.4,
        right: layout.margins.right / 25.4,
        bottom: layout.margins.bottom / 25.4,
        left: layout.margins.left / 25.4,
        header: 0.3,
        footer: 0.3,
      },
    } : {}),
  }
  const oddHeader = pageRegionText(layout.header)
  const oddFooter = pageRegionText(layout.footer)
  if (oddHeader || oddFooter) worksheet.headerFooter = { oddHeader, oddFooter }
}

function exportSheet(workbook: Workbook, sheet: SpreadsheetSheetSnapshot, snapshot: SpreadsheetWorkbookSnapshot) {
  const worksheet = workbook.addWorksheet(sheet.name)
  for (const [address, source] of Object.entries(sheet.cells)) {
    const cell = worksheet.getCell(address)
    cell.value = excelCellValue(source.input)
    applyCellStyle(cell, source)
  }
  for (const merge of sheet.merges ?? []) {
    worksheet.mergeCells(merge.startRow, merge.startColumn, merge.endRow, merge.endColumn)
  }
  for (const [column, width] of Object.entries(sheet.columnWidths ?? {})) {
    worksheet.getColumn(Number(column)).width = Math.max(1, (width - 5) / 7)
  }
  for (const [row, height] of Object.entries(sheet.rowHeights ?? {})) {
    worksheet.getRow(Number(row)).height = height * 0.75
  }
  applyPageLayout(worksheet, snapshot)
}

export async function exportXlsx(snapshot: SpreadsheetWorkbookSnapshot) {
  const { default: ExcelJS } = await import('exceljs') as unknown as {
    default: typeof import('exceljs')
  }
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'LangEditor'
  workbook.lastModifiedBy = 'LangEditor'
  workbook.calcProperties.fullCalcOnLoad = true
  for (const sheet of snapshot.sheets) exportSheet(workbook, sheet, snapshot)
  const output = await workbook.xlsx.writeBuffer() as unknown as ArrayBuffer | Uint8Array
  if (output instanceof ArrayBuffer) return output
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer
}
