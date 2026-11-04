<script setup lang="ts">
import initIronCalc, { Model } from '@ironcalc/wasm'
import ironCalcWasmUrl from '@ironcalc/wasm/wasm_bg.wasm?url'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { AlertTriangle, Plus, X } from '@lucide/vue'
import {
  ActionButton,
  useLocale,
  type LcDocumentAIContext,
  type LcDocumentOperation,
  type LcDocumentPageLayout,
  type LcDocumentSource,
  type LcDocumentValue,
  type LcLicenseState,
} from '@langeditor/core'
import type {
  SpreadsheetDocumentSession,
  SpreadsheetImportDiagnostic,
  SpreadsheetOperation,
  SpreadsheetPluginOptions,
  SpreadsheetRangeSelection,
  SpreadsheetSheetSnapshot,
  SpreadsheetWorkbookSnapshot,
} from '../types'
import {
  DEFAULT_COLUMNS,
  DEFAULT_ROWS,
  SpreadsheetWorkbookModel,
  cellAddress,
  clonePageLayout,
  cloneWorkbookSnapshot,
  columnLabel,
  createSelection,
  createWorkbookSnapshot,
  isWorkbookSnapshot,
  normalizeWorkbookSnapshot,
  parseCellAddress,
  sheetBounds,
} from '../model/workbook'
import { exportCsv, selectedSheet } from '../serializers/csv'
import { importDocumentSource } from '../serializers/source'
import { exportXlsx } from '../serializers/xlsx'

const props = withDefaults(
  defineProps<{
    mode: string
    modelValue?: LcDocumentValue
    source?: LcDocumentSource
    options?: Record<string, unknown>
    disabled?: boolean
    dark?: boolean
    theme?: string
    license?: LcLicenseState
  }>(),
  {
    options: () => ({}),
  }
)

const emit = defineEmits<{
  (event: 'ready', detail: { session: SpreadsheetDocumentSession }): void
  (event: 'update:modelValue', value: SpreadsheetWorkbookSnapshot): void
  (event: 'change', detail: { value: SpreadsheetWorkbookSnapshot; session: SpreadsheetDocumentSession }): void
  (event: 'error', error: Error): void
}>()

const { t } = useLocale()
const workbook = shallowRef<SpreadsheetWorkbookModel>()
const session = shallowRef<SpreadsheetDocumentSession>()
const revision = ref(0)
const diagnostics = ref<SpreadsheetImportDiagnostic[]>([])
const selection = ref<SpreadsheetRangeSelection>()
const grid = ref<HTMLElement>()
const formulaInput = ref<HTMLInputElement>()
const inlineInput = ref<HTMLInputElement>()
const sheetRenameInput = ref<HTMLInputElement>()
const scrollTop = ref(0)
const scrollLeft = ref(0)
const viewportWidth = ref(800)
const viewportHeight = ref(400)
const editing = ref(false)
const editValue = ref('')
const renamingSheetId = ref<string>()
const sheetRenameValue = ref('')
const sheetRenameError = ref('')
const initialized = ref(false)
const initializing = ref(false)
const engineError = shallowRef<Error>()
const ROW_HEIGHT = 26
const COLUMN_WIDTH = 104
const ROW_HEADER_WIDTH = 48
const COLUMN_HEADER_HEIGHT = 28
const OVERSCAN = 3
let resizeObserver: ResizeObserver | undefined
let pointerSelecting = false
let selectionAnchor: { row: number; column: number } | undefined
let internalUpdate = false
let destroyed = false
const listeners = new Set<() => void>()

const pluginOptions = computed<SpreadsheetPluginOptions>(() => {
  const root = props.options as SpreadsheetPluginOptions & { spreadsheet?: SpreadsheetPluginOptions }
  return root.spreadsheet ?? root
})
const snapshot = computed(() => {
  revision.value
  return workbook.value?.value
})
const activeSheet = computed(() => snapshot.value && selectedSheet(snapshot.value))
const activeSelection = computed(() => selection.value)
const rowCount = computed(() => {
  const bounds = activeSheet.value ? sheetBounds(activeSheet.value) : { maxRow: 1 }
  const configured = Number(snapshot.value?.metadata?.viewportRows ?? pluginOptions.value.initialRows ?? DEFAULT_ROWS)
  return Math.max(configured, bounds.maxRow + 20)
})
const columnCount = computed(() => {
  const bounds = activeSheet.value ? sheetBounds(activeSheet.value) : { maxColumn: 1 }
  const configured = Number(
    snapshot.value?.metadata?.viewportColumns ?? pluginOptions.value.initialColumns ?? DEFAULT_COLUMNS
  )
  return Math.max(configured, bounds.maxColumn + 8)
})
const visibleRows = computed(() => {
  const start = Math.max(1, Math.floor(Math.max(0, scrollTop.value - COLUMN_HEADER_HEIGHT) / ROW_HEIGHT) + 1 - OVERSCAN)
  const count = Math.ceil(viewportHeight.value / ROW_HEIGHT) + OVERSCAN * 2
  return Array.from({ length: Math.min(count, rowCount.value - start + 1) }, (_, index) => start + index)
})
const visibleColumns = computed(() => {
  const start = Math.max(1, Math.floor(Math.max(0, scrollLeft.value - ROW_HEADER_WIDTH) / COLUMN_WIDTH) + 1 - OVERSCAN)
  const count = Math.ceil(viewportWidth.value / COLUMN_WIDTH) + OVERSCAN * 2
  return Array.from({ length: Math.min(count, columnCount.value - start + 1) }, (_, index) => start + index)
})
const formulaValue = computed(() => {
  revision.value
  if (!workbook.value || !selection.value) return ''
  return workbook.value.getCellInput(selection.value.sheetId, selection.value.startRow, selection.value.startColumn)
})

