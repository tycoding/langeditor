import {
  AlignmentType,
  BorderStyle,
  CommentRangeEnd,
  CommentRangeStart,
  CommentReference,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  Header,
  Paragraph,
  SectionType,
  ShadingType,
  SimpleField,
  TabStopPosition,
  TabStopType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type IParagraphOptions,
  type IRunOptions,
} from 'docx'
import {
  defaultAsyncNodes,
  defaultMarks,
  DocxSerializerAsync,
  type DocxSerializerStateAsync,
  type NodeSerializerAsync,
  type OptionsAsync,
  type SectionConfig,
} from 'prosemirror-docx'
import type { EditorInstance as Editor, WordComment } from '@langeditor/core'
import { getWordExportFallbacks, type WordExportFallbackContent } from './fallback'

const DOCX_PAGE = {
  width: 11906,
  height: 16838,
  margin: {
    top: 1020,
    right: 1134,
    bottom: 1020,
    left: 1134,
    header: 567,
    footer: 567,
    gutter: 0,
  },
}

const DOCX_CONTENT_WIDTH = DOCX_PAGE.width - DOCX_PAGE.margin.left - DOCX_PAGE.margin.right
const DOCX_BODY_FONT = {
  ascii: 'Arial',
  hAnsi: 'Arial',
  eastAsia: 'Microsoft YaHei',
  cs: 'Arial',
}
const DOCX_BODY_RUN: IRunOptions = {
  font: DOCX_BODY_FONT,
  size: 23,
}
const DOCX_BODY_SPACING = {
  after: 160,
  line: 400,
}
const DOCX_TABLE_MARGINS = {
  top: 100,
  bottom: 100,
  left: 140,
  right: 140,
}
const DOCX_TABLE_BORDER = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: 'D7D9DC',
}

