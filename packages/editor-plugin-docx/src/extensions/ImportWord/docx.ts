import JSZip from 'jszip'
import type { JSONContent, WordComment } from '@langeditor/core'

type XmlElement = Element

export interface DocxImageAsset {
  file: File
  dataUrl: string
  target: string
}

export interface DocxImportResult {
  content: JSONContent
  images: DocxImageAsset[]
  comments: WordComment[]
  warnings: string[]
}

interface StyleDefinition {
  type?: string
  basedOn?: string
  name?: string
  headingLevel?: number
}

interface NumberingDefinition {
  format: 'bullet' | 'ordered'
  level: number
}

interface Relationship {
  target: string
  targetMode?: string
  type?: string
}

interface CommentBoundary {
  id: string
  kind: 'start' | 'end'
  offset: number
}

interface ParsedBlock {
  node: JSONContent
  list?: NumberingDefinition & { numId: string }
  comments?: CommentBoundary[]
}

function localName(element: XmlElement | null | undefined) {
  return element?.localName || element?.nodeName.split(':').pop() || ''
}

function children(element: XmlElement | Document | null | undefined, name: string) {
  return Array.from(element?.children ?? []).filter(child => localName(child) === name)
}

function child(element: XmlElement | Document | null | undefined, name: string) {
  return children(element, name)[0] ?? null
}

function descendants(element: XmlElement | Document | null | undefined, name: string) {
  return Array.from(element?.getElementsByTagName('*') ?? []).filter(item => localName(item) === name)
}

function attr(element: XmlElement | null | undefined, name: string) {
  if (!element) return undefined
  return element.getAttribute(`w:${name}`) ?? element.getAttribute(name) ?? undefined
}

function rawAttr(element: XmlElement | null | undefined, name: string) {
  if (!element) return undefined
  return element.getAttribute(name) ?? element.getAttribute(`wp:${name}`) ?? undefined
}

function has(element: XmlElement | null | undefined, name: string) {
  if (!element) return false
  const value = attr(element, name)
  return value === undefined || !['0', 'false', 'off', 'no'].includes(value.toLowerCase())
}