function notify(options: { emitUpdate?: boolean; emitChange?: boolean } = {}) {
  revision.value += 1
  listeners.forEach(listener => listener())
  if (!workbook.value || !session.value) return
  if (options.emitUpdate === false && options.emitChange === false) return
  const value = cloneWorkbookSnapshot(workbook.value.value)
  internalUpdate = true
  if (options.emitUpdate !== false) emit('update:modelValue', value)
  if (options.emitChange !== false) emit('change', { value, session: session.value })
  queueMicrotask(() => (internalUpdate = false))
}

function updateSelection(next: SpreadsheetRangeSelection, shouldFocus = false) {
  if (!workbook.value) return
  workbook.value.setSelection(next)
  selection.value = next
  notify({ emitUpdate: false, emitChange: false })
  if (shouldFocus) nextTick(() => grid.value?.focus())
}

function mergeAt(row: number, column: number) {
  return activeSheet.value?.merges?.find(
    merge => row >= merge.startRow && row <= merge.endRow && column >= merge.startColumn && column <= merge.endColumn
  )
}

function selectCell(row: number, column: number, extend = false) {
  if (!activeSheet.value) return
  const merge = !extend ? mergeAt(row, column) : undefined
  if (merge) {
    updateSelection(
      createSelection(activeSheet.value, merge.startRow, merge.startColumn, merge.endRow, merge.endColumn),
      true
    )
    return
  }
  const anchor =
    extend && selection.value ? { row: selection.value.startRow, column: selection.value.startColumn } : { row, column }
  updateSelection(createSelection(activeSheet.value, anchor.row, anchor.column, row, column), true)
}

function startPointerSelection(row: number, column: number, event: MouseEvent) {
  if (event.button !== 0) return
  pointerSelecting = true
  selectionAnchor =
    event.shiftKey && selection.value
      ? { row: selection.value.startRow, column: selection.value.startColumn }
      : { row, column }
  selectCell(row, column, event.shiftKey)
}

function extendPointerSelection(row: number, column: number) {
  if (!pointerSelecting || !selectionAnchor || !activeSheet.value) return
  updateSelection(createSelection(activeSheet.value, selectionAnchor.row, selectionAnchor.column, row, column))
}

function stopPointerSelection() {
  pointerSelecting = false
  selectionAnchor = undefined
}

function cellSelected(row: number, column: number) {
  const range = selection.value
  return Boolean(
    range && row >= range.startRow && row <= range.endRow && column >= range.startColumn && column <= range.endColumn
  )
}

function cellActive(row: number, column: number) {
  const range = selection.value
  return range?.startRow === row && range.startColumn === column
}

function rowHeaderSelected(row: number) {
  const range = selection.value
  return Boolean(range && row >= range.startRow && row <= range.endRow)
}

function columnHeaderSelected(column: number) {
  const range = selection.value
  return Boolean(range && column >= range.startColumn && column <= range.endColumn)
}

function cellCoveredByMerge(row: number, column: number) {
  const merge = mergeAt(row, column)
  return Boolean(merge && (merge.startRow !== row || merge.startColumn !== column))
}

