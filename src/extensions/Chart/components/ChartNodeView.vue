<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import type uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { Icon } from '@/components/icons'
import { useLocale } from '@/locales'
import type { ChartAttributes, ChartType } from '../Chart'

const props = defineProps({ ...nodeViewProps })
const { t } = useLocale()
const chartHost = ref<HTMLDivElement | null>(null)
let plot: uPlot | null = null
let UPlot: typeof uPlot | null = null
let renderVersion = 0
let resizeObserver: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null

const palette = ['#4f7ff0', '#2bbd8b', '#f4a321', '#9a6df0', '#e65f73', '#31a6b8']

const chart = computed<ChartAttributes>(() => {
  const attrs = props.node.attrs as ChartAttributes
  const labels = Array.isArray(attrs.labels) ? attrs.labels.map(String) : []
  const datasets = Array.isArray(attrs.datasets)
    ? attrs.datasets
        .filter(dataset => dataset && Array.isArray(dataset.values))
        .map((dataset, index) => ({
          label: String(dataset.label || `Series ${index + 1}`),
          color: dataset.color || palette[index % palette.length],
          values: labels.map((_, valueIndex) => Number(dataset.values[valueIndex]) || 0),
        }))
    : []

  return {
    title: String(attrs.title || ''),
    description: String(attrs.description || ''),
    type: attrs.type === 'line' ? 'line' : 'bar',
    labels,
    datasets,
    note: String(attrs.note || ''),
    height: Math.min(520, Math.max(220, Number(attrs.height) || 300)),
  }
})

const hasData = computed(() => chart.value.labels.length > 0 && chart.value.datasets.length > 0)

function getThemeColors() {
  const editorRoot = chartHost.value?.closest<HTMLElement>('[data-langeditor]')
  const dark = editorRoot?.classList.contains('dark')
  return dark
    ? { text: '#b8bbc2', grid: '#34363b', axis: '#555861', surface: '#232427' }
    : { text: '#6d7077', grid: '#eceef1', axis: '#d9dce1', surface: '#ffffff' }
}

function createCommonOptions(
  width: number,
  height: number
): Pick<uPlot.Options, 'width' | 'height' | 'legend' | 'cursor'> {
  return {
    width,
    height,
    legend: { show: false },
    cursor: {
      drag: { x: false, y: false, setScale: false },
      points: { show: false },
    },
  }
}

function createBarChart(width: number, height: number) {
  const { labels, datasets } = chart.value
  const colors = getThemeColors()
  const seriesCount = datasets.length
  const xValues: number[] = []
  const yValues: number[] = []
  const barColors: string[] = []

  labels.forEach((_, labelIndex) => {
    datasets.forEach((dataset, datasetIndex) => {
      xValues.push(labelIndex * seriesCount + datasetIndex)
      yValues.push(dataset.values[labelIndex] ?? 0)
      barColors.push(dataset.color || palette[datasetIndex % palette.length])
    })
  })

  const centers = labels.map((_, index) => index * seriesCount + (seriesCount - 1) / 2)
  const centerLabels = new Map(centers.map((center, index) => [center, labels[index]]))
  const fillUnit = 3 as uPlot.Series.BarsPathBuilderFacetUnit
  const options: uPlot.Options = {
    ...createCommonOptions(width, height),
    padding: [12, 10, 4, 4],
    scales: {
      x: {
        time: false,
        range: () => [-0.8, Math.max(0, xValues.length - 1) + 0.8],
      },
      y: {
        range: (_plot, min, max) => UPlot!.rangeNum(Math.min(0, min), Math.max(1, max), 0.12, true),
      },
    },
    axes: [
      {
        splits: () => centers,
        values: (_plot, splits) => splits.map(split => centerLabels.get(split) ?? ''),
        stroke: colors.text,
        font: '11px ui-sans-serif, system-ui, sans-serif',
        grid: { show: false },
        ticks: { show: false },
        gap: 10,
        size: 34,
      },
      {
        stroke: colors.text,
        font: '10px ui-sans-serif, system-ui, sans-serif',
        grid: { stroke: colors.grid, width: 1 },
        ticks: { stroke: colors.axis, width: 1, size: 4 },
        size: 42,
      },
    ],
    series: [
      {},
      {
        label: 'Value',
        stroke: 'transparent',
        fill: barColors[0] || palette[0],
        width: 0,
        paths: UPlot!.paths.bars({
          size: [0.72, 72, 3],
          radius: 0.14,
          gap: 1,
          disp: {
            fill: { unit: fillUnit, values: () => barColors },
          },
        }),
        points: { show: false },
      },
    ],
  }

  return new UPlot!(options, [xValues, yValues], chartHost.value!)
}