function normalizeColor(value?: string) {
  if (!value) return undefined
  const normalized = value.trim()
  const rgb = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  const color = rgb
    ? rgb
        .slice(1, 4)
        .map(component => Math.min(255, Number(component)).toString(16).padStart(2, '0'))
        .join('')
    : normalized.replace('#', '')
  return /^[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : undefined
}

function cssSizeToHalfPoints(value?: string) {
  if (!value) return undefined
  const number = Number.parseFloat(value)
  if (!Number.isFinite(number)) return undefined
  const points = value.toLowerCase().endsWith('px') ? (number * 72) / 96 : number
  return Math.max(1, Math.round(points * 2))
}

function paragraphOptions(node: any): IParagraphOptions {
  const attrs = node.attrs ?? {}
  const options: any = {
    autoSpaceEastAsianText: true,
    widowControl: true,
    wordWrap: true,
    spacing: { ...DOCX_BODY_SPACING },
    run: { ...DOCX_BODY_RUN },
  }
  const alignment = attrs.textAlign
  if (alignment === 'center') options.alignment = AlignmentType.CENTER
  if (alignment === 'right') options.alignment = AlignmentType.RIGHT
  if (alignment === 'justify') options.alignment = AlignmentType.JUSTIFIED
  if (attrs.lineHeight) {
    const lineHeight = Number.parseFloat(String(attrs.lineHeight))
    if (Number.isFinite(lineHeight)) {
      options.spacing = { ...DOCX_BODY_SPACING, line: Math.round((lineHeight / 100) * 240) }
    }
  }
  return options
}

function textStyleMark(_state: unknown, _node: any, mark: any): IRunOptions {
  const attrs = mark.attrs ?? {}
  const color = normalizeColor(attrs.color)
  const fontSize = cssSizeToHalfPoints(attrs.fontSize)
  const fontFamily = attrs.fontFamily ? String(attrs.fontFamily).split(',')[0].trim().replace(/["']/g, '') : undefined
  return {
    color,
    size: fontSize,
    font: fontFamily,
  }
}

function highlightMark(_state: unknown, _node: any, mark: any): IRunOptions {
  const color = normalizeColor(mark.attrs?.color)
  return color
    ? {
        shading: {
          type: ShadingType.SOLID,
          color,
          fill: color,
        },
      }
    : {}
}

function imageTypeFromSource(src: string): 'png' | 'jpg' | 'gif' | 'bmp' | undefined {
  const mime = src.match(/^data:image\/([a-z0-9.+-]+);/i)?.[1]?.toLowerCase()
  if (mime === 'jpeg') return 'jpg'
  if (mime === 'png' || mime === 'jpg' || mime === 'gif' || mime === 'bmp') return mime
  const extension = src.split('?')[0].split('.').pop()?.toLowerCase()
  if (extension === 'jpeg') return 'jpg'
  return extension === 'png' || extension === 'jpg' || extension === 'gif' || extension === 'bmp'
    ? extension
    : undefined
}

function imageWidthPercent(node: any) {
  const width = node.attrs?.width
  if (typeof width === 'string' && width.trim().endsWith('%')) {
    const percent = Number.parseFloat(width)
    return Number.isFinite(percent) ? Math.min(100, Math.max(1, percent)) : 70
  }
  if (typeof width === 'number' && Number.isFinite(width)) {
    return Math.min(100, Math.max(1, (width / 600) * 100))
  }
  return 70
}

function imageAlignment(node: any): 'left' | 'center' | 'right' {
  return node.attrs?.textAlign === 'left' || node.attrs?.textAlign === 'right' ? node.attrs.textAlign : 'center'
}

function chartText(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function escapeXml(value: unknown) {
  return chartText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function chartColor(value: unknown, fallback: string) {
  const color = chartText(value).trim()
  return /^#[0-9a-f]{6}$/i.test(color) || /^#[0-9a-f]{3}$/i.test(color) ? color : fallback
}

function normalizedChart(attrs: any) {
  const labels = Array.isArray(attrs.labels) ? attrs.labels.map(chartText) : []
  const palette = ['#4f7ff0', '#2bbd8b', '#f4a321', '#9a6df0', '#e65f73', '#31a6b8']
  const datasets = Array.isArray(attrs.datasets)
    ? attrs.datasets
        .filter((dataset: any) => dataset && Array.isArray(dataset.values))
        .map((dataset: any, index: number) => ({
          label: chartText(dataset.label) || `Series ${index + 1}`,
          color: chartColor(dataset.color, palette[index % palette.length]),
          values: labels.map((_: string, valueIndex: number) => {
            const value = Number(dataset.values[valueIndex])
            return Number.isFinite(value) ? value : 0
          }),
        }))
    : []
  return {
    type: attrs.type === 'line' ? 'line' : 'bar',
    labels,
    datasets,
    height: Math.min(520, Math.max(220, Number(attrs.height) || 300)),
  }
}

/**
 * Draw the same lightweight chart model used by the editor into an SVG. The
 * SVG is rasterized in the browser before it is handed to docx, avoiding any
 * server-side conversion dependency while keeping the image sharp in Word.
 */
function chartSvg(attrs: any) {
  const chart = normalizedChart(attrs)
  const width = 1100
  const height = chart.height + 112
  const margin = { top: 24, right: 30, bottom: 70, left: 78 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const values = chart.datasets.flatMap((dataset: any) => dataset.values)
  const max = Math.max(1, ...values, 0)
  const min = Math.min(0, ...values, 0)
  const range = max - min || 1
  const y = (value: number) => margin.top + ((max - value) / range) * plotHeight
  const x = (index: number) =>
    chart.labels.length <= 1
      ? margin.left + plotWidth / 2
      : margin.left + (index / (chart.labels.length - 1)) * plotWidth
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = min + ((max - min) * index) / 4
    const yy = y(value)
    return `<line x1="${margin.left}" y1="${yy.toFixed(2)}" x2="${width - margin.right}" y2="${yy.toFixed(2)}" stroke="#e5e7eb" stroke-width="1"/><text x="${margin.left - 12}" y="${(yy + 4).toFixed(2)}" text-anchor="end" fill="#6b7280" font-size="18" font-family="Arial, sans-serif">${escapeXml(Math.round(value * 100) / 100)}</text>`
  }).join('')
  const labels = chart.labels
    .map(
      (label: string, index: number) =>
        `<text x="${x(index).toFixed(2)}" y="${height - 34}" text-anchor="middle" fill="#4b5563" font-size="18" font-family="Arial, sans-serif">${escapeXml(label)}</text>`
    )
    .join('')
  const series =
    chart.type === 'line'
      ? chart.datasets
          .map((dataset: any) => {
            const points = dataset.values
              .map((value: number, index: number) => `${x(index).toFixed(2)},${y(value).toFixed(2)}`)
              .join(' ')
            const dots = dataset.values
              .map(
                (value: number, index: number) =>
                  `<circle cx="${x(index).toFixed(2)}" cy="${y(value).toFixed(2)}" r="5" fill="#ffffff" stroke="${dataset.color}" stroke-width="3"/>`
              )
              .join('')
            return `<polyline points="${points}" fill="none" stroke="${dataset.color}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>${dots}`
          })
          .join('')
      : (() => {
          const groupWidth = chart.labels.length ? plotWidth / chart.labels.length : plotWidth
          const barWidth = Math.max(8, (groupWidth * 0.72) / Math.max(1, chart.datasets.length))
          return chart.datasets
            .map((dataset: any, datasetIndex: number) =>
              dataset.values
                .map((value: number, index: number) => {
                  const base = y(Math.max(0, min))
                  const top = y(Math.max(min, value))
                  const barHeight = Math.max(1, Math.abs(base - top))
                  const left = margin.left + index * groupWidth + groupWidth * 0.14 + datasetIndex * barWidth
                  return `<rect x="${left.toFixed(2)}" y="${Math.min(base, top).toFixed(2)}" width="${Math.max(2, barWidth - 4).toFixed(2)}" height="${barHeight.toFixed(2)}" rx="3" fill="${dataset.color}"/>`
                })
                .join('')
            )
            .join('')
        })()
  const legend = chart.datasets
    .map((dataset: any, index: number) => {
      const offset = margin.left + index * Math.max(150, (plotWidth - 20) / Math.max(1, chart.datasets.length))
      return `<rect x="${offset}" y="${height - 18}" width="14" height="14" rx="3" fill="${dataset.color}"/><text x="${offset + 22}" y="${height - 5}" fill="#4b5563" font-size="18" font-family="Arial, sans-serif">${escapeXml(dataset.label)}</text>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ffffff"/><line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#d1d5db"/><line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#d1d5db"/>${grid}${series}${labels}${legend}</svg>`
}

async function chartImageDataUrl(attrs: any) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('Chart image export requires a browser canvas')
  }
  const svg = chartSvg(attrs)
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Failed to render chart image'))
      element.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth || 1100
    canvas.height = image.naturalHeight || 412
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Browser canvas is unavailable')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function chartTableCell(value: unknown, bold = false) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ ...DOCX_BODY_RUN, text: chartText(value), bold })],
      }),
    ],
    margins: DOCX_TABLE_MARGINS,
    verticalAlign: VerticalAlignTable.CENTER,
    shading: bold ? { type: ShadingType.SOLID, color: 'F4F5F6', fill: 'F4F5F6' } : undefined,
    borders: {
      top: DOCX_TABLE_BORDER,
      bottom: DOCX_TABLE_BORDER,
      left: DOCX_TABLE_BORDER,
      right: DOCX_TABLE_BORDER,
    },
  })
}

