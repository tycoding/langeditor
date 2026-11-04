import type { Model } from '@ironcalc/wasm'
import type {
  SpreadsheetCellStylePatch,
  SpreadsheetPluginOptions,
  SpreadsheetRangeSelection,
  SpreadsheetSelectionStyle,
  SpreadsheetSheetSnapshot,
  SpreadsheetWorkbookSnapshot,
} from '../types'

export const DEFAULT_ROWS = 200
export const DEFAULT_COLUMNS = 26

export const DEFAULT_SELECTION_STYLE: SpreadsheetSelectionStyle = {
  fontFamily: 'Aptos',
  fontSize: 12,
  bold: false,
  italic: false,
  underline: false,
  fontColor: '#111827',
  fillColor: '#ffffff',
  horizontal: 'general',
  vertical: 'bottom',
  wrapText: false,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function cloneRecord(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function colorFromStyle(value: unknown, fallback: string) {
  const rgb = typeof value === 'string'
    ? value
    : isRecord(value) && typeof value.rgb === 'string'
      ? value.rgb
      : ''
  const normalized = rgb.replace(/^#/, '').slice(-6)
  return /^[0-9a-f]{6}$/i.test(normalized) ? `#${normalized.toLowerCase()}` : fallback
}

function xlsxColor(value: string) {
  const normalized = value.replace(/^#/, '').slice(-6).toUpperCase()
  return { rgb: `FF${/^[0-9A-F]{6}$/.test(normalized) ? normalized : '000000'}` }
}

function rangesIntersect(a: SpreadsheetRangeSelection, b: {
  startRow: number
  startColumn: number
  endRow: number
  endColumn: number
}) {
  return a.startRow <= b.endRow && a.endRow >= b.startRow &&
    a.startColumn <= b.endColumn && a.endColumn >= b.startColumn
}

function createId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${prefix}-${random}`
}

export function columnLabel(column: number) {
  let value = Math.max(1, Math.floor(column))
  let label = ''
  while (value > 0) {
    value -= 1
    label = String.fromCharCode(65 + (value % 26)) + label
    value = Math.floor(value / 26)
  }
  return label
}

export function cellAddress(row: number, column: number) {
  return `${columnLabel(column)}${Math.max(1, Math.floor(row))}`
}

export function parseCellAddress(address: string) {
  const match = /^([A-Z]+)([1-9]\d*)$/i.exec(address.trim())
  if (!match) return null
  let column = 0
  for (const character of match[1].toUpperCase()) {
    column = column * 26 + character.charCodeAt(0) - 64
  }
  return { row: Number(match[2]), column }
}

export function rangeAddress(startRow: number, startColumn: number, endRow: number, endColumn: number) {
  const start = cellAddress(Math.min(startRow, endRow), Math.min(startColumn, endColumn))
  const end = cellAddress(Math.max(startRow, endRow), Math.max(startColumn, endColumn))
  return start === end ? start : `${start}:${end}`
}

export function defaultPageLayout(): SpreadsheetWorkbookSnapshot['pageLayout'] {
  return {
    paper: 'A4',
    orientation: 'landscape',
    margins: { top: 20, right: 16, bottom: 20, left: 16 },
    header: { enabled: false, firstPage: true, alignment: 'center' },
    footer: { enabled: false, firstPage: true, alignment: 'center', showPageNumber: true },
  }
}

export function createWorkbookSnapshot(options: SpreadsheetPluginOptions = {}): SpreadsheetWorkbookSnapshot {
  const sheet: SpreadsheetSheetSnapshot = { id: createId('sheet'), name: 'Sheet1', cells: {} }
  return {
    kind: 'langeditor-spreadsheet',
    version: 1,
    name: options.workbookName?.trim() || 'Workbook',
    sheets: [sheet],
    selectedSheetId: sheet.id,
    pageLayout: defaultPageLayout(),
    metadata: {
      viewportRows: options.initialRows ?? DEFAULT_ROWS,
      viewportColumns: options.initialColumns ?? DEFAULT_COLUMNS,
    },
  }
}

export function isWorkbookSnapshot(value: unknown): value is SpreadsheetWorkbookSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<SpreadsheetWorkbookSnapshot>
  return snapshot.kind === 'langeditor-spreadsheet' && snapshot.version === 1 && Array.isArray(snapshot.sheets)
}

export function cloneWorkbookSnapshot(snapshot: SpreadsheetWorkbookSnapshot): SpreadsheetWorkbookSnapshot {
  // Spreadsheet snapshots are a JSON contract. JSON cloning also unwraps
  // framework proxies that the native structuredClone API cannot clone.
  return JSON.parse(JSON.stringify(snapshot)) as SpreadsheetWorkbookSnapshot
}

export function clonePageLayout(
  layout: SpreadsheetWorkbookSnapshot['pageLayout']
): SpreadsheetWorkbookSnapshot['pageLayout'] {
  return JSON.parse(JSON.stringify(layout)) as SpreadsheetWorkbookSnapshot['pageLayout']
}

export function normalizeWorkbookSnapshot(
  value: SpreadsheetWorkbookSnapshot,
  options: SpreadsheetPluginOptions = {}
): SpreadsheetWorkbookSnapshot {
  const fallback = createWorkbookSnapshot(options)
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const sheets = value.sheets.map((sheet, index) => {
    let id = typeof sheet.id === 'string' && sheet.id && !seenIds.has(sheet.id) ? sheet.id : createId('sheet')
    seenIds.add(id)
    let name = sheet.name?.trim() || `Sheet${index + 1}`
    const baseName = name
    let suffix = 2
    while (seenNames.has(name.toLocaleLowerCase())) name = `${baseName} ${suffix++}`
    seenNames.add(name.toLocaleLowerCase())
    return {
      id,
      name,
      cells: Object.fromEntries(
        Object.entries(sheet.cells ?? {}).filter(([address, cell]) => parseCellAddress(address) && cell?.input !== undefined)
      ),
      merges: sheet.merges ? [...sheet.merges] : undefined,
      columnWidths: sheet.columnWidths ? { ...sheet.columnWidths } : undefined,
      rowHeights: sheet.rowHeights ? { ...sheet.rowHeights } : undefined,
    }
  })
  if (!sheets.length) return fallback
  return {
    ...cloneWorkbookSnapshot(value),
    kind: 'langeditor-spreadsheet',
    version: 1,
    name: value.name?.trim() || fallback.name,
    sheets,
    selectedSheetId: sheets.some(sheet => sheet.id === value.selectedSheetId)
      ? value.selectedSheetId
      : sheets[0].id,
    pageLayout: { ...defaultPageLayout(), ...(value.pageLayout ?? {}) },
  }
}

export function createSelection(
  sheet: SpreadsheetSheetSnapshot,
  startRow: number,
  startColumn: number,
  endRow = startRow,
  endColumn = startColumn
): SpreadsheetRangeSelection {
  return {
    kind: 'spreadsheet-range',
    sheetId: sheet.id,
    sheetName: sheet.name,
    startRow: Math.min(startRow, endRow),
    startColumn: Math.min(startColumn, endColumn),
    endRow: Math.max(startRow, endRow),
    endColumn: Math.max(startColumn, endColumn),
    address: rangeAddress(startRow, startColumn, endRow, endColumn),
  }
}

export function sheetBounds(sheet: SpreadsheetSheetSnapshot) {
  let maxRow = 1
  let maxColumn = 1
  for (const address of Object.keys(sheet.cells)) {
    const cell = parseCellAddress(address)
    if (!cell) continue
    maxRow = Math.max(maxRow, cell.row)
    maxColumn = Math.max(maxColumn, cell.column)
  }
  return { maxRow, maxColumn }
}

export class SpreadsheetWorkbookModel {
  private model: Model
  private snapshot: SpreadsheetWorkbookSnapshot

  constructor(model: Model, snapshot: SpreadsheetWorkbookSnapshot) {
    this.model = model
    this.snapshot = snapshot
  }

  static create(ModelConstructor: typeof Model, snapshot: SpreadsheetWorkbookSnapshot) {
    const model = new ModelConstructor(snapshot.name, 'en', 'UTC', 'en')
    const workbook = new SpreadsheetWorkbookModel(model, normalizeWorkbookSnapshot(snapshot))
    workbook.rebuildEngine()
    return workbook
  }

  get value() {
    return this.snapshot
  }

  get selectedSheetIndex() {
    const index = this.snapshot.sheets.findIndex(sheet => sheet.id === this.snapshot.selectedSheetId)
    return index < 0 ? 0 : index
  }

  get selectedSheet() {
    return this.snapshot.sheets[this.selectedSheetIndex]
  }

  setSnapshot(snapshot: SpreadsheetWorkbookSnapshot) {
    this.snapshot = normalizeWorkbookSnapshot(snapshot)
    this.rebuildEngine()
  }

  setSelectedSheet(sheetId: string) {
    const index = this.snapshot.sheets.findIndex(sheet => sheet.id === sheetId)
    if (index < 0) throw new Error(`Unknown worksheet ${sheetId}`)
    this.snapshot.selectedSheetId = sheetId
    this.model.setSelectedSheet(index)
  }

  setSelection(selection: SpreadsheetRangeSelection) {
    this.setSelectedSheet(selection.sheetId)
    this.model.setSelectedCell(selection.startRow, selection.startColumn)
    this.model.setSelectedRange(
      selection.startRow,
      selection.startColumn,
      selection.endRow,
      selection.endColumn
    )
  }

  setCell(sheetId: string, row: number, column: number, input: string) {
    const sheetIndex = this.requireSheetIndex(sheetId)
    const sheet = this.snapshot.sheets[sheetIndex]
    const address = cellAddress(row, column)
    this.model.setUserInput(sheetIndex, row, column, input)
    if (input === '') delete sheet.cells[address]
    else sheet.cells[address] = { ...(sheet.cells[address] ?? {}), input }
  }

  getCellInput(sheetId: string, row: number, column: number) {
    return this.snapshot.sheets[this.requireSheetIndex(sheetId)].cells[cellAddress(row, column)]?.input ?? ''
  }

  getFormattedValue(sheetId: string, row: number, column: number) {
    return this.model.getFormattedCellValue(this.requireSheetIndex(sheetId), row, column)
  }

  getCellStyle(sheetId: string, row: number, column: number) {
    const style = this.snapshot.sheets[this.requireSheetIndex(sheetId)].cells[cellAddress(row, column)]?.style
    return isRecord(style) ? style : undefined
  }

  getSelectionStyle(selection: SpreadsheetRangeSelection): SpreadsheetSelectionStyle {
    const style = this.getCellStyle(selection.sheetId, selection.startRow, selection.startColumn)
    const font = isRecord(style?.font) ? style.font : {}
    const fill = isRecord(style?.fill) ? style.fill : {}
    const alignment = isRecord(style?.alignment) ? style.alignment : {}
    const fontSize = typeof font.sz === 'number' ? font.sz : DEFAULT_SELECTION_STYLE.fontSize
    const horizontal = alignment.horizontal
    const vertical = alignment.vertical
    return {
      fontFamily: typeof font.name === 'string' && font.name ? font.name : DEFAULT_SELECTION_STYLE.fontFamily,
      fontSize: Number.isFinite(fontSize) ? fontSize : DEFAULT_SELECTION_STYLE.fontSize,
      bold: Boolean(font.bold),
      italic: Boolean(font.italic),
      underline: Boolean(font.underline),
      fontColor: colorFromStyle(font.color, DEFAULT_SELECTION_STYLE.fontColor),
      fillColor: colorFromStyle(fill.fgColor, DEFAULT_SELECTION_STYLE.fillColor),
      horizontal: horizontal === 'left' || horizontal === 'center' || horizontal === 'right'
        ? horizontal
        : DEFAULT_SELECTION_STYLE.horizontal,
      vertical: vertical === 'top' || vertical === 'center' || vertical === 'bottom'
        ? vertical
        : DEFAULT_SELECTION_STYLE.vertical,
      wrapText: Boolean(alignment.wrapText),
    }
  }

  setRangeStyle(selection: SpreadsheetRangeSelection, patch: SpreadsheetCellStylePatch) {
    const sheet = this.snapshot.sheets[this.requireSheetIndex(selection.sheetId)]
    for (let row = selection.startRow; row <= selection.endRow; row += 1) {
      for (let column = selection.startColumn; column <= selection.endColumn; column += 1) {
        const address = cellAddress(row, column)
        const cell = sheet.cells[address] ?? { input: '' }
        const style = isRecord(cell.style) ? cloneRecord(cell.style) : {}
        if (patch.font) {
          const font = isRecord(style.font) ? { ...style.font } : {}
          if (patch.font.family !== undefined) font.name = patch.font.family
          if (patch.font.size !== undefined) font.sz = patch.font.size
          if (patch.font.bold !== undefined) font.bold = patch.font.bold
          if (patch.font.italic !== undefined) font.italic = patch.font.italic
          if (patch.font.underline !== undefined) font.underline = patch.font.underline
          if (patch.font.color !== undefined) font.color = xlsxColor(patch.font.color)
          style.font = font
        }
        if (patch.fill?.color !== undefined) {
          const fill = isRecord(style.fill) ? { ...style.fill } : {}
          fill.patternType = 'solid'
          fill.fgColor = xlsxColor(patch.fill.color)
          fill.bgColor = xlsxColor(patch.fill.color)
          style.fill = fill
        }
        if (patch.alignment) {
          const alignment = isRecord(style.alignment) ? { ...style.alignment } : {}
          if (patch.alignment.horizontal !== undefined) alignment.horizontal = patch.alignment.horizontal
          if (patch.alignment.vertical !== undefined) alignment.vertical = patch.alignment.vertical
          if (patch.alignment.wrapText !== undefined) alignment.wrapText = patch.alignment.wrapText
          style.alignment = alignment
        }
        cell.style = style
        sheet.cells[address] = cell
      }
    }
  }

  clearRangeFormatting(selection: SpreadsheetRangeSelection) {
    const sheet = this.snapshot.sheets[this.requireSheetIndex(selection.sheetId)]
    for (let row = selection.startRow; row <= selection.endRow; row += 1) {
      for (let column = selection.startColumn; column <= selection.endColumn; column += 1) {
        const address = cellAddress(row, column)
        const cell = sheet.cells[address]
        if (!cell) continue
        delete cell.style
        if (cell.input === '') delete sheet.cells[address]
      }
    }
  }

  mergeRange(selection: SpreadsheetRangeSelection) {
    if (selection.startRow === selection.endRow && selection.startColumn === selection.endColumn) return
    const sheet = this.snapshot.sheets[this.requireSheetIndex(selection.sheetId)]
    const merge = {
      startRow: selection.startRow,
      startColumn: selection.startColumn,
      endRow: selection.endRow,
      endColumn: selection.endColumn,
    }
    sheet.merges = [...(sheet.merges ?? []).filter(item => !rangesIntersect(selection, item)), merge]
  }

  unmergeRange(selection: SpreadsheetRangeSelection) {
    const sheet = this.snapshot.sheets[this.requireSheetIndex(selection.sheetId)]
    sheet.merges = (sheet.merges ?? []).filter(item => !rangesIntersect(selection, item))
  }

  isRangeMerged(selection: SpreadsheetRangeSelection) {
    const sheet = this.snapshot.sheets[this.requireSheetIndex(selection.sheetId)]
    return Boolean(sheet.merges?.some(merge =>
      merge.startRow === selection.startRow && merge.startColumn === selection.startColumn &&
      merge.endRow === selection.endRow && merge.endColumn === selection.endColumn
    ))
  }

  clearRange(selection: SpreadsheetRangeSelection) {
    const sheetIndex = this.requireSheetIndex(selection.sheetId)
    this.model.rangeClearContents(
      sheetIndex,
      selection.startRow,
      selection.startColumn,
      selection.endRow,
      selection.endColumn
    )
    const sheet = this.snapshot.sheets[sheetIndex]
    for (let row = selection.startRow; row <= selection.endRow; row += 1) {
      for (let column = selection.startColumn; column <= selection.endColumn; column += 1) {
        delete sheet.cells[cellAddress(row, column)]
      }
    }
  }

  insertRows(sheetId: string, row: number, count: number) {
    const sheetIndex = this.requireSheetIndex(sheetId)
    this.model.insertRows(sheetIndex, row, count)
    this.snapshot.sheets[sheetIndex].cells = this.captureEngineCells(sheetIndex, count, 0)
  }

  insertColumns(sheetId: string, column: number, count: number) {
    const sheetIndex = this.requireSheetIndex(sheetId)
    this.model.insertColumns(sheetIndex, column, count)
    this.snapshot.sheets[sheetIndex].cells = this.captureEngineCells(sheetIndex, 0, count)
  }

  addSheet(name?: string) {
    this.model.newSheet()
    const index = this.snapshot.sheets.length
    const resolvedName = this.uniqueSheetName(name?.trim() || `Sheet${index + 1}`)
    this.model.renameSheet(index, resolvedName)
    const sheet: SpreadsheetSheetSnapshot = { id: createId('sheet'), name: resolvedName, cells: {} }
    this.snapshot.sheets.push(sheet)
    this.setSelectedSheet(sheet.id)
    return sheet
  }

  renameSheet(sheetId: string, name: string) {
    const index = this.requireSheetIndex(sheetId)
    const sheet = this.snapshot.sheets[index]
    const resolvedName = this.uniqueSheetName(name.trim(), sheetId)
    this.model.renameSheet(index, resolvedName)
    sheet.name = resolvedName
    return sheet
  }

  destroy() {
    this.model.free()
  }

  private requireSheetIndex(sheetId: string) {
    const index = this.snapshot.sheets.findIndex(sheet => sheet.id === sheetId)
    if (index < 0) throw new Error(`Unknown worksheet ${sheetId}`)
    return index
  }

  private uniqueSheetName(name: string, excludedSheetId?: string) {
    const names = new Set(this.snapshot.sheets
      .filter(sheet => sheet.id !== excludedSheetId)
      .map(sheet => sheet.name.toLocaleLowerCase()))
    const base = name.slice(0, 31)
    let candidate = base
    let suffix = 2
    while (names.has(candidate.toLocaleLowerCase())) {
      const suffixText = ` ${suffix++}`
      candidate = `${base.slice(0, 31 - suffixText.length)}${suffixText}`
    }
    return candidate
  }

  private rebuildEngine() {
    this.model.free()
    const ModelConstructor = this.model.constructor as typeof Model
    this.model = new ModelConstructor(this.snapshot.name, 'en', 'UTC', 'en')
    this.model.pauseEvaluation()
    this.snapshot.sheets.forEach((sheet, sheetIndex) => {
      if (sheetIndex > 0) this.model.newSheet()
      this.model.renameSheet(sheetIndex, sheet.name)
      for (const [address, cell] of Object.entries(sheet.cells)) {
        const position = parseCellAddress(address)
        if (position) this.model.setUserInput(sheetIndex, position.row, position.column, cell.input)
      }
    })
    this.model.resumeEvaluation()
    this.model.evaluate()
    this.model.setSelectedSheet(this.selectedSheetIndex)
  }

  private captureEngineCells(sheetIndex: number, extraRows = 0, extraColumns = 0) {
    const previous = this.snapshot.sheets[sheetIndex]
    const { maxRow, maxColumn } = sheetBounds(previous)
    const cells: SpreadsheetSheetSnapshot['cells'] = {}
    for (let row = 1; row <= maxRow + extraRows; row += 1) {
      for (let column = 1; column <= maxColumn + extraColumns; column += 1) {
        const input = this.model.getCellContent(sheetIndex, row, column)
        if (input) cells[cellAddress(row, column)] = { input }
      }
    }
    return cells
  }
}
