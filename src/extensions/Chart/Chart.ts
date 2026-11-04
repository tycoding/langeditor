import { mergeAttributes, Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import type { GeneralOptions } from '@/type'
import ActionButton from '@/components/actions/ActionButton.vue'
import ChartNodeView from './components/ChartNodeView.vue'

export type ChartType = 'bar' | 'line'

export interface ChartDataset {
  label: string
  values: number[]
  color?: string
}

export interface ChartAttributes {
  title: string
  description: string
  type: ChartType
  labels: string[]
  datasets: ChartDataset[]
  note: string
  height: number
}

export interface ChartOptions extends Partial<GeneralOptions<ChartOptions>> {
  HTMLAttributes: Record<string, any>
  defaultChart: ChartAttributes
}

export const DEFAULT_CHART: ChartAttributes = {
  title: 'Sales overview',
  description: 'Quarterly performance grouped by product category.',
  type: 'bar',
  labels: ['Q1', 'Q2', 'Q3', 'Q4'],
  datasets: [
    { label: 'Product', values: [42, 58, 71, 86], color: '#4f7ff0' },
    { label: 'Services', values: [34, 49, 63, 77], color: '#2bbd8b' },
    { label: 'Partners', values: [28, 37, 52, 68], color: '#f4a321' },
  ],
  note: 'Values are illustrative and can be replaced with application data.',
  height: 300,
}

const cloneDefaultChart = (): ChartAttributes => ({
  ...DEFAULT_CHART,
  labels: [...DEFAULT_CHART.labels],
  datasets: DEFAULT_CHART.datasets.map(dataset => ({ ...dataset, values: [...dataset.values] })),
})

function parseJSONAttribute<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    chart: {
      insertChart: (attributes?: Partial<ChartAttributes>) => ReturnType
      updateChart: (attributes: Partial<ChartAttributes>) => ReturnType
    }
  }
}

export const Chart = Node.create<ChartOptions>({
  name: 'chart',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  isolating: true,

  addOptions() {
    return {
      ...this.parent?.(),
      toolbar: true,
      HTMLAttributes: {},
      defaultChart: cloneDefaultChart(),
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.chain().focus().insertChart().run(),
          disabled: !editor.isEditable || !editor.can().insertChart(),
          icon: 'ChartColumn',
          tooltip: t('editor.chart.tooltip'),
        },
      }),
    }
  },

  addAttributes() {
    return {
      title: {
        default: this.options.defaultChart.title,
        parseHTML: element => element.getAttribute('data-chart-title') || this.options.defaultChart.title,
        renderHTML: attributes => ({ 'data-chart-title': attributes.title }),
      },
      description: {
        default: this.options.defaultChart.description,
        parseHTML: element => element.getAttribute('data-chart-description') || '',
        renderHTML: attributes => ({ 'data-chart-description': attributes.description }),
      },
      type: {
        default: this.options.defaultChart.type,
        parseHTML: element => (element.getAttribute('data-chart-kind') === 'line' ? 'line' : 'bar'),
        renderHTML: attributes => ({ 'data-chart-kind': attributes.type }),
      },
      labels: {
        default: this.options.defaultChart.labels,
        parseHTML: element =>
          parseJSONAttribute<string[]>(element.getAttribute('data-chart-labels'), this.options.defaultChart.labels),
        renderHTML: attributes => ({ 'data-chart-labels': JSON.stringify(attributes.labels) }),
      },
      datasets: {
        default: this.options.defaultChart.datasets,
        parseHTML: element =>
          parseJSONAttribute<ChartDataset[]>(
            element.getAttribute('data-chart-datasets'),
            this.options.defaultChart.datasets
          ),
        renderHTML: attributes => ({ 'data-chart-datasets': JSON.stringify(attributes.datasets) }),
      },
      note: {
        default: this.options.defaultChart.note,
        parseHTML: element => element.getAttribute('data-chart-note') || '',
        renderHTML: attributes => ({ 'data-chart-note': attributes.note }),
      },
      height: {
        default: this.options.defaultChart.height,
        parseHTML: element => Number(element.getAttribute('data-chart-height')) || this.options.defaultChart.height,
        renderHTML: attributes => ({ 'data-chart-height': attributes.height }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="chart"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const { title, description, labels, datasets, note } = node.attrs as ChartAttributes
    const summary = datasets
      .map(
        dataset =>
          `${dataset.label}: ${labels.map((label, index) => `${label} ${dataset.values[index] ?? 0}`).join(', ')}`
      )
      .join(' | ')

    return [
      'figure',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'chart' }),
      ['figcaption', {}, title],
      ['p', { 'data-chart-description-text': '' }, description],
      ['p', { 'data-chart-summary': '' }, summary],
      ['small', {}, note],
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(ChartNodeView)
  },

  addCommands() {
    return {
      insertChart:
        attributes =>
        ({ commands }) => {
          const defaults = cloneDefaultChart()
          const next = {
            ...defaults,
            ...attributes,
            labels: attributes?.labels ? [...attributes.labels] : defaults.labels,
            datasets: attributes?.datasets
              ? attributes.datasets.map(dataset => ({ ...dataset, values: [...dataset.values] }))
              : defaults.datasets,
          }
          return commands.insertContent({ type: this.name, attrs: next })
        },
      updateChart:
        attributes =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attributes),
    }
  },
})