async function serializeChart(state: any, node: any) {
  const attrs = node.attrs ?? {}
  const labels = Array.isArray(attrs.labels) ? attrs.labels.map(chartText) : []
  const datasets = Array.isArray(attrs.datasets) ? attrs.datasets : []
  const title = chartText(attrs.title)
  const description = chartText(attrs.description)
  const note = chartText(attrs.note)

  if (labels.length && datasets.length && typeof document !== 'undefined' && typeof Image !== 'undefined') {
    state.nextParentParagraphOpts = undefined
    state.nextRunOpts = undefined
    if (title)
      state.children.push(new Paragraph({ children: [new TextRun({ ...DOCX_BODY_RUN, text: title, bold: true })] }))
    if (description)
      state.children.push(new Paragraph({ children: [new TextRun({ ...DOCX_BODY_RUN, text: description })] }))
    await state.image(await chartImageDataUrl(attrs), 100, 'center', undefined, 'png')
    state.closeBlock(node)
    if (note)
      state.children.push(new Paragraph({ children: [new TextRun({ ...DOCX_BODY_RUN, text: note, italics: true })] }))
    return
  }

  // Keep non-browser/SSR serialization deterministic when canvas is unavailable.
  if (title)
    state.children.push(new Paragraph({ children: [new TextRun({ ...DOCX_BODY_RUN, text: title, bold: true })] }))
  if (description)
    state.children.push(new Paragraph({ children: [new TextRun({ ...DOCX_BODY_RUN, text: description })] }))
  const rows = [
    new TableRow({
      children: [chartTableCell('', true), ...labels.map(label => chartTableCell(label, true))],
      tableHeader: true,
    }),
    ...datasets.map((dataset: any) => {
      const values = Array.isArray(dataset?.values) ? dataset.values : []
      return new TableRow({
        children: [
          chartTableCell(chartText(dataset?.label)),
          ...labels.map((_, index) => chartTableCell(values[index] ?? '')),
        ],
      })
    }),
  ]

  if (rows.length > 1) {
    const columnCount = labels.length + 1
    const width = Math.floor(DOCX_CONTENT_WIDTH / columnCount)
    const columnWidths = Array.from({ length: columnCount }, () => width)
    columnWidths[columnWidths.length - 1] += DOCX_CONTENT_WIDTH - width * columnCount
    state.children.push(
      new Table({
        rows,
        width: { size: DOCX_CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths,
        layout: TableLayoutType.FIXED,
        margins: DOCX_TABLE_MARGINS,
        borders: {
          top: DOCX_TABLE_BORDER,
          bottom: DOCX_TABLE_BORDER,
          left: DOCX_TABLE_BORDER,
          right: DOCX_TABLE_BORDER,
          insideHorizontal: DOCX_TABLE_BORDER,
          insideVertical: DOCX_TABLE_BORDER,
        },
        tableLook: { firstRow: true, noHBand: false, noVBand: true },
      })
    )
  } else if (!title && !description) state.children.push(new Paragraph(''))
  if (note) state.children.push(new Paragraph({ children: [new TextRun({ text: note, italics: true })] }))
}

async function serializeTaskItem(state: any, node: any, commentContext?: CommentSerializationContext) {
  let renderedParagraph = false
  for (let index = 0; index < node.childCount; index += 1) {
    const child = node.child(index)
    if (child.type.name === 'paragraph' && !renderedParagraph) {
      state.addRunOptions({ ...DOCX_BODY_RUN })
      state.text(node.attrs?.checked ? '[x] ' : '[ ] ', { bold: true })
      state.addRunOptions({ ...DOCX_BODY_RUN })
      if (commentContext) await renderInlineWithComments(state, child, commentContext)
      else await state.renderInline(child)
      state.closeBlock(child, paragraphOptions(child))
      renderedParagraph = true
    } else {
      await state.render(child, node, index)
    }
  }
  if (!renderedParagraph) state.closeBlock(node)
}

function tableColumnWidths(node: any) {
  let columnCount = 0
  node.forEach((row: any) => {
    let count = 0
    row.forEach((cell: any) => {
      count += Math.max(1, Number(cell.attrs?.colspan) || 1)
    })
    columnCount = Math.max(columnCount, count)
  })

  if (!columnCount) return []
  const widths = Array.from({ length: columnCount }, () => 0)
  node.forEach((row: any) => {
    let column = 0
    row.forEach((cell: any) => {
      const span = Math.max(1, Number(cell.attrs?.colspan) || 1)
      const rawWidths = Array.isArray(cell.attrs?.colwidth)
        ? cell.attrs.colwidth.map((value: unknown) => Number(value) || 0)
        : [Number(cell.attrs?.colwidth) || 0]
      for (let offset = 0; offset < span; offset += 1) {
        const width = rawWidths[offset] || rawWidths[0] || 0
        if (width > 0) widths[column + offset] = Math.max(widths[column + offset], width * 15)
      }
      column += span
    })
  })

  const fallback = DOCX_CONTENT_WIDTH / columnCount
  const filled = widths.map(width => (width > 0 ? width : fallback))
  const scale = DOCX_CONTENT_WIDTH / filled.reduce((total, width) => total + width, 0)
  const minimum = Math.min(720, Math.floor(DOCX_CONTENT_WIDTH / columnCount))
  const normalized = filled.map(width => Math.max(minimum, Math.round(width * scale)))
  const difference = DOCX_CONTENT_WIDTH - normalized.reduce((total, width) => total + width, 0)
  normalized[normalized.length - 1] += difference
  return normalized
}

async function serializeTable(state: any, node: any) {
  const actualChildren = state.children
  const rows: any[] = []
  const columnWidths = tableColumnWidths(node)

  for (let rowIndex = 0; rowIndex < node.childCount; rowIndex += 1) {
    const row = node.child(rowIndex)
    const cells: any[] = []
    let column = 0
    for (let cellIndex = 0; cellIndex < row.childCount; cellIndex += 1) {
      const cell = row.child(cellIndex)
      state.children = []
      if (cell.type.name === 'tableHeader') state.addRunOptions({ bold: true })
      await state.renderContent(cell)
      const background = normalizeColor(cell.attrs?.backgroundColor)
      const cellOptions: any = { children: state.children }
      const colspan = Math.max(1, Number(cell.attrs?.colspan) || 1)
      if (colspan > 1) cellOptions.columnSpan = colspan
      if (cell.attrs?.rowspan > 1) cellOptions.rowSpan = cell.attrs.rowspan
      const columnWidth = columnWidths.slice(column, column + colspan).reduce((total, width) => total + width, 0)
      if (columnWidth > 0) cellOptions.width = { size: columnWidth, type: WidthType.DXA }
      cellOptions.margins = DOCX_TABLE_MARGINS
      cellOptions.verticalAlign = VerticalAlignTable.CENTER
      if (background) {
        cellOptions.shading = { type: ShadingType.SOLID, color: background, fill: background }
      }
      cells.push(new TableCell(cellOptions))
      column += colspan
    }
    const isHeader =
      row.childCount > 0 &&
      Array.from({ length: row.childCount }).every((_, index) => row.child(index).type.name === 'tableHeader')
    rows.push(new TableRow({ children: cells, tableHeader: isHeader }))
  }

  state.children = actualChildren
  actualChildren.push(
    new Table({
      rows,
      width: { size: DOCX_CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths,
      layout: TableLayoutType.FIXED,
      margins: DOCX_TABLE_MARGINS,
      borders: {
        top: DOCX_TABLE_BORDER,
        bottom: DOCX_TABLE_BORDER,
        left: DOCX_TABLE_BORDER,
        right: DOCX_TABLE_BORDER,
        insideHorizontal: DOCX_TABLE_BORDER,
        insideVertical: DOCX_TABLE_BORDER,
      },
      tableLook: { firstRow: true, noHBand: false, noVBand: true },
    })
  )
  actualChildren.push(new Paragraph(''))
}

interface CommentSerializationContext {
  comments: WordComment[]
  positions: WeakMap<object, number>
  ids: Map<string, number>
}

function commentOffsets(context: CommentSerializationContext, paragraph: any) {
  const paragraphStart = context.positions.get(paragraph)
  if (paragraphStart === undefined) return []
  const contentStart = paragraphStart + 1
  const contentEnd = contentStart + paragraph.content.size
  return context.comments.flatMap(comment => {
    const id = context.ids.get(comment.id)
    if (id === undefined) return []
    const boundaries: Array<{ offset: number; kind: 'start' | 'end'; id: number }> = []
    if (comment.from >= contentStart && comment.from <= contentEnd)
      boundaries.push({ offset: comment.from - contentStart, kind: 'start', id })
    if (comment.to >= contentStart && comment.to <= contentEnd)
      boundaries.push({ offset: comment.to - contentStart, kind: 'end', id })
    return boundaries
  })
}

async function renderInlineWithComments(state: any, parent: any, context: CommentSerializationContext) {
  const boundaries = commentOffsets(context, parent)
  if (!boundaries.length) {
    await state.renderInline(parent)
    return
  }

  const emitBoundaries = (offset: number) => {
    const matching = boundaries.filter(boundary => boundary.offset === offset)
    for (const boundary of matching.filter(item => item.kind === 'end')) {
      state.current.push(new CommentRangeEnd(boundary.id), new CommentReference(boundary.id))
    }
    for (const boundary of matching.filter(item => item.kind === 'start')) {
      state.current.push(new CommentRangeStart(boundary.id))
    }
  }

  let currentLink: { link: string; stack: any[] } | undefined
  const closeLink = () => {
    if (!currentLink) return
    state.current = [...currentLink.stack, new ExternalHyperlink({ link: currentLink.link, children: state.current })]
    currentLink = undefined
  }
  const openLink = (href: string) => {
    if (currentLink?.link === href) return
    if (currentLink) closeLink()
    state.addRunOptions({ style: 'Hyperlink' })
    currentLink = { link: href, stack: state.current }
    state.current = []
  }

  let offset = 0
  emitBoundaries(0)
  for (let index = 0; index < parent.childCount; index += 1) {
    const child = parent.child(index)
    const link = child.marks.find((mark: any) => mark.type.name === 'link')
    if (link?.attrs?.href) openLink(link.attrs.href)
    else if (currentLink) closeLink()
    if (child.isText) {
      const text = child.text ?? ''
      let segmentStart = 0
      const splitPoints = boundaries
        .map(boundary => boundary.offset - offset)
        .filter(point => point > 0 && point < text.length)
        .sort((a, b) => a - b)
      for (const splitPoint of [...splitPoints, text.length]) {
        const segment = text.slice(segmentStart, splitPoint)
        if (segment) state.text(segment, state.renderMarks(child, [...child.marks]))
        offset += splitPoint - segmentStart
        emitBoundaries(offset)
        segmentStart = splitPoint
      }
    } else {
      await state.render(child, parent, index)
      offset += 1
      emitBoundaries(offset)
    }
  }
  closeLink()
}

function customNodes(commentContext?: CommentSerializationContext): NodeSerializerAsync {
  const nodes: NodeSerializerAsync = {
    ...defaultAsyncNodes,
    paragraph: async (state, node) => {
      state.addRunOptions({ ...DOCX_BODY_RUN })
      if (commentContext) await renderInlineWithComments(state, node, commentContext)
      else await state.renderInline(node)
      state.closeBlock(node, paragraphOptions(node))
    },
    blockquote: async (state, node) => {
      await state.renderContent(node, { style: 'IntenseQuote' })
      // WPS can visually join a following heading to the last quote line when
      // the built-in Intense Quote style is the only boundary between blocks.
      state.children.push(new Paragraph({ spacing: { before: 0, after: 120, line: 240 }, children: [] }))
    },
    heading: async (state, node) => {
      const headingSizes = [48, 36, 29, 25, 23, 23]
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)))
      state.addRunOptions({ ...DOCX_BODY_RUN, size: headingSizes[level - 1], bold: true, color: '171717' })
      await state.renderInline(node)
      state.closeBlock(node, {
        ...paragraphOptions(node),
        spacing: {
          before: level === 1 ? 0 : level === 2 ? 240 : 180,
          after: level === 1 ? 180 : 120,
          line: level === 1 ? 300 : 320,
        },
        run: { ...DOCX_BODY_RUN, size: headingSizes[level - 1], bold: true, color: '171717' },
        heading: [
          HeadingLevel.HEADING_1,
          HeadingLevel.HEADING_2,
          HeadingLevel.HEADING_3,
          HeadingLevel.HEADING_4,
          HeadingLevel.HEADING_5,
          HeadingLevel.HEADING_6,
        ][level - 1],
      })
    },
    bulletList: (state, node, parent, index) => defaultAsyncNodes.bullet_list(state, node, parent, index),
    orderedList: (state, node, parent, index) => defaultAsyncNodes.ordered_list(state, node, parent, index),
    listItem: (state, node, parent, index) => defaultAsyncNodes.list_item(state, node, parent, index),
    taskList: async (state, node) => state.renderContent(node),
    taskItem: (state, node) => serializeTaskItem(state, node, commentContext),
    codeBlock: async (state, node) => {
      const attributeCode = typeof node.attrs?.code === 'string' ? node.attrs.code : ''
      const source = String(attributeCode.length > 0 ? attributeCode : (node.textContent ?? '')).replace(/\r\n?/g, '\n')
      const codeRun: IRunOptions = {
        font: { ascii: 'Consolas', hAnsi: 'Consolas', eastAsia: 'Microsoft YaHei', cs: 'Consolas' },
        size: 20,
        color: '334155',
      }
      // Code blocks must not inherit paragraph alignment or run options from the
      // preceding node. Word otherwise expands each token as justified prose.
      state.nextParentParagraphOpts = undefined
      state.nextRunOpts = undefined
      state.current = []
      source.split('\n').forEach((line: string, lineIndex: number) => {
        state.text(line, { ...codeRun, break: lineIndex > 0 ? 1 : undefined })
      })
      const codeParagraph = new Paragraph({
        children: state.current,
        alignment: AlignmentType.LEFT,
        wordWrap: true,
        widowControl: false,
        autoSpaceEastAsianText: false,
        indent: { left: 180, right: 180 },
        spacing: { before: 160, after: 180, line: 300 },
        shading: { type: ShadingType.SOLID, color: 'F4F6F8', fill: 'F4F6F8' },
        border: {
          top: DOCX_TABLE_BORDER,
          bottom: DOCX_TABLE_BORDER,
          left: { style: BorderStyle.SINGLE, size: 12, color: 'B7C0CC', space: 6 },
          right: DOCX_TABLE_BORDER,
        },
        run: codeRun,
      })
      state.current = []
      state.children.push(codeParagraph)
    },
    image: async (state, node) => {
      await state.image(
        node.attrs?.src,
        imageWidthPercent(node),
        imageAlignment(node),
        undefined,
        imageTypeFromSource(node.attrs?.src || '')
      )
      state.closeBlock(node)
    },
    chart: serializeChart,
    table: serializeTable,
    hardBreak: (state, node, parent, index) => defaultAsyncNodes.hard_break(state, node, parent, index),
    horizontalRule: (state, node, parent, index) => defaultAsyncNodes.horizontal_rule(state, node, parent, index),
    wordPage: async (state, node, parent, index) => {
      await state.renderContent(node)
      if (index < parent.childCount - 1) state.nextSection()
    },
  }
  for (const fallback of getWordExportFallbacks()) {
    nodes[fallback.nodeType] = async (state, node) => {
      const content = fallback.resolve(node)
      if (!content) return
      serializeWordExportFallback(state, content)
    }
  }
  return nodes
}