function parseXml(value: string, part: string) {
  const document = new DOMParser().parseFromString(value, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error(`Invalid Word XML in ${part}`)
  return document
}

function resolveTarget(source: string, target: string) {
  if (/^[a-z]+:/i.test(target)) return target
  const base = source.split('/').slice(0, -1)
  for (const part of target.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') base.pop()
    else base.push(part)
  }
  return base.join('/')
}

function normalizeHex(value?: string) {
  if (!value || value === 'auto') return undefined
  const hex = value.replace('#', '').trim()
  return /^[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : undefined
}

function cssSizeToPt(value?: string) {
  if (!value) return undefined
  const number = Number.parseFloat(value)
  if (!Number.isFinite(number)) return undefined
  if (value.toLowerCase().endsWith('px')) return Math.round((number * 72) / 96)
  if (value.toLowerCase().endsWith('pt')) return number
  return number
}

function readStyles(document: Document | null): Map<string, StyleDefinition> {
  const styles = new Map<string, StyleDefinition>()
  for (const style of children(document?.documentElement, 'style')) {
    const id = attr(style, 'styleId')
    if (!id) continue
    const name = attr(child(style, 'name'), 'val')
    const basedOn = attr(child(style, 'basedOn'), 'val')
    const outline = Number.parseInt(attr(child(child(style, 'pPr'), 'outlineLvl'), 'val') ?? '', 10)
    styles.set(id, {
      type: attr(style, 'type'),
      name,
      basedOn,
      headingLevel: Number.isFinite(outline) ? outline + 1 : undefined,
    })
  }
  return styles
}

function headingLevelForStyle(
  styleId: string | undefined,
  styles: Map<string, StyleDefinition>,
  visited = new Set<string>()
): number | undefined {
  if (!styleId || visited.has(styleId)) return undefined
  visited.add(styleId)
  const style = styles.get(styleId)
  if (!style) return undefined
  if (style.headingLevel) return style.headingLevel
  const namedLevel = /^Heading([1-6])$/i.exec(style.name ?? '')?.[1]
  return namedLevel ? Number(namedLevel) : headingLevelForStyle(style.basedOn, styles, visited)
}

function readNumbering(document: Document | null): Map<string, Map<number, NumberingDefinition>> {
  const abstract = new Map<string, Map<number, NumberingDefinition>>()
  const numbering = new Map<string, Map<number, NumberingDefinition>>()
  for (const item of children(document?.documentElement, 'abstractNum')) {
    const id = attr(item, 'abstractNumId')
    if (!id) continue
    const levels = new Map<number, NumberingDefinition>()
    for (const level of children(item, 'lvl')) {
      const levelIndex = Number(attr(level, 'ilvl') ?? 0)
      const numFmt = attr(child(level, 'numFmt'), 'val')
      levels.set(levelIndex, { format: numFmt === 'bullet' ? 'bullet' : 'ordered', level: levelIndex })
    }
    if (levels.size) abstract.set(id, levels)
  }
  for (const item of children(document?.documentElement, 'num')) {
    const id = attr(item, 'numId')
    const abstractId = attr(child(item, 'abstractNumId'), 'val')
    const value = abstractId ? abstract.get(abstractId) : undefined
    if (id && value) numbering.set(id, new Map(value))
  }
  return numbering
}

function readRelationships(document: Document | null): Map<string, Relationship> {
  const relationships = new Map<string, Relationship>()
  for (const relationship of Array.from(document?.documentElement?.children ?? [])) {
    const id = relationship.getAttribute('Id')
    const target = relationship.getAttribute('Target')
    if (id && target)
      relationships.set(id, {
        target,
        targetMode: relationship.getAttribute('TargetMode') ?? undefined,
        type: relationship.getAttribute('Type') ?? undefined,
      })
  }
  return relationships
}

interface DocxCommentDefinition {
  author?: string
  date?: string
  content: string
}

function readComments(document: Document | null): Map<string, DocxCommentDefinition> {
  const comments = new Map<string, DocxCommentDefinition>()
  for (const comment of children(document?.documentElement, 'comment')) {
    const id = attr(comment, 'id')
    if (!id) continue
    const content = descendants(comment, 't')
      .map(text => text.textContent ?? '')
      .join('')
      .trim()
    comments.set(id, {
      author: attr(comment, 'author'),
      date: attr(comment, 'date'),
      content,
    })
  }
  return comments
}

function runMarks(run: XmlElement) {
  const properties = child(run, 'rPr')
  const marks: Array<{ type: string; attrs?: Record<string, unknown> }> = []
  if (has(child(properties, 'b'), 'val')) marks.push({ type: 'bold' })
  if (has(child(properties, 'i'), 'val')) marks.push({ type: 'italic' })
  if (child(properties, 'u')) marks.push({ type: 'underline' })
  if (has(child(properties, 'strike'), 'val')) marks.push({ type: 'strike' })
  const color = normalizeHex(attr(child(properties, 'color'), 'val'))
  const highlight = normalizeHex(attr(child(properties, 'highlight'), 'val'))
  const shading = normalizeHex(attr(child(properties, 'shd'), 'fill'))
  const fontSize = attr(child(properties, 'sz'), 'val')
  const font = attr(child(properties, 'rFonts'), 'ascii') || attr(child(properties, 'rFonts'), 'hAnsi')
  const vertAlign = attr(child(properties, 'vertAlign'), 'val')
  const textStyle: Record<string, unknown> = {}
  if (color) textStyle.color = `#${color}`
  if (font) textStyle.fontFamily = font
  const halfPoints = Number(fontSize)
  if (Number.isFinite(halfPoints) && halfPoints > 0) textStyle.fontSize = `${halfPoints / 2}pt`
  if (Object.keys(textStyle).length) marks.push({ type: 'textStyle', attrs: textStyle })
  if (highlight || shading) marks.push({ type: 'highlight', attrs: { color: `#${highlight || shading}` } })
  if (vertAlign === 'superscript') marks.push({ type: 'superscript' })
  if (vertAlign === 'subscript') marks.push({ type: 'subscript' })
  return marks
}

function parseInline(parent: XmlElement, warnings: string[]): { content: JSONContent[]; comments: CommentBoundary[] } {
  const content: JSONContent[] = []
  const commentBoundaries: CommentBoundary[] = []
  let inlineOffset = 0
  const visit = (
    element: XmlElement,
    inheritedMarks: Array<{ type: string; attrs?: Record<string, unknown> }> = []
  ) => {
    const name = localName(element)
    if (name === 'commentRangeStart') {
      const id = attr(element, 'id')
      if (id) commentBoundaries.push({ id, kind: 'start', offset: inlineOffset })
      return
    }
    if (name === 'commentRangeEnd') {
      const id = attr(element, 'id')
      if (id) commentBoundaries.push({ id, kind: 'end', offset: inlineOffset })
      return
    }
    if (name === 't' || name === 'delText') {
      const text = element.textContent ?? ''
      if (text) {
        content.push({ type: 'text', text, marks: inheritedMarks.length ? inheritedMarks : undefined })
        inlineOffset += text.length
      }
      return
    }
    if (name === 'tab') {
      content.push({ type: 'text', text: '\t', marks: inheritedMarks.length ? inheritedMarks : undefined })
      inlineOffset += 1
      return
    }
    if (name === 'br') {
      content.push({ type: 'hardBreak' })
      inlineOffset += 1
      return
    }
    if (name === 'drawing' || name === 'pict') {
      const embed = rawAttr(descendants(element, 'blip')[0], 'r:embed')
      if (embed) {
        const attrs: Record<string, unknown> = { src: `word-relationship:${embed}` }
        const extent = descendants(element, 'extent')[0]
        const width = Number(rawAttr(extent, 'cx'))
        const height = Number(rawAttr(extent, 'cy'))
        if (Number.isFinite(width) && width > 0) {
          attrs.width = Math.round(width / 9525)
          attrs.originWidth = attrs.width
        }
        if (Number.isFinite(height) && height > 0) attrs.originHeight = Math.round(height / 9525)
        const docProperties = descendants(element, 'docPr')[0]
        const alt = rawAttr(docProperties, 'descr') || rawAttr(docProperties, 'title')
        if (alt) attrs.alt = alt
        content.push({ type: 'image', attrs })
        inlineOffset += 1
      } else warnings.push('An image without a relationship was skipped.')
      return
    }
    if (name === 'r') {
      const marks = [...inheritedMarks, ...runMarks(element)]
      for (const childElement of Array.from(element.children)) visit(childElement, marks)
      return
    }
    if (name === 'hyperlink') {
      const relation = element.getAttribute('r:id')
      const linkMark = relation ? { type: 'link', attrs: { href: `word-relationship:${relation}` } } : undefined
      for (const childElement of Array.from(element.children))
        visit(childElement, linkMark ? [...inheritedMarks, linkMark] : inheritedMarks)
      return
    }
    if (name === 'ins' || name === 'smartTag' || name === 'customXml') {
      for (const childElement of Array.from(element.children)) visit(childElement, inheritedMarks)
      return
    }
    if (name === 'del') return
    for (const childElement of Array.from(element.children)) visit(childElement, inheritedMarks)
  }
  for (const element of Array.from(parent.children)) visit(element)
  return {
    content,
    comments: commentBoundaries,
  }
}

function parseParagraph(
  paragraph: XmlElement,
  styles: Map<string, StyleDefinition>,
  numbering: Map<string, Map<number, NumberingDefinition>>,
  warnings: string[],
  boundaryMap?: WeakMap<JSONContent, CommentBoundary[]>
): ParsedBlock {
  const properties = child(paragraph, 'pPr')
  const styleId = attr(child(properties, 'pStyle'), 'val')
  const headingLevel = headingLevelForStyle(styleId, styles)
  const alignment = attr(child(properties, 'jc'), 'val')
  const attrs: Record<string, unknown> = {}
  if (alignment && ['left', 'center', 'right', 'both', 'justify'].includes(alignment))
    attrs.textAlign = alignment === 'both' ? 'justify' : alignment
  const spacing = child(properties, 'spacing')
  const line = Number(attr(spacing, 'line') ?? '')
  if (Number.isFinite(line) && line > 0) attrs.lineHeight = `${Math.round((line / 240) * 100)}%`
  const inline = parseInline(paragraph, warnings)
  const content = inline.content
  const node: JSONContent = {
    type: headingLevel ? 'heading' : 'paragraph',
    attrs: headingLevel ? { level: Math.min(6, Math.max(1, headingLevel)), ...attrs } : attrs,
    content: content.length ? content : undefined,
  }
  if (inline.comments.length && boundaryMap) boundaryMap.set(node, inline.comments)
  const numPr = child(properties, 'numPr')
  const numId = attr(child(numPr, 'numId'), 'val')
  const ilvl = Number(attr(child(numPr, 'ilvl'), 'val') ?? 0)
  const definition = numId ? numbering.get(numId)?.get(ilvl) || numbering.get(numId)?.get(0) : undefined
  const list = definition ? { ...definition, numId, level: ilvl } : undefined
  return { node, list, comments: inline.comments }
}

function parseTable(
  table: XmlElement,
  styles: Map<string, StyleDefinition>,
  numbering: Map<string, Map<number, NumberingDefinition>>,
  warnings: string[],
  boundaryMap?: WeakMap<JSONContent, CommentBoundary[]>
): JSONContent {
  const activeMerges = new Map<number, JSONContent>()
  const rows = children(table, 'tr').map(row => {
    const header = Boolean(child(child(row, 'trPr'), 'tblHeader'))
    let column = 0
    const cells: JSONContent[] = []
    for (const cell of children(row, 'tc')) {
      const cellProperties = child(cell, 'tcPr')
      const colspan = Math.max(1, Number(attr(child(cellProperties, 'gridSpan'), 'val') ?? 1))
      const mergeValue = attr(child(cellProperties, 'vMerge'), 'val')
      const isContinuation = Boolean(child(cellProperties, 'vMerge')) && mergeValue !== 'restart'
      if (isContinuation) {
        const anchor = Array.from({ length: colspan }, (_, offset) => activeMerges.get(column + offset)).find(Boolean)
        if (anchor) anchor.attrs = { ...(anchor.attrs ?? {}), rowspan: Number(anchor.attrs?.rowspan ?? 1) + 1 }
        else warnings.push('A table vertical merge continuation had no matching start cell.')
        column += colspan
        continue
      }

      const widthTwips = Number(attr(child(cellProperties, 'tcW'), 'w') ?? '')
      const background = normalizeHex(attr(child(cellProperties, 'shd'), 'fill'))
      const cellContent = children(cell, 'p').map(
        paragraph => parseParagraph(paragraph, styles, numbering, warnings, boundaryMap).node
      )
      const cellNode: JSONContent = {
        type: header ? 'tableHeader' : 'tableCell',
        attrs: {
          colspan,
          rowspan: 1,
          colwidth: Number.isFinite(widthTwips) && widthTwips > 0 ? [Math.round(widthTwips / 15)] : null,
          ...(background ? { backgroundColor: `#${background}` } : {}),
        },
        content: cellContent.length ? cellContent : [{ type: 'paragraph' }],
      }
      cells.push(cellNode)
      for (let offset = 0; offset < colspan; offset += 1) {
        if (mergeValue === 'restart') activeMerges.set(column + offset, cellNode)
        else activeMerges.delete(column + offset)
      }
      column += colspan
    }
    if (!cells.length) {
      warnings.push('A table row contained only vertical merge continuations and was represented by an empty cell.')
      cells.push({
        type: header ? 'tableHeader' : 'tableCell',
        attrs: { colspan: 1, rowspan: 1, colwidth: null },
        content: [{ type: 'paragraph' }],
      })
    }
    return {
      type: 'tableRow',
      content: cells,
    }
  })
  return { type: 'table', content: rows }
}

function buildLists(blocks: ParsedBlock[]): JSONContent[] {
  const result: JSONContent[] = []
  let index = 0
  while (index < blocks.length) {
    const current = blocks[index]
    if (!current.list) {
      result.push(current.node)
      index += 1
      continue
    }
    const list = current.list
    const listType = list.format === 'bullet' ? 'bulletList' : 'orderedList'
    const createList = (): JSONContent => ({
      type: listType,
      attrs: list.format === 'ordered' ? { start: 1 } : undefined,
      content: [],
    })
    const root = createList()
    const stack: Array<{ level: number; list: JSONContent }> = [{ level: list.level, list: root }]

    while (
      index < blocks.length &&
      blocks[index].list?.numId === list.numId &&
      blocks[index].list?.format === list.format
    ) {
      const item = blocks[index]
      const level = Math.max(list.level, item.list?.level ?? list.level)

      while (stack.length > 1 && level < stack[stack.length - 1].level) stack.pop()
      while (level > stack[stack.length - 1].level) {
        const parentList = stack[stack.length - 1].list
        const parentItem = parentList.content?.[parentList.content.length - 1]
        if (!parentItem) break
        const nested = createList()
        parentItem.content = [...(parentItem.content ?? []), nested]
        stack.push({ level: stack[stack.length - 1].level + 1, list: nested })
      }

      const target = stack[stack.length - 1].list
      target.content = [...(target.content ?? []), { type: 'listItem', content: [item.node] }]
      index += 1
    }
    result.push(root)
  }
  return result
}

function jsonNodeSize(node: JSONContent) {
  if (node.type === 'text') return node.text?.length ?? 0
  if (!node.content?.length) return 1
  return 2 + node.content.reduce((size, child) => size + jsonNodeSize(child), 0)
}

function collectTextSegments(content: JSONContent[]) {
  const segments: Array<{ from: number; text: string }> = []
  const visit = (node: JSONContent, nodeStart: number, isDoc = false) => {
    if (node.type === 'text') {
      if (node.text) segments.push({ from: nodeStart, text: node.text })
      return
    }
    if (node.type === 'hardBreak') {
      segments.push({ from: nodeStart, text: '\n' })
      return
    }
    const childStart = nodeStart + (isDoc ? 0 : 1)
    let offset = childStart
    for (const child of node.content ?? []) {
      visit(child, offset)
      offset += jsonNodeSize(child)
    }
  }
  let offset = 0
  for (const node of content) {
    visit(node, offset)
    offset += jsonNodeSize(node)
  }
  return segments
}

function textBetweenSegments(segments: Array<{ from: number; text: string }>, from: number, to: number) {
  return segments
    .flatMap(segment =>
      Array.from({ length: segment.text.length }, (_, index) => segment.text[index]).filter(
        (_, index) => segment.from + index >= from && segment.from + index < to
      )
    )
    .join('')
    .trim()
}

function collectImportedComments(
  content: JSONContent[],
  boundaryMap: WeakMap<JSONContent, CommentBoundary[]>,
  definitions: Map<string, DocxCommentDefinition>,
  warnings: string[]
): WordComment[] {
  const positions = new Map<string, { from?: number; to?: number }>()
  const visit = (node: JSONContent, nodeStart: number, isDoc = false) => {
    for (const boundary of boundaryMap.get(node) ?? []) {
      const position = nodeStart + (isDoc ? 0 : 1) + boundary.offset
      const range = positions.get(boundary.id) ?? {}
      if (boundary.kind === 'start') range.from = position
      else range.to = position
      positions.set(boundary.id, range)
    }
    const childStart = nodeStart + (isDoc ? 0 : 1)
    let offset = childStart
    for (const child of node.content ?? []) {
      visit(child, offset)
      offset += jsonNodeSize(child)
    }
  }
  let offset = 0
  for (const node of content) {
    visit(node, offset)
    offset += jsonNodeSize(node)
  }

  const segments = collectTextSegments(content)
  const result: WordComment[] = []
  for (const [id, definition] of definitions) {
    const range = positions.get(id)
    if (!range?.from || !range.to || range.from >= range.to) {
      warnings.push(`Comment ${id} did not have a valid document range and was skipped.`)
      continue
    }
    result.push({
      id: `word-comment-${id}`,
      author: definition.author,
      content: definition.content,
      quote: textBetweenSegments(segments, range.from, range.to),
      from: range.from,
      to: range.to,
      createdAt: definition.date || '',
    })
  }
  return result
}

async function toDataUrl(bytes: Uint8Array, target: string) {
  const extension = target.toLowerCase().split('.').pop()
  const mime =
    extension === 'png'
      ? 'image/png'
      : extension === 'gif'
        ? 'image/gif'
        : extension === 'svg'
          ? 'image/svg+xml'
          : extension === 'bmp'
            ? 'image/bmp'
            : extension === 'webp'
              ? 'image/webp'
              : 'image/jpeg'
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `data:${mime};base64,${btoa(binary)}`
}

export async function parseDocx(file: File): Promise<DocxImportResult> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const documentXml = await zip.file('word/document.xml')?.async('string')
  if (!documentXml) throw new Error('The DOCX file does not contain word/document.xml.')
  const stylesXml = await zip.file('word/styles.xml')?.async('string')
  const numberingXml = await zip.file('word/numbering.xml')?.async('string')
  const relationshipsXml = await zip.file('word/_rels/document.xml.rels')?.async('string')
  const styles = readStyles(stylesXml ? parseXml(stylesXml, 'word/styles.xml') : null)
  const numbering = readNumbering(numberingXml ? parseXml(numberingXml, 'word/numbering.xml') : null)
  const relationships = readRelationships(
    relationshipsXml ? parseXml(relationshipsXml, 'word/_rels/document.xml.rels') : null
  )
  const commentsRelationship = Array.from(relationships.values()).find(value => value.type?.endsWith('/comments'))
  const commentsTarget = commentsRelationship
    ? resolveTarget('word/document.xml', commentsRelationship.target)
    : 'word/comments.xml'
  const commentsXml = await zip.file(commentsTarget)?.async('string')
  const commentDefinitions = readComments(commentsXml ? parseXml(commentsXml, commentsTarget) : null)
  const warnings: string[] = []
  const boundaryMap = new WeakMap<JSONContent, CommentBoundary[]>()
  const document = parseXml(documentXml, 'word/document.xml')
  const body = child(document.documentElement, 'body')
  if (!body) throw new Error('The DOCX document does not contain a word body.')
  const blocks: ParsedBlock[] = []
  for (const node of Array.from(body?.children ?? [])) {
    if (localName(node) === 'p') blocks.push(parseParagraph(node, styles, numbering, warnings, boundaryMap))
    else if (localName(node) === 'tbl')
      blocks.push({ node: parseTable(node, styles, numbering, warnings, boundaryMap) })
    else if (localName(node) === 'sectPr')
      warnings.push('Section properties were imported as document content metadata only.')
    else warnings.push(`Unsupported DOCX body element <${localName(node)}> was skipped.`)
  }
  const content = buildLists(blocks)
  const comments = collectImportedComments(content, boundaryMap, commentDefinitions, warnings)
  const images: DocxImageAsset[] = []
  const imageAssetsByRelation = new Map<string, DocxImageAsset>()
  for (const node of content) {
    const walk = async (value: JSONContent) => {
      if (
        value.type === 'image' &&
        typeof value.attrs?.src === 'string' &&
        value.attrs.src.startsWith('word-relationship:')
      ) {
        const relationId = value.attrs.src.slice('word-relationship:'.length)
        const existingAsset = imageAssetsByRelation.get(relationId)
        if (existingAsset) {
          value.attrs.src = existingAsset.dataUrl
          return
        }
        const relation = relationships.get(relationId)
        if (!relation || relation.targetMode === 'External') {
          warnings.push(`Image relationship ${relationId} could not be resolved.`)
          return
        }
        const target = resolveTarget('word/document.xml', relation.target)
        const entry = zip.file(target)
        if (!entry) {
          warnings.push(`Image ${target} could not be found in the DOCX package.`)
          return
        }
        const bytes = await entry.async('uint8array')
        const dataUrl = await toDataUrl(bytes, target)
        const extension = target.split('.').pop() || 'png'
        const imageFile = new File([bytes.buffer as ArrayBuffer], `image-${images.length + 1}.${extension}`, {
          type: dataUrl.slice(5, dataUrl.indexOf(';')),
        })
        const asset = { file: imageFile, dataUrl, target }
        images.push(asset)
        imageAssetsByRelation.set(relationId, asset)
        value.attrs.src = dataUrl
      }
      if (value.type === 'text' && value.marks) {
        for (const mark of value.marks) {
          if (mark.type !== 'link' || typeof mark.attrs?.href !== 'string') continue
          if (!mark.attrs.href.startsWith('word-relationship:')) continue
          const relation = relationships.get(mark.attrs.href.slice('word-relationship:'.length))
          if (relation?.target && relation.targetMode === 'External') mark.attrs.href = relation.target
          else if (relation?.target) mark.attrs.href = resolveTarget('word/document.xml', relation.target)
          else mark.attrs.href = '#'
        }
      }
      for (const childNode of value.content ?? []) await walk(childNode)
    }
    await walk(node)
  }
  return { content: { type: 'doc', content }, images, comments, warnings }
}