function createLineChart(width: number, height: number) {
  const { labels, datasets } = chart.value
  const colors = getThemeColors()
  const xValues = labels.map((_, index) => index)
  const options: uPlot.Options = {
    ...createCommonOptions(width, height),
    padding: [12, 10, 4, 4],
    scales: { x: { time: false } },
    axes: [
      {
        splits: () => xValues,
        values: (_plot, splits) => splits.map(split => labels[Math.round(split)] ?? ''),
        stroke: colors.text,
        font: '11px ui-sans-serif, system-ui, sans-serif',
        grid: { show: false },
        ticks: { show: false },
        gap: 10,
        size: 34,
      },
      {
        stroke: colors.text,
        font: '10px ui-sans-serif, system-ui, sans-serif',
        grid: { stroke: colors.grid, width: 1 },
        ticks: { stroke: colors.axis, width: 1, size: 4 },
        size: 42,
      },
    ],
    series: [
      {},
      ...datasets.map((dataset, index) => ({
        label: dataset.label,
        stroke: dataset.color || palette[index % palette.length],
        width: 2,
        points: {
          show: true,
          size: 6,
          width: 2,
          stroke: dataset.color || palette[index % palette.length],
          fill: colors.surface,
        },
      })),
    ],
  }

  const data: uPlot.AlignedData = [xValues, ...datasets.map(dataset => dataset.values)]
  return new UPlot!(options, data, chartHost.value!)
}

async function renderChart() {
  const version = ++renderVersion
  await nextTick()
  if (!chartHost.value || !hasData.value) {
    plot?.destroy()
    plot = null
    return
  }

  // Keep the Tiptap NodeView synchronous, but defer the charting runtime until
  // an actual chart node is mounted. This preserves Mini entry-point splitting
  // without handing VueNodeViewRenderer an unresolved async component.
  const chartModule = await import('uplot')
  if (version !== renderVersion || !chartHost.value) return
  UPlot = chartModule.default

  plot?.destroy()
  chartHost.value.replaceChildren()
  const width = Math.max(280, Math.floor(chartHost.value.clientWidth))
  plot =
    chart.value.type === 'line' ? createLineChart(width, chart.value.height) : createBarChart(width, chart.value.height)
}

function selectChart() {
  if (typeof props.getPos === 'function') props.editor.commands.setNodeSelection(props.getPos())
}

function setType(type: ChartType) {
  props.updateAttributes({ type })
}

watch(() => props.node.attrs, renderChart, { deep: true })

onMounted(() => {
  void renderChart()
  resizeObserver = new ResizeObserver(entries => {
    const width = Math.floor(entries[0]?.contentRect.width ?? 0)
    if (plot && width > 0 && Math.abs(plot.width - width) > 2) {
      plot.setSize({ width, height: chart.value.height })
    }
  })
  if (chartHost.value) resizeObserver.observe(chartHost.value)

  const editorRoot = chartHost.value?.closest<HTMLElement>('[data-langeditor]')
  if (editorRoot) {
    themeObserver = new MutationObserver(() => void renderChart())
    themeObserver.observe(editorRoot, { attributes: true, attributeFilter: ['class'] })
  }
})

onBeforeUnmount(() => {
  renderVersion += 1
  plot?.destroy()
  plot = null
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
})
</script>