function serializeWordExportFallback(state: DocxSerializerStateAsync, content: WordExportFallbackContent) {
  const title = content.title.trim()
  const description = content.description?.trim()
  const href = content.href?.trim()
  const actionLabel = content.actionLabel?.trim()
  const children: any[] = []

  if (title) children.push(new TextRun({ ...DOCX_BODY_RUN, text: title, bold: true }))
  if (description) {
    if (children.length) children.push(new TextRun({ ...DOCX_BODY_RUN, text: '\n', break: 1 }))
    children.push(new TextRun({ ...DOCX_BODY_RUN, text: description, color: '5F6773' }))
  }
  if (href) {
    if (children.length) children.push(new TextRun({ ...DOCX_BODY_RUN, text: '\n', break: 1 }))
    children.push(
      new ExternalHyperlink({
        link: href,
        children: [
          new TextRun({
            ...DOCX_BODY_RUN,
            text: actionLabel || href,
            style: 'Hyperlink',
          }),
        ],
      })
    )
  }

  state.current = []
  state.nextParentParagraphOpts = undefined
  state.nextRunOpts = undefined
  state.children.push(
    new Paragraph({
      children: children.length ? children : [new TextRun({ ...DOCX_BODY_RUN, text: '' })],
      spacing: { before: 140, after: 180, line: 320 },
      indent: { left: 180, right: 180 },
      shading: { type: ShadingType.SOLID, color: 'F4F6F8', fill: 'F4F6F8' },
      border: {
        top: DOCX_TABLE_BORDER,
        bottom: DOCX_TABLE_BORDER,
        left: DOCX_TABLE_BORDER,
        right: DOCX_TABLE_BORDER,
      },
    })
  )
}