function cssColor(value: unknown) {
  const rgb = typeof value === 'string' ? value : isRecord(value) && typeof value.rgb === 'string' ? value.rgb : ''
  const normalized = rgb.replace(/^#/, '').slice(-6)
  return /^[0-9a-f]{6}$/i.test(normalized) ? `#${normalized}` : undefined
}

function cellVisualStyle(row: number, column: number): Record<string, string> {
  if (!workbook.value || !activeSheet.value) return {}
  const merge = mergeAt(row, column)
  const style = workbook.value.getCellStyle(activeSheet.value.id, row, column)
  const font = isRecord(style?.font) ? style.font : {}
  const fill = isRecord(style?.fill) ? style.fill : {}
  const alignment = isRecord(style?.alignment) ? style.alignment : {}
  const horizontal = alignment.horizontal
  const vertical = alignment.vertical
  const width = COLUMN_WIDTH * (merge ? merge.endColumn - merge.startColumn + 1 : 1)
  const height = ROW_HEIGHT * (merge ? merge.endRow - merge.startRow + 1 : 1)
  const result: Record<string, string> = {
    left: `${ROW_HEADER_WIDTH + (column - 1) * COLUMN_WIDTH}px`,
    top: `${COLUMN_HEADER_HEIGHT + (row - 1) * ROW_HEIGHT}px`,
    width: `${width}px`,
    height: `${height}px`,
  }
  if (typeof font.name === 'string' && font.name) result.fontFamily = font.name
  if (typeof font.sz === 'number') result.fontSize = `${font.sz}px`
  if (font.bold) result.fontWeight = '700'
  if (font.italic) result.fontStyle = 'italic'
  if (font.underline) result.textDecoration = 'underline'
  const fontColor = cssColor(font.color)
  const fillColor = cssColor(fill.fgColor)
  if (fontColor) result['--spreadsheet-cell-color'] = fontColor
  if (fillColor) result['--spreadsheet-cell-fill'] = fillColor
  if (horizontal === 'center') result.justifyContent = 'center'
  else if (horizontal === 'right') result.justifyContent = 'flex-end'
  else if (horizontal === 'left') result.justifyContent = 'flex-start'
  else if (
    /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?%?$/.test(
      workbook.value.getFormattedValue(activeSheet.value.id, row, column).replaceAll(',', '')
    )
  )
    result.justifyContent = 'flex-end'
  if (vertical === 'top') result.alignItems = 'flex-start'
  else if (vertical === 'center') result.alignItems = 'center'
  else if (vertical === 'bottom') result.alignItems = 'flex-end'
  if (alignment.wrapText) {
    result.whiteSpace = 'normal'
    result.lineHeight = '1.25'
  }
  return result
}

function cellDisplay(row: number, column: number) {
  if (!workbook.value || !activeSheet.value) return ''
  return workbook.value.getFormattedValue(activeSheet.value.id, row, column)
}

function commitValue(value: string) {
  if (!workbook.value || !selection.value || props.disabled) return
  workbook.value.setCell(selection.value.sheetId, selection.value.startRow, selection.value.startColumn, value)
  editing.value = false
  notify()
}

function beginInlineEdit(initial?: string) {
  if (props.disabled || !selection.value) return
  editValue.value = initial ?? formulaValue.value
  editing.value = true
  nextTick(() => {
    inlineInput.value?.focus()
    inlineInput.value?.select()
  })
}

function inlineStyle() {
  if (!selection.value) return {}
  const merge = mergeAt(selection.value.startRow, selection.value.startColumn)
  return {
    left: `${ROW_HEADER_WIDTH + (selection.value.startColumn - 1) * COLUMN_WIDTH}px`,
    top: `${COLUMN_HEADER_HEIGHT + (selection.value.startRow - 1) * ROW_HEIGHT}px`,
    width: `${COLUMN_WIDTH * (merge ? merge.endColumn - merge.startColumn + 1 : 1)}px`,
    height: `${ROW_HEIGHT * (merge ? merge.endRow - merge.startRow + 1 : 1)}px`,
  }
}

function ensureCellVisible(row: number, column: number) {
  const host = grid.value
  if (!host) return
  const left = ROW_HEADER_WIDTH + (column - 1) * COLUMN_WIDTH
  const top = COLUMN_HEADER_HEIGHT + (row - 1) * ROW_HEIGHT
  if (left < host.scrollLeft + ROW_HEADER_WIDTH) host.scrollLeft = Math.max(0, left - ROW_HEADER_WIDTH)
  else if (left + COLUMN_WIDTH > host.scrollLeft + host.clientWidth)
    host.scrollLeft = left + COLUMN_WIDTH - host.clientWidth
  if (top < host.scrollTop + COLUMN_HEADER_HEIGHT) host.scrollTop = Math.max(0, top - COLUMN_HEADER_HEIGHT)
  else if (top + ROW_HEIGHT > host.scrollTop + host.clientHeight) host.scrollTop = top + ROW_HEIGHT - host.clientHeight
}

function moveSelection(rowDelta: number, columnDelta: number, extend = false) {
  if (!selection.value || !activeSheet.value) return
  const row = Math.max(1, Math.min(rowCount.value, selection.value.startRow + rowDelta))
  const column = Math.max(1, Math.min(columnCount.value, selection.value.startColumn + columnDelta))
  if (extend) {
    updateSelection(
      createSelection(
        activeSheet.value,
        selection.value.startRow,
        selection.value.startColumn,
        Math.max(1, selection.value.endRow + rowDelta),
        Math.max(1, selection.value.endColumn + columnDelta)
      )
    )
  } else selectCell(row, column)
  ensureCellVisible(row, column)
}

function handleGridKeydown(event: KeyboardEvent) {
  if (editing.value) return
  const movement: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  }
  if (movement[event.key]) {
    event.preventDefault()
    moveSelection(...movement[event.key], event.shiftKey)
    return
  }
  if (event.key === 'Enter' || event.key === 'F2') {
    event.preventDefault()
    beginInlineEdit()
  } else if ((event.key === 'Delete' || event.key === 'Backspace') && !props.disabled) {
    event.preventDefault()
    if (workbook.value && selection.value) {
      workbook.value.clearRange(selection.value)
      notify()
    }
  } else if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1) {
    event.preventDefault()
    beginInlineEdit(event.key)
  }
}

function handleScroll(event: Event) {
  const target = event.currentTarget as HTMLElement
  scrollTop.value = target.scrollTop
  scrollLeft.value = target.scrollLeft
}

