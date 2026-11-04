<script setup lang="ts">
import {
  ActionButton,
  ActionDropdownButton,
  ActionMenuButton,
  ColorPicker,
  MenuCheckboxItem,
  Separator,
  useLocale,
} from '@langeditor/core'
import {
  Baseline,
  Bold,
  Columns3,
  Eraser,
  FileDown,
  FileUp,
  Italic,
  Merge,
  PaintBucket,
  Plus,
  Rows3,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  TextWrap,
  Underline,
} from '@lucide/vue'
import { computed, onUnmounted, ref } from 'vue'
import type {
  SpreadsheetDocumentSession,
  SpreadsheetHorizontalAlignment,
  SpreadsheetOperation,
} from '../types'

const props = defineProps<{ session: SpreadsheetDocumentSession }>()
const { t } = useLocale()
const fileInput = ref<HTMLInputElement>()
const busy = ref(false)
const revision = ref(0)
const unsubscribe = props.session.subscribe?.(() => revision.value += 1)

onUnmounted(() => unsubscribe?.())

const state = computed(() => {
  revision.value
  return props.session.getSpreadsheetState()
})
const current = computed(() => state.value.selectionStyle)
const merged = computed(() => state.value.merged)
const canMerge = computed(() => {
  const selection = state.value.selection
  return selection.startRow !== selection.endRow || selection.startColumn !== selection.endColumn
})
const disabled = computed(() => !props.session.editable || busy.value)

const standardFontFamilies = ['Aptos', 'Calibri', 'Microsoft YaHei', 'Georgia', 'Menlo']
const standardFontSizes = [9, 10, 11, 12, 14, 16, 18, 20, 24]
const fontFamilies = computed(() => standardFontFamilies.includes(current.value.fontFamily)
  ? standardFontFamilies
  : [current.value.fontFamily, ...standardFontFamilies])
const fontSizes = computed(() => standardFontSizes.includes(current.value.fontSize)
  ? standardFontSizes
  : [current.value.fontSize, ...standardFontSizes].sort((a, b) => a - b))
const exportActions = [
  {
    format: 'xlsx',
    label: 'spreadsheet.toolbar.exportXlsx',
    shortLabel: 'spreadsheet.toolbar.exportXlsxShort',
  },
  {
    format: 'csv',
    label: 'spreadsheet.toolbar.exportCsv',
    shortLabel: 'spreadsheet.toolbar.exportCsvShort',
  },
] as const
const alignmentActions = [
  { value: 'left', label: 'spreadsheet.toolbar.alignLeft', icon: TextAlignStart },
  { value: 'center', label: 'spreadsheet.toolbar.alignCenter', icon: TextAlignCenter },
  { value: 'right', label: 'spreadsheet.toolbar.alignRight', icon: TextAlignEnd },
] as const

async function apply(operation: SpreadsheetOperation) {
  if (!props.session.editable || busy.value) return
  busy.value = true
  try {
    await props.session.applyOperations([operation], { origin: 'user' })
  } finally {
    busy.value = false
  }
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await apply({ type: 'spreadsheet.import', payload: { source: file } })
  input.value = ''
}

function setFontFamily(family: string) {
  void apply({ type: 'spreadsheet.set-style', payload: { font: { family } } })
}

function setFontSize(size: number) {
  void apply({ type: 'spreadsheet.set-style', payload: { font: { size } } })
}

function setFontColor(color: string | undefined) {
  void apply({
    type: 'spreadsheet.set-style',
    payload: { font: { color: color ?? '#111827' } },
  })
}

function setFillColor(color: string | undefined) {
  void apply({
    type: 'spreadsheet.set-style',
    payload: { fill: { color: color ?? '#ffffff' } },
  })
}

function setAlignment(horizontal: SpreadsheetHorizontalAlignment) {
  void apply({ type: 'spreadsheet.set-style', payload: { alignment: { horizontal } } })
}
</script>