function headerFooterText(value: unknown, fallback: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || fallback
}

function pageSectionConfig(node: any): SectionConfig {
  const header = node.attrs?.header
  const footer = node.attrs?.footer
  const headerEnabled = Boolean(header?.enabled)
  const footerEnabled = Boolean(footer?.enabled)
  const titlePage =
    (headerEnabled && header?.showOnFirstPage === false) || (footerEnabled && footer?.showOnFirstPage === false)

  const regionParagraph = (section: any, isFooter = false) => {
    const left = headerFooterText(section?.leftContent || section?.content, '')
    const right = headerFooterText(section?.rightContent, '')
    const children: any[] = []
    if (left) children.push(new TextRun(left))
    if (right || (isFooter && section?.showPageNumber)) children.push(new TextRun('\t'))
    if (right) children.push(new TextRun(right))
    if (isFooter && section?.showPageNumber) {
      if (right) children.push(new TextRun(' '))
      children.push(new SimpleField('PAGE'), new TextRun(' / '), new SimpleField('NUMPAGES'))
    }
    return new Paragraph({
      alignment:
        section?.alignment === 'center'
          ? AlignmentType.CENTER
          : section?.alignment === 'right'
            ? AlignmentType.RIGHT
            : AlignmentType.LEFT,
      tabStops:
        right || (isFooter && section?.showPageNumber)
          ? [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }]
          : undefined,
      children: children.length ? children : [new TextRun('')],
    })
  }

  const headerPart = headerEnabled ? new Header({ children: [regionParagraph(header)] }) : undefined
  const footerPart = footerEnabled ? new Footer({ children: [regionParagraph(footer, true)] }) : undefined

  return {
    properties: { type: SectionType.NEXT_PAGE, titlePage, page: DOCX_PAGE },
    headers: headerEnabled
      ? {
          default: headerPart,
          ...(titlePage && header?.showOnFirstPage !== false ? { first: headerPart } : {}),
        }
      : undefined,
    footers: footerEnabled
      ? {
          default: footerPart,
          ...(titlePage && footer?.showOnFirstPage !== false ? { first: footerPart } : {}),
        }
      : undefined,
  }
}