<template>
  <NodeViewWrapper
    as="figure"
    :class="[
      'relative my-[26px] rounded-[14px] border border-border bg-background px-[22px] pb-4 pt-5 text-foreground transition-[border-color,box-shadow] duration-[140ms] max-[640px]:px-3.5 max-[640px]:pb-[13px] max-[640px]:pt-4',
      selected && 'border-[#6750ff]/70 shadow-[0_0_0_3px_rgb(103_80_255_/_0.08)]',
    ]"
    contenteditable="false"
    data-drag-handle
    @click="selectChart"
  >
    <header class="flex min-h-[52px] items-start justify-between gap-[18px] max-[640px]:grid">
      <div>
        <strong class="block text-[17px] font-semibold leading-[1.3]">{{ chart.title }}</strong>
        <p v-if="chart.description" class="m-0 mt-[5px] text-xs leading-[1.55] text-muted-foreground">{{ chart.description }}</p>
      </div>
      <div
        v-if="editor.isEditable && selected"
        class="flex items-center gap-[3px] rounded-[9px] border border-border bg-muted/50 p-[3px]"
        @mousedown.prevent
      >
        <button
          :class="[
            'inline-flex h-[30px] items-center gap-[5px] rounded-md px-[9px] text-[11px] text-muted-foreground transition-[color,background-color,transform] hover:bg-background hover:text-foreground active:scale-[0.97] max-[640px]:w-[30px] max-[640px]:justify-center max-[640px]:px-0',
            chart.type === 'bar' && 'bg-background text-foreground',
          ]"
          type="button"
          @click="setType('bar')"
        >
          <Icon name="ChartColumn" />
          <span class="max-[640px]:hidden">{{ t('editor.chart.bar') }}</span>
        </button>
        <button
          :class="[
            'inline-flex h-[30px] items-center gap-[5px] rounded-md px-[9px] text-[11px] text-muted-foreground transition-[color,background-color,transform] hover:bg-background hover:text-foreground active:scale-[0.97] max-[640px]:w-[30px] max-[640px]:justify-center max-[640px]:px-0',
            chart.type === 'line' && 'bg-background text-foreground',
          ]"
          type="button"
          @click="setType('line')"
        >
          <Icon name="ChartLine" />
          <span class="max-[640px]:hidden">{{ t('editor.chart.line') }}</span>
        </button>
        <button
          :aria-label="t('editor.chart.remove')"
          class="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md px-0 text-[11px] text-muted-foreground transition-[color,background-color,transform] hover:bg-background hover:text-foreground active:scale-[0.97]"
          type="button"
          @click="deleteNode"
        >
          <Icon name="Trash2" />
        </button>
      </div>
    </header>

    <div v-if="hasData" ref="chartHost" class="mt-2 w-full min-w-0 overflow-hidden" data-chart-canvas></div>
    <div v-else class="mt-2 grid h-[220px] place-items-center border-t border-border text-xs text-muted-foreground">{{ t('editor.chart.empty') }}</div>

    <div class="flex min-h-8 flex-wrap items-center justify-center gap-x-[18px] gap-y-2 text-[11px] text-muted-foreground" :aria-label="t('editor.chart.legend')">
      <span v-for="(dataset, index) in chart.datasets" :key="`${dataset.label}-${index}`" class="inline-flex items-center gap-1.5">
        <i class="h-2 w-2 rounded-sm" :style="{ backgroundColor: dataset.color || palette[index % palette.length] }"></i>
        {{ dataset.label }}
      </span>
    </div>
    <figcaption v-if="chart.note" class="mt-2 border-t border-border pt-2.5 text-[10px] leading-[1.5] text-muted-foreground">{{ chart.note }}</figcaption>
  </NodeViewWrapper>
</template>

<style scoped>
[data-chart-canvas] :deep(.uplot) {
  max-width: 100%;
  font-family: inherit;
}

[data-chart-canvas] :deep(canvas) {
  display: block;
}

</style>