<template>
  <div
    class="flex min-w-0 items-center gap-0.5 overflow-x-auto px-2 py-1"
    role="toolbar"
    :aria-label="t('spreadsheet.toolbar.label')"
  >
    <input
      ref="fileInput"
      accept=".xlsx,.xlsm,.ods,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      aria-hidden="true"
      class="sr-only"
      tabindex="-1"
      type="file"
      @change="importFile"
    >

    <div class="flex shrink-0 items-center gap-0.5">
      <ActionButton
        :action="() => fileInput?.click()"
        :aria-label="t('spreadsheet.toolbar.import')"
        :disabled="disabled"
        :tooltip="t('spreadsheet.toolbar.import')"
      >
        <template #icon><FileUp aria-hidden="true" /></template>
      </ActionButton>
      <ActionButton
        v-for="action in exportActions"
        :key="action.format"
        :action="() => apply({ type: 'spreadsheet.export', payload: { format: action.format } })"
        :aria-label="t(action.label)"
        :disabled="disabled"
        :title="t(action.shortLabel)"
        :tooltip="t(action.label)"
      >
        <template #icon><FileDown aria-hidden="true" /></template>
      </ActionButton>
    </div>

    <Separator class="mx-1 h-5" orientation="vertical" />

    <div class="flex shrink-0 items-center gap-0.5">
      <ActionDropdownButton
        class="w-44"
        btn_class="w-[118px]"
        :disabled="disabled"
        :title="current.fontFamily"
        :tooltip="t('spreadsheet.toolbar.fontFamily')"
      >
        <MenuCheckboxItem
          v-for="font in fontFamilies"
          :key="font"
          :model-value="current.fontFamily === font"
          @select="setFontFamily(font)"
        >
          <span class="truncate" :style="{ fontFamily: font }">{{ font }}</span>
        </MenuCheckboxItem>
      </ActionDropdownButton>

      <ActionDropdownButton
        class="w-24"
        btn_class="w-[68px]"
        :disabled="disabled"
        :title="String(current.fontSize)"
        :tooltip="t('spreadsheet.toolbar.fontSize')"
      >
        <MenuCheckboxItem
          v-for="size in fontSizes"
          :key="size"
          :model-value="current.fontSize === size"
          @select="setFontSize(size)"
        >
          <span>{{ size }}</span>
        </MenuCheckboxItem>
      </ActionDropdownButton>

      <ActionButton
        :action="() => apply({ type: 'spreadsheet.set-style', payload: { font: { bold: !current.bold } } })"
        :aria-label="t('spreadsheet.toolbar.bold')"
        :disabled="disabled"
        :is-active="() => current.bold"
        :tooltip="t('spreadsheet.toolbar.bold')"
      >
        <template #icon><Bold aria-hidden="true" /></template>
      </ActionButton>
      <ActionButton
        :action="() => apply({ type: 'spreadsheet.set-style', payload: { font: { italic: !current.italic } } })"
        :aria-label="t('spreadsheet.toolbar.italic')"
        :disabled="disabled"
        :is-active="() => current.italic"
        :tooltip="t('spreadsheet.toolbar.italic')"
      >
        <template #icon><Italic aria-hidden="true" /></template>
      </ActionButton>
      <ActionButton
        :action="() => apply({ type: 'spreadsheet.set-style', payload: { font: { underline: !current.underline } } })"
        :aria-label="t('spreadsheet.toolbar.underline')"
        :disabled="disabled"
        :is-active="() => current.underline"
        :tooltip="t('spreadsheet.toolbar.underline')"
      >
        <template #icon><Underline aria-hidden="true" /></template>
      </ActionButton>
    </div>

    <Separator class="mx-1 h-5" orientation="vertical" />

    <div class="flex shrink-0 items-center gap-0.5">
      <ColorPicker :disabled="disabled" :model-value="current.fontColor" @change="setFontColor">
        <ActionMenuButton
          class="min-w-11 px-2"
          :aria-label="t('spreadsheet.toolbar.fontColor')"
          :disabled="disabled"
          :tooltip="t('spreadsheet.toolbar.fontColor')"
        >
          <template #prefix>
            <span class="relative flex size-5 items-center justify-center">
              <Baseline aria-hidden="true" />
              <span
                aria-hidden="true"
                class="absolute inset-x-0 bottom-0 h-0.5 rounded-full"
                :style="{ backgroundColor: current.fontColor }"
              />
            </span>
          </template>
        </ActionMenuButton>
      </ColorPicker>
      <ColorPicker highlight :disabled="disabled" :model-value="current.fillColor" @change="setFillColor">
        <ActionMenuButton
          class="min-w-11 px-2"
          :aria-label="t('spreadsheet.toolbar.fillColor')"
          :disabled="disabled"
          :tooltip="t('spreadsheet.toolbar.fillColor')"
        >
          <template #prefix>
            <span class="relative flex size-5 items-center justify-center">
              <PaintBucket aria-hidden="true" />
              <span
                aria-hidden="true"
                class="absolute inset-x-0 bottom-0 h-0.5 rounded-full border border-border"
                :style="{ backgroundColor: current.fillColor }"
              />
            </span>
          </template>
        </ActionMenuButton>
      </ColorPicker>
    </div>

    <Separator class="mx-1 h-5" orientation="vertical" />

    <div class="flex shrink-0 items-center gap-0.5">
      <ActionButton
        v-for="action in alignmentActions"
        :key="action.value"
        :action="() => setAlignment(action.value)"
        :aria-label="t(action.label)"
        :disabled="disabled"
        :is-active="() => current.horizontal === action.value"
        :tooltip="t(action.label)"
      >
        <template #icon><component :is="action.icon" aria-hidden="true" /></template>
      </ActionButton>
      <ActionButton
        :action="() => apply({ type: 'spreadsheet.set-style', payload: { alignment: { wrapText: !current.wrapText } } })"
        :aria-label="t('spreadsheet.toolbar.wrapText')"
        :disabled="disabled"
        :is-active="() => current.wrapText"
        :tooltip="t('spreadsheet.toolbar.wrapText')"
      >
        <template #icon><TextWrap aria-hidden="true" /></template>
      </ActionButton>
      <ActionButton
        :action="() => apply({ type: merged ? 'spreadsheet.unmerge-cells' : 'spreadsheet.merge-cells' })"
        :aria-label="t(merged ? 'spreadsheet.toolbar.unmerge' : 'spreadsheet.toolbar.merge')"
        :disabled="disabled || (!merged && !canMerge)"
        :is-active="() => merged"
        :title="t(merged ? 'spreadsheet.toolbar.unmergeShort' : 'spreadsheet.toolbar.mergeShort')"
        :tooltip="t(merged ? 'spreadsheet.toolbar.unmerge' : 'spreadsheet.toolbar.merge')"
      >
        <template #icon><Merge aria-hidden="true" /></template>
      </ActionButton>
      <ActionButton
        :action="() => apply({ type: 'spreadsheet.clear-formatting' })"
        :aria-label="t('spreadsheet.toolbar.clearFormatting')"
        :disabled="disabled"
        :tooltip="t('spreadsheet.toolbar.clearFormatting')"
      >
        <template #icon><Eraser aria-hidden="true" /></template>
      </ActionButton>
    </div>

    <Separator class="mx-1 h-5" orientation="vertical" />

    <div class="flex shrink-0 items-center gap-0.5">
      <ActionButton
        :action="() => apply({ type: 'spreadsheet.insert-rows' })"
        :aria-label="t('spreadsheet.toolbar.addRow')"
        :disabled="disabled"
        :tooltip="t('spreadsheet.toolbar.addRow')"
      >
        <template #icon><Rows3 aria-hidden="true" /></template>
      </ActionButton>
      <ActionButton
        :action="() => apply({ type: 'spreadsheet.insert-columns' })"
        :aria-label="t('spreadsheet.toolbar.addColumn')"
        :disabled="disabled"
        :tooltip="t('spreadsheet.toolbar.addColumn')"
      >
        <template #icon><Columns3 aria-hidden="true" /></template>
      </ActionButton>
      <ActionButton
        :action="() => apply({ type: 'spreadsheet.add-sheet' })"
        :aria-label="t('spreadsheet.toolbar.addSheet')"
        :disabled="disabled"
        :tooltip="t('spreadsheet.toolbar.addSheet')"
      >
        <template #icon><Plus aria-hidden="true" /></template>
      </ActionButton>
    </div>
  </div>
</template>