function observeGrid(element?: HTMLElement) {
  resizeObserver?.disconnect()
  resizeObserver = undefined
  if (!element || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(entries => {
    viewportWidth.value = entries[0].contentRect.width
    viewportHeight.value = entries[0].contentRect.height
  })
  resizeObserver.observe(element)
}

function selectSheet(sheetId: string) {
  if (!workbook.value) return
  workbook.value.setSelectedSheet(sheetId)
  const sheet = workbook.value.selectedSheet
  selection.value = createSelection(sheet, 1, 1)
  notify()
}

function beginSheetRename(sheet: SpreadsheetSheetSnapshot) {
  if (props.disabled) return
  if (sheet.id !== snapshot.value?.selectedSheetId) selectSheet(sheet.id)
  renamingSheetId.value = sheet.id
  sheetRenameValue.value = sheet.name
  sheetRenameError.value = ''
  nextTick(() => {
    sheetRenameInput.value?.focus()
    sheetRenameInput.value?.select()
  })
}

function setSheetRenameInput(element: unknown) {
  sheetRenameInput.value = element instanceof HTMLInputElement ? element : undefined
}

function cancelSheetRename() {
  renamingSheetId.value = undefined
  sheetRenameValue.value = ''
  sheetRenameError.value = ''
}

async function commitSheetRename() {
  const sheetId = renamingSheetId.value
  const name = sheetRenameValue.value.trim()
  if (!sheetId) return
  if (!name || name.length > 31 || /[\\/?*:[\]]/.test(name)) {
    sheetRenameError.value = t.value('spreadsheet.sheet.renameInvalid')
    nextTick(() => {
      sheetRenameInput.value?.focus()
      sheetRenameInput.value?.select()
    })
    return
  }
  const current = workbook.value?.value.sheets.find(sheet => sheet.id === sheetId)
  if (current?.name === name) {
    cancelSheetRename()
    return
  }
  try {
    await applyOperations([{ type: 'spreadsheet.rename-sheet', payload: { sheetId, name } }])
    cancelSheetRename()
  } catch (error) {
    sheetRenameError.value = error instanceof Error ? error.message : t.value('spreadsheet.sheet.renameInvalid')
  }
}

function dismissDiagnostic(index: number) {
  diagnostics.value.splice(index, 1)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function positiveInteger(value: unknown, maximum = 1_048_576) {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= maximum
}

function validateOperations(operations: LcDocumentOperation[]): asserts operations is SpreadsheetOperation[] {
  const supported = new Set([
    'spreadsheet.set-cell',
    'spreadsheet.set-range',
    'spreadsheet.clear-range',
    'spreadsheet.insert-rows',
    'spreadsheet.insert-columns',
    'spreadsheet.add-sheet',
    'spreadsheet.rename-sheet',
    'spreadsheet.set-style',
    'spreadsheet.clear-formatting',
    'spreadsheet.merge-cells',
    'spreadsheet.unmerge-cells',
    'spreadsheet.select-range',
    'spreadsheet.import',
    'spreadsheet.export',
  ])
  if (
    operations.length > 1 &&
    operations.some(operation => operation.type === 'spreadsheet.import' || operation.type === 'spreadsheet.export')
  ) {
    throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
  }
  const sheetIds = new Set(workbook.value?.value.sheets.map(sheet => sheet.id) ?? [])
  const sheetExists = (payload: Record<string, unknown>) =>
    payload.sheetId === undefined || (typeof payload.sheetId === 'string' && sheetIds.has(payload.sheetId))
  for (const operation of operations) {
    if (!supported.has(operation.type)) throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
    const payload = operation.payload
    switch (operation.type) {
      case 'spreadsheet.set-cell':
        if (
          !isRecord(payload) ||
          !sheetExists(payload) ||
          !positiveInteger(payload.row) ||
          !positiveInteger(payload.column, 16_384) ||
          typeof payload.input !== 'string'
        ) {
          throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
        }
        break
      case 'spreadsheet.set-range': {
        if (
          !isRecord(payload) ||
          !sheetExists(payload) ||
          !positiveInteger(payload.row) ||
          !positiveInteger(payload.column, 16_384) ||
          !Array.isArray(payload.values)
        ) {
          throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
        }
        const values = payload.values as unknown[]
        const validRows = values.every(row => Array.isArray(row) && row.every(value => typeof value === 'string'))
        const cellCount = values.reduce<number>((count, row) => count + (Array.isArray(row) ? row.length : 0), 0)
        const maxColumns = values.reduce<number>(
          (maximum, row) => Math.max(maximum, Array.isArray(row) ? row.length : 0),
          0
        )
        if (
          !validRows ||
          cellCount < 1 ||
          cellCount > 10_000 ||
          Number(payload.row) + values.length - 1 > 1_048_576 ||
          Number(payload.column) + maxColumns - 1 > 16_384
        ) {
          throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
        }
        break
      }
      case 'spreadsheet.clear-range':
        if (
          payload !== undefined &&
          (!isRecord(payload) ||
            !sheetExists(payload) ||
            (payload.sheetId !== undefined && payload.sheetId !== selection.value?.sheetId))
        ) {
          throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
        }
        break
      case 'spreadsheet.insert-rows':
        if (
          payload !== undefined &&
          (!isRecord(payload) ||
            !sheetExists(payload) ||
            (payload.row !== undefined && !positiveInteger(payload.row)) ||
            (payload.count !== undefined && !positiveInteger(payload.count, 1_000)) ||
            (typeof payload.row === 'number' &&
              typeof payload.count === 'number' &&
              payload.row + payload.count - 1 > 1_048_576))
        ) {
          throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
        }
        break
      case 'spreadsheet.insert-columns':
        if (
          payload !== undefined &&
          (!isRecord(payload) ||
            !sheetExists(payload) ||
            (payload.column !== undefined && !positiveInteger(payload.column, 16_384)) ||
            (payload.count !== undefined && !positiveInteger(payload.count, 1_000)) ||
            (typeof payload.column === 'number' &&
              typeof payload.count === 'number' &&
              payload.column + payload.count - 1 > 16_384))
        ) {
          throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
        }
        break
      case 'spreadsheet.add-sheet':
        if (
          payload !== undefined &&
          (!isRecord(payload) ||
            (payload.name !== undefined &&
              (typeof payload.name !== 'string' || payload.name.length > 31 || /[\\/?*:[\]]/.test(payload.name))))
        ) {
          throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
        }
        break
      case 'spreadsheet.rename-sheet':
        if (
          !isRecord(payload) ||
          !sheetExists(payload) ||
          typeof payload.name !== 'string' ||
          !payload.name.trim() ||
          payload.name.trim().length > 31 ||
          /[\\/?*:[\]]/.test(payload.name)
        ) {
          throw new Error(t.value('spreadsheet.sheet.renameInvalid'))
        }
        break
      case 'spreadsheet.set-style': {
        if (!isRecord(payload)) throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
        const font = payload.font
        const fill = payload.fill
        const alignment = payload.alignment
        const validFont =
          font === undefined ||
          (isRecord(font) &&
            (font.family === undefined || (typeof font.family === 'string' && font.family.length <= 80)) &&
            (font.size === undefined || (typeof font.size === 'number' && font.size >= 8 && font.size <= 72)) &&
            (font.bold === undefined || typeof font.bold === 'boolean') &&
            (font.italic === undefined || typeof font.italic === 'boolean') &&
            (font.underline === undefined || typeof font.underline === 'boolean') &&
            (font.color === undefined || (typeof font.color === 'string' && /^#[0-9a-f]{6}$/i.test(font.color))))
        const validFill =
          fill === undefined ||
          (isRecord(fill) &&
            (fill.color === undefined || (typeof fill.color === 'string' && /^#[0-9a-f]{6}$/i.test(fill.color))))
        const validAlignment =
          alignment === undefined ||
          (isRecord(alignment) &&
            (alignment.horizontal === undefined ||
              ['general', 'left', 'center', 'right'].includes(String(alignment.horizontal))) &&
            (alignment.vertical === undefined || ['top', 'center', 'bottom'].includes(String(alignment.vertical))) &&
            (alignment.wrapText === undefined || typeof alignment.wrapText === 'boolean'))
        if (!validFont || !validFill || !validAlignment) {
          throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
        }
        break
      }
      case 'spreadsheet.clear-formatting':
      case 'spreadsheet.merge-cells':
      case 'spreadsheet.unmerge-cells':
        if (payload !== undefined && (!isRecord(payload) || Object.keys(payload).length > 0)) {
          throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
        }
        break
      case 'spreadsheet.select-range':
        if (
          !isRecord(payload) ||
          typeof payload.sheetId !== 'string' ||
          !sheetIds.has(payload.sheetId) ||
          !positiveInteger(payload.startRow) ||
          !positiveInteger(payload.endRow) ||
          !positiveInteger(payload.startColumn, 16_384) ||
          !positiveInteger(payload.endColumn, 16_384) ||
          Number(payload.startRow) > Number(payload.endRow) ||
          Number(payload.startColumn) > Number(payload.endColumn)
        ) {
          throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
        }
        break
      case 'spreadsheet.import':
        if (!isRecord(payload) || payload.source === undefined || payload.source === null) {
          throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
        }
        break
      case 'spreadsheet.export':
        if (!isRecord(payload) || (payload.format !== 'xlsx' && payload.format !== 'csv')) {
          throw new Error(t.value('spreadsheet.error.unsupportedOperation'))
        }
        break
    }
  }
}

async function applyOperations(operations: LcDocumentOperation[]) {
  if (!workbook.value || !selection.value) return
  validateOperations(operations)
  const before = cloneWorkbookSnapshot(workbook.value.value)
  const beforeSelection = { ...selection.value }
  let documentChanged = false
  let stateChanged = false
  try {
    for (const operation of operations as SpreadsheetOperation[]) {
      switch (operation.type) {
        case 'spreadsheet.set-cell': {
          const currentSheetId = operation.payload.sheetId ?? selection.value.sheetId
          workbook.value.setCell(
            currentSheetId,
            operation.payload.row,
            operation.payload.column,
            operation.payload.input
          )
          documentChanged = true
          break
        }
        case 'spreadsheet.set-range': {
          const currentSheetId = operation.payload.sheetId ?? selection.value.sheetId
          operation.payload.values.forEach((row, rowOffset) =>
            row.forEach((input, columnOffset) => {
              workbook.value?.setCell(
                currentSheetId,
                operation.payload.row + rowOffset,
                operation.payload.column + columnOffset,
                input
              )
            })
          )
          documentChanged = true
          break
        }
        case 'spreadsheet.clear-range':
          workbook.value.clearRange(selection.value)
          documentChanged = true
          break
        case 'spreadsheet.insert-rows': {
          const currentSheetId = operation.payload?.sheetId ?? selection.value.sheetId
          workbook.value.insertRows(
            currentSheetId,
            operation.payload?.row ?? selection.value.startRow,
            operation.payload?.count ?? 1
          )
          documentChanged = true
          break
        }
        case 'spreadsheet.insert-columns': {
          const currentSheetId = operation.payload?.sheetId ?? selection.value.sheetId
          workbook.value.insertColumns(
            currentSheetId,
            operation.payload?.column ?? selection.value.startColumn,
            operation.payload?.count ?? 1
          )
          documentChanged = true
          break
        }
        case 'spreadsheet.add-sheet': {
          const sheet = workbook.value.addSheet(operation.payload?.name)
          selection.value = createSelection(sheet, 1, 1)
          documentChanged = true
          break
        }
        case 'spreadsheet.rename-sheet': {
          const sheetId = operation.payload.sheetId ?? selection.value.sheetId
          const sheet = workbook.value.renameSheet(sheetId, operation.payload.name)
          if (selection.value.sheetId === sheetId) {
            selection.value = { ...selection.value, sheetName: sheet.name }
          }
          documentChanged = true
          break
        }
        case 'spreadsheet.set-style':
          workbook.value.setRangeStyle(selection.value, operation.payload)
          documentChanged = true
          break
        case 'spreadsheet.clear-formatting':
          workbook.value.clearRangeFormatting(selection.value)
          documentChanged = true
          break
        case 'spreadsheet.merge-cells':
          workbook.value.mergeRange(selection.value)
          documentChanged = true
          break
        case 'spreadsheet.unmerge-cells':
          workbook.value.unmergeRange(selection.value)
          documentChanged = true
          break
        case 'spreadsheet.select-range': {
          const sheet = workbook.value.value.sheets.find(item => item.id === operation.payload.sheetId)
          if (!sheet) throw new Error(`Unknown worksheet ${operation.payload.sheetId}`)
          selection.value = createSelection(
            sheet,
            operation.payload.startRow,
            operation.payload.startColumn,
            operation.payload.endRow,
            operation.payload.endColumn
          )
          workbook.value.setSelection(selection.value)
          stateChanged = true
          break
        }
        case 'spreadsheet.import': {
          const imported = await importDocumentSource(operation.payload.source)
          workbook.value.setSnapshot(imported.value)
          diagnostics.value = imported.diagnostics
          selection.value = createSelection(workbook.value.selectedSheet, 1, 1)
          documentChanged = true
          break
        }
        case 'spreadsheet.export':
          await downloadExport(operation.payload.format)
          break
      }
    }
  } catch (error) {
    workbook.value.setSnapshot(before)
    selection.value = beforeSelection
    workbook.value.setSelection(beforeSelection)
    throw error
  }
  if (documentChanged) notify()
  else if (stateChanged) notify({ emitUpdate: false, emitChange: false })
}

async function downloadExport(format: 'xlsx' | 'csv') {
  if (!workbook.value) return
  const current = workbook.value.value
  const data = format === 'xlsx' ? await exportXlsx(current) : exportCsv(selectedSheet(current))
  const type =
    format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8'
  const blob = new Blob([data], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${current.name.replace(/[\\/:*?"<>|]+/g, '-') || 'Workbook'}.${format}`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function createSession(): SpreadsheetDocumentSession {
  const id = globalThis.crypto?.randomUUID?.() ?? `spreadsheet-${Date.now()}`
  return {
    id,
    mode: 'spreadsheet',
    kind: 'spreadsheet',
    get editable() {
      return !props.disabled && !destroyed
    },
    getValue: () => cloneWorkbookSnapshot(workbook.value!.value),
    setValue: async (value, options) => {
      if (!isWorkbookSnapshot(value)) throw new Error('Invalid spreadsheet snapshot')
      workbook.value!.setSnapshot(normalizeWorkbookSnapshot(value, pluginOptions.value))
      selection.value = createSelection(workbook.value!.selectedSheet, 1, 1)
      notify({ emitUpdate: options?.emitUpdate, emitChange: options?.emitUpdate })
    },
    getSelection: () => (selection.value ? { ...selection.value } : null),
    getAIContext: (options: Record<string, unknown> = {}): LcDocumentAIContext => {
      const current = selection.value!
      const requestedSheetId = typeof options.sheetId === 'string' ? options.sheetId : current.sheetId
      const sheet = workbook.value!.value.sheets.find(item => item.id === requestedSheetId)
      if (!sheet)
        return { kind: 'spreadsheet-range', text: '', data: { cells: [] }, metadata: { error: 'sheet-not-found' } }
      const limit = Math.max(1, Math.min(500, Number(options.limit) || pluginOptions.value.maxContextCells || 400))
      const includeFormats = options.includeFormats === true
      const makeCellForSheet = (sheetId: string, row: number, column: number, withFormats: boolean) => ({
        address: cellAddress(row, column),
        input: workbook.value!.getCellInput(sheetId, row, column),
        formatted: workbook.value!.getFormattedValue(sheetId, row, column),
        ...(withFormats ? { style: workbook.value!.getCellStyle(sheetId, row, column) ?? {} } : {}),
      })
      const makeCell = (row: number, column: number) => makeCellForSheet(sheet.id, row, column, includeFormats)
      const rows: Array<Array<{ address: string; input: string; formatted: string; style?: Record<string, unknown> }>> =
        []
      let count = 0
      let truncated = false

      if (typeof options.term === 'string' && options.term.trim()) {
        const term = options.term.toLocaleLowerCase()
        const matches: Array<Array<ReturnType<typeof makeCell> & { sheetId: string; sheetName: string }>> = []
        for (const candidate of workbook.value!.value.sheets) {
          for (const address of Object.keys(candidate.cells)) {
            const position = parseCellAddress(address)
            if (!position) continue
            const input = workbook.value!.getCellInput(candidate.id, position.row, position.column)
            const formatted = workbook.value!.getFormattedValue(candidate.id, position.row, position.column)
            if (!input.toLocaleLowerCase().includes(term) && !formatted.toLocaleLowerCase().includes(term)) continue
            if (count >= limit) {
              truncated = true
              break
            }
            matches.push([
              {
                ...makeCellForSheet(candidate.id, position.row, position.column, includeFormats),
                sheetId: candidate.id,
                sheetName: candidate.name,
              },
            ])
            count += 1
          }
          if (truncated) break
        }
        return {
          kind: 'spreadsheet-search',
          text: matches
            .flat()
            .map(cell => `${cell.sheetName}!${cell.address}: ${cell.formatted}`)
            .join('\n'),
          data: { cells: matches, term: options.term },
          metadata: { truncated, cellCount: count },
        }
      }

      const addresses = Array.isArray(options.addresses)
        ? options.addresses.filter((value): value is string => typeof value === 'string').slice(0, limit)
        : undefined
      if (addresses) {
        for (const address of addresses) {
          const position = parseCellAddress(address)
          if (!position) continue
          rows.push([makeCell(position.row, position.column)])
          count += 1
        }
        return {
          kind: 'spreadsheet-cells',
          text: rows
            .flat()
            .map(cell => `${cell.address}: ${cell.formatted}`)
            .join('\n'),
          data: { sheet: sheet.name, sheetId: sheet.id, cells: rows },
          metadata: { truncated: addresses.length < (options.addresses as unknown[]).length, cellCount: count },
        }
      }

      const startRow = positiveInteger(options.startRow) ? Number(options.startRow) : current.startRow
      const startColumn = positiveInteger(options.startColumn, 16_384)
        ? Number(options.startColumn)
        : current.startColumn
      const endRow = positiveInteger(options.endRow) ? Number(options.endRow) : current.endRow
      const endColumn = positiveInteger(options.endColumn, 16_384) ? Number(options.endColumn) : current.endColumn
      for (let row = startRow; row <= endRow; row += 1) {
        const values: Array<ReturnType<typeof makeCell>> = []
        for (let column = startColumn; column <= endColumn; column += 1) {
          if (count >= limit) {
            truncated = true
            break
          }
          values.push(makeCell(row, column))
          count += 1
        }
        if (values.length) rows.push(values)
        if (truncated) break
      }
      return {
        kind: 'spreadsheet-range',
        text: rows.map(row => row.map(cell => cell.formatted).join('\t')).join('\n'),
        data: {
          sheet: sheet.name,
          sheetId: sheet.id,
          range: `${cellAddress(startRow, startColumn)}:${cellAddress(endRow, endColumn)}`,
          cells: rows,
        },
        metadata: { truncated, cellCount: count },
      }
    },
    validateOperations: operations => validateOperations(operations),
    applyOperations,
    getPageLayout: () => clonePageLayout(workbook.value!.value.pageLayout),
    setPageLayout: (layout: LcDocumentPageLayout) => {
      workbook.value!.value.pageLayout = clonePageLayout(layout)
      notify()
    },
    focus: () => grid.value?.focus(),
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    destroy: () => {
      if (destroyed) return
      destroyed = true
      listeners.clear()
      workbook.value?.destroy()
      workbook.value = undefined
    },
    getSpreadsheetState: () => ({
      value: cloneWorkbookSnapshot(workbook.value!.value),
      selection: { ...selection.value! },
      selectionStyle: workbook.value!.getSelectionStyle(selection.value!),
      merged: workbook.value!.isRangeMerged(selection.value!),
      diagnostics: [...diagnostics.value],
    }),
    setActiveSheet: selectSheet,
    setRangeSelection: next => updateSelection(next),
    getFormattedCellValue: (sheetId, row, column) => workbook.value!.getFormattedValue(sheetId, row, column),
  }
}

function handleNameBoxChange(event: Event) {
  const position = parseCellAddress((event.target as HTMLInputElement).value)
  if (position) selectCell(position.row, position.column)
}

function handleFormulaCommit(event: Event) {
  commitValue((event.target as HTMLInputElement).value)
}

function handleFormulaEnter(event: KeyboardEvent) {
  commitValue((event.target as HTMLInputElement).value)
  grid.value?.focus()
}

function handleCellDoubleClick(row: number, column: number) {
  selectCell(row, column)
  beginInlineEdit()
}

function handleInlineEditEnter() {
  commitValue(editValue.value)
  moveSelection(1, 0)
}

function handleInlineEditEscape() {
  editing.value = false
  grid.value?.focus()
}

async function initialize() {
  if (initializing.value || initialized.value) return
  initializing.value = true
  engineError.value = undefined
  try {
    await initIronCalc({ module_or_path: ironCalcWasmUrl })
    let initial = isWorkbookSnapshot(props.modelValue)
      ? normalizeWorkbookSnapshot(props.modelValue, pluginOptions.value)
      : createWorkbookSnapshot(pluginOptions.value)
    if (props.source) {
      const imported = await importDocumentSource(props.source)
      initial = imported.value
      diagnostics.value = imported.diagnostics
    }
    workbook.value = SpreadsheetWorkbookModel.create(Model, initial)
    selection.value = createSelection(workbook.value.selectedSheet, 1, 1)
    workbook.value.setSelection(selection.value)
    session.value = createSession()
    initialized.value = true
    emit('ready', { session: session.value })
    notify({ emitChange: false })
  } catch (error) {
    const resolvedError = error instanceof Error ? error : new Error(String(error))
    engineError.value = resolvedError
    emit('error', resolvedError)
  } finally {
    initializing.value = false
  }
}

watch(
  () => props.modelValue,
  value => {
    if (!initialized.value || internalUpdate || !workbook.value || !isWorkbookSnapshot(value)) return
    workbook.value.setSnapshot(normalizeWorkbookSnapshot(value, pluginOptions.value))
    selection.value = createSelection(workbook.value.selectedSheet, 1, 1)
    notify({ emitUpdate: false, emitChange: false })
  },
  { deep: false }
)

watch(grid, element => observeGrid(element))

watch(
  () => props.source,
  async (source, previous) => {
    if (!initialized.value || !source || source === previous || !workbook.value) return
    try {
      const imported = await importDocumentSource(source)
      workbook.value.setSnapshot(imported.value)
      diagnostics.value = imported.diagnostics
      selection.value = createSelection(workbook.value.selectedSheet, 1, 1)
      notify()
    } catch (error) {
      emit('error', error instanceof Error ? error : new Error(String(error)))
    }
  }
)

onMounted(() => {
  window.addEventListener('pointerup', stopPointerSelection)
  initialize()
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerup', stopPointerSelection)
  resizeObserver?.disconnect()
  session.value?.destroy?.()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background" data-spreadsheet-surface>
    <div
      v-if="initialized && activeSelection"
      class="flex h-9 flex-none items-center border-b border-border bg-background"
    >
      <label class="sr-only" for="spreadsheet-name-box">{{ t('spreadsheet.formula.name') }}</label>
      <input
        id="spreadsheet-name-box"
        class="h-full w-24 flex-none border-0 border-r border-border bg-background px-2 text-center text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        :aria-label="t('spreadsheet.formula.name')"
        :value="activeSelection.address"
        @change="handleNameBoxChange"
      />
      <span aria-hidden="true" class="w-9 flex-none text-center text-xs font-semibold italic text-muted-foreground"
        >fx</span
      >
      <label class="sr-only" for="spreadsheet-formula-input">{{ t('spreadsheet.formula.input') }}</label>
      <input
        id="spreadsheet-formula-input"
        ref="formulaInput"
        class="h-full min-w-0 flex-1 border-0 border-l border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        :aria-label="t('spreadsheet.formula.input')"
        :disabled="disabled"
        :placeholder="t('spreadsheet.formula.placeholder')"
        :value="formulaValue"
        @keydown.enter.prevent="handleFormulaEnter"
        @blur="handleFormulaCommit"
      />
    </div>

    <div
      v-if="diagnostics.length"
      class="flex flex-none items-start gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
      role="status"
    >
      <AlertTriangle aria-hidden="true" class="mt-0.5 h-3.5 w-3.5 flex-none" />
      <div class="min-w-0 flex-1 space-y-1">
        <div
          v-for="(diagnostic, index) in diagnostics"
          :key="`${diagnostic.code}-${index}`"
          class="flex items-start gap-2"
        >
          <span class="min-w-0 flex-1">{{ t(`spreadsheet.diagnostic.${diagnostic.code}`) }}</span>
          <ActionButton
            custom-class="h-6 min-w-6 w-6"
            :action="() => dismissDiagnostic(index)"
            :aria-label="t('spreadsheet.diagnostic.dismiss')"
            :tooltip="t('spreadsheet.diagnostic.dismiss')"
          >
            <template #icon><X aria-hidden="true" /></template>
          </ActionButton>
        </div>
      </div>
    </div>

    <div
      v-if="initialized && activeSheet"
      ref="grid"
      class="spreadsheet-grid relative min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      role="grid"
      tabindex="0"
      :aria-label="t('spreadsheet.aria.grid')"
      :aria-rowcount="rowCount"
      :aria-colcount="columnCount"
      @keydown="handleGridKeydown"
      @scroll="handleScroll"
    >
      <div
        class="relative"
        :style="{
          width: `${ROW_HEADER_WIDTH + columnCount * COLUMN_WIDTH}px`,
          height: `${COLUMN_HEADER_HEIGHT + rowCount * ROW_HEIGHT}px`,
        }"
      >
        <div
          v-for="column in visibleColumns"
          :key="`column-${column}`"
          class="spreadsheet-column-header"
          :class="{ 'is-selected': columnHeaderSelected(column) }"
          role="columnheader"
          :style="{
            left: `${ROW_HEADER_WIDTH + (column - 1) * COLUMN_WIDTH}px`,
            top: `${scrollTop}px`,
            width: `${COLUMN_WIDTH}px`,
          }"
        >
          {{ columnLabel(column) }}
        </div>
        <div
          v-for="row in visibleRows"
          :key="`row-${row}`"
          class="spreadsheet-row-header"
          :class="{ 'is-selected': rowHeaderSelected(row) }"
          role="rowheader"
          :style="{
            left: `${scrollLeft}px`,
            top: `${COLUMN_HEADER_HEIGHT + (row - 1) * ROW_HEIGHT}px`,
            height: `${ROW_HEIGHT}px`,
          }"
        >
          {{ row }}
        </div>
        <div
          class="spreadsheet-corner"
          aria-hidden="true"
          :style="{ left: `${scrollLeft}px`, top: `${scrollTop}px` }"
        />
        <template v-for="row in visibleRows" :key="`cells-${row}`">
          <template v-for="column in visibleColumns" :key="cellAddress(row, column)">
            <div
              v-if="!cellCoveredByMerge(row, column)"
              :class="[
                'spreadsheet-cell',
                { 'is-selected': cellSelected(row, column), 'is-active': cellActive(row, column) },
              ]"
              role="gridcell"
              :aria-label="t('spreadsheet.aria.cell').replace('{address}', cellAddress(row, column))"
              :aria-selected="cellSelected(row, column)"
              :style="cellVisualStyle(row, column)"
              @dblclick="handleCellDoubleClick(row, column)"
              @mouseenter="extendPointerSelection(row, column)"
              @mousedown.prevent="startPointerSelection(row, column, $event)"
            >
              {{ cellDisplay(row, column) }}
            </div>
          </template>
        </template>
        <input
          v-if="editing"
          ref="inlineInput"
          v-model="editValue"
          class="spreadsheet-inline-editor"
          :style="inlineStyle()"
          @blur="commitValue(editValue)"
          @keydown.enter.prevent="handleInlineEditEnter"
          @keydown.esc.prevent="handleInlineEditEscape"
        />
      </div>
    </div>

    <div
      v-else-if="engineError"
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
      role="alert"
    >
      <AlertTriangle aria-hidden="true" class="h-5 w-5 text-destructive" />
      <p class="text-sm font-medium text-foreground">{{ t('spreadsheet.error.engine') }}</p>
      <button
        class="inline-flex h-8 items-center justify-center rounded border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        :disabled="initializing"
        @click="initialize"
      >
        {{ t('spreadsheet.error.retry') }}
      </button>
    </div>

    <div
      v-else
      class="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
      role="status"
    >
      <span class="spreadsheet-loading-indicator motion-reduce:animate-none" aria-hidden="true" />
      {{ t('spreadsheet.loading') }}
    </div>

    <div
      v-if="initialized && snapshot"
      class="flex h-9 flex-none items-center overflow-x-auto border-t border-border bg-muted/30 px-1"
    >
      <template v-for="sheet in snapshot.sheets" :key="sheet.id">
        <input
          v-if="renamingSheetId === sheet.id"
          :ref="setSheetRenameInput"
          v-model="sheetRenameValue"
          class="spreadsheet-sheet-rename"
          type="text"
          maxlength="31"
          :aria-label="t('spreadsheet.sheet.renameInput').replace('{name}', sheet.name)"
          :aria-invalid="Boolean(sheetRenameError)"
          :disabled="disabled"
          :title="sheetRenameError || t('spreadsheet.sheet.renameHint')"
          @blur="commitSheetRename"
          @keydown.enter.prevent="commitSheetRename"
          @keydown.esc.prevent="cancelSheetRename"
        />
        <button
          v-else
          class="spreadsheet-sheet-tab"
          type="button"
          :aria-label="t('spreadsheet.sheet.select').replace('{name}', sheet.name)"
          :aria-pressed="sheet.id === snapshot.selectedSheetId"
          :title="t('spreadsheet.sheet.renameHint')"
          @click="selectSheet(sheet.id)"
          @dblclick.stop="beginSheetRename(sheet)"
        >
          {{ sheet.name }}
        </button>
      </template>
      <span class="sr-only" role="status" aria-live="polite">{{ sheetRenameError }}</span>
      <ActionButton
        custom-class="ml-1"
        :action="() => applyOperations([{ type: 'spreadsheet.add-sheet' }])"
        :aria-label="t('spreadsheet.sheet.add')"
        :disabled="disabled"
        :tooltip="t('spreadsheet.sheet.add')"
      >
        <template #icon><Plus aria-hidden="true" /></template>
      </ActionButton>
    </div>
  </div>
</template>
