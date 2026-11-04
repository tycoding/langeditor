import { mergeAttributes, Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import type { WordHeaderFooterSection, WordFooterSection } from '@/type'
import WordPageNodeView from './components/WordPageNodeView.vue'
import { WORD_PAGE_CLASS } from './wordPageStyles'

export { WORD_PAGE_CLASS }

export interface WordPageAttributes {
  page: number
  total: number
  header: WordHeaderFooterSection | null
  footer: WordFooterSection | null
}

function parseSection<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export const WordPage = Node.create({
  name: 'wordPage',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  selectable: false,

  addAttributes() {
    return {
      page: {
        default: 1,
        parseHTML: element => Number(element.getAttribute('data-page')) || 1,
        renderHTML: attributes => ({ 'data-page': attributes.page }),
      },
      total: {
        default: 1,
        parseHTML: element => Number(element.getAttribute('data-total')) || 1,
        renderHTML: attributes => ({ 'data-total': attributes.total }),
      },
      header: {
        default: null,
        parseHTML: element => parseSection<WordHeaderFooterSection>(element.getAttribute('data-word-header')),
        renderHTML: attributes => ({
          'data-word-header': attributes.header ? JSON.stringify(attributes.header) : undefined,
        }),
      },
      footer: {
        default: null,
        parseHTML: element => parseSection<WordFooterSection>(element.getAttribute('data-word-footer')),
        renderHTML: attributes => ({
          'data-word-footer': attributes.footer ? JSON.stringify(attributes.footer) : undefined,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'article[data-type="word-page"]' }]
  },

  addNodeView() {
    return VueNodeViewRenderer(WordPageNodeView)
  },

  renderHTML({ node, HTMLAttributes }) {
    const { page, total, header, footer } = node.attrs as WordPageAttributes
    const showHeader = Boolean(header?.enabled) && (page !== 1 || header?.showOnFirstPage !== false)
    const showFooter = Boolean(footer?.enabled) && (page !== 1 || footer?.showOnFirstPage !== false)
    const headerLeft = showHeader ? header?.leftContent || header?.content || 'Untitled document' : 'Untitled document'
    const headerRight = showHeader ? header?.rightContent || 'LangEditor' : 'LangEditor'
    const footerLeft = showFooter ? footer?.leftContent || footer?.content || 'LangChat Team' : 'LangChat Team'
    const footerRight = showFooter
      ? footer?.rightContent || (footer?.showPageNumber ? `${page} / ${total}` : `Page ${page} of ${total}`)
      : `Page ${page} of ${total}`

    return [
      'article',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'word-page',
        'data-word-page-content': '',
        'data-header-display': `${headerLeft}  ·  ${headerRight}`,
        'data-footer-display': `${footerLeft}  ·  ${footerRight}`,
        class: WORD_PAGE_CLASS,
      }),
      0,
    ]
  },
})
