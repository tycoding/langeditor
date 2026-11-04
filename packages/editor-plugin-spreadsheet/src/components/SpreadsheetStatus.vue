<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useLocale } from '@langeditor/core'
import type { SpreadsheetDocumentSession } from '../types'

const props = defineProps<{ session: SpreadsheetDocumentSession }>()
const { t } = useLocale()
const revision = ref(0)
const unsubscribe = props.session.subscribe?.(() => revision.value += 1)
onUnmounted(() => unsubscribe?.())

const status = computed(() => {
  revision.value
  const state = props.session.getSpreadsheetState()
  const { selection, value } = state
  const sheetIndex = Math.max(0, value.sheets.findIndex(sheet => sheet.id === selection.sheetId))
  const selectedCells =
    (selection.endRow - selection.startRow + 1) *
    (selection.endColumn - selection.startColumn + 1)
  const numericValues: number[] = []
  let populatedCells = 0

  for (let row = selection.startRow; row <= selection.endRow; row += 1) {
    for (let column = selection.startColumn; column <= selection.endColumn; column += 1) {
      const formatted = props.session.getFormattedCellValue(selection.sheetId, row, column).trim()
      if (!formatted) continue
      populatedCells += 1
      const numeric = Number(formatted.replaceAll(',', ''))
      if (Number.isFinite(numeric)) numericValues.push(numeric)
    }
  }

  const sum = numericValues.reduce((total, value) => total + value, 0)
  return {
    sheet: `${sheetIndex + 1} / ${value.sheets.length}`,
    selection: selection.address,
    selectedCells,
    populatedCells,
    numericCount: numericValues.length,
    average: numericValues.length ? sum / numericValues.length : 0,
    sum,
  }
})

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
</script>

<template>
  <div class="flex min-w-0 items-center text-[10px] text-muted-foreground">
    <span class="border-r border-border px-2 pl-0.5">
      {{ t('spreadsheet.status.sheet') }} {{ status.sheet }}
    </span>
    <span class="border-r border-border px-2">
      {{ t('spreadsheet.status.selectionLabel') }} {{ status.selection }}
    </span>
    <span class="border-r border-border px-2">
      {{ t('spreadsheet.status.cells') }} {{ status.selectedCells }}
    </span>
    <span v-if="status.selectedCells > 1" class="border-r border-border px-2">
      {{ t('spreadsheet.status.count') }} {{ status.populatedCells }}
    </span>
    <template v-if="status.numericCount">
      <span class="border-r border-border px-2">
        {{ t('spreadsheet.status.average') }} {{ numberFormatter.format(status.average) }}
      </span>
      <span class="border-r border-border px-2">
        {{ t('spreadsheet.status.sum') }} {{ numberFormatter.format(status.sum) }}
      </span>
    </template>
  </div>
</template>