function createSerializer(commentContext?: CommentSerializationContext) {
  return new DocxSerializerAsync(customNodes(commentContext), {
    ...defaultMarks,
    strike: defaultMarks.strikethrough,
    strikethrough: defaultMarks.strikethrough,
    textStyle: textStyleMark,
    highlight: highlightMark,
  })
}

export interface ExportDocxOptions {
  resolveImage?: (src: string) => Promise<Uint8Array>
  comments?: WordComment[]
}

async function defaultImageBuffer(src: string) {
  const response = await fetch(src)
  if (!response.ok) throw new Error(`Failed to fetch image for DOCX export: ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

function hasWordPages(editor: Editor) {
  return editor.state.doc.firstChild?.type.name === 'wordPage'
}

function serializationOptions(editor: Editor, options: ExportDocxOptions): OptionsAsync {
  const getImageBuffer = options.resolveImage || defaultImageBuffer
  if (!hasWordPages(editor)) {
    // prosemirror-docx treats an explicitly empty sections array as a valid
    // document with no body. Seed one section so ordinary editor content is
    // serialized into the DOCX body.
    return {
      getImageBuffer,
      sections: [{ properties: { type: SectionType.CONTINUOUS, page: DOCX_PAGE } }],
    }
  }
  const pages = editor.state.doc.content.content.filter(node => node.type.name === 'wordPage')
  return {
    getImageBuffer,
    sections: pages.map(pageSectionConfig),
  }
}

function commentsFromEditor(editor: Editor, options: ExportDocxOptions) {
  return options.comments ?? (editor.storage as any).wordComments?.comments ?? []
}

export async function createDocxDocument(editor: Editor, options: ExportDocxOptions = {}) {
  const comments = commentsFromEditor(editor, options)
  if (!comments.length) {
    return createSerializer().serializeAsync(editor.state.doc, serializationOptions(editor, options))
  }

  const positions = new WeakMap<object, number>()
  editor.state.doc.descendants((node, position) => {
    positions.set(node, position)
  })
  const ids = new Map<string, number>(comments.map((comment, index) => [comment.id, index]))
  const context: CommentSerializationContext = { comments, positions, ids }
  const commentsPart = {
    comments: {
      children: comments.map((comment, index) => {
        const author = comment.author || 'LangEditor'
        const initials =
          comment.initials ||
          author
            .split(/\s+/)
            .map(part => part[0])
            .join('')
            .slice(0, 3)
            .toUpperCase()
        const date = comment.createdAt ? new Date(comment.createdAt) : undefined
        return {
          id: index,
          author,
          initials,
          date: date && Number.isFinite(date.getTime()) ? date : undefined,
          children: [new Paragraph({ children: [new TextRun(comment.content || '')] })],
        }
      }),
    },
  }
  const commentSerializer = createSerializer(context)
  return commentSerializer.serializeAsync(
    editor.state.doc,
    serializationOptions(editor, options),
    () => commentsPart as any
  )
}
