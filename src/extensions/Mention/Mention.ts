import { mergeAttributes, Node, type Editor, type Range } from '@tiptap/core'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { VueRenderer } from '@tiptap/vue-3'
import tippy, { type Instance } from 'tippy.js'
import MentionMenu from './MentionMenu.vue'
import type { LcMentionItem, LcMentionSource, MentionMenuItem } from './types'
import { getLangEditorTippyOptions } from '@/utils/tippy'

export interface MentionOptions {
  sources: LcMentionSource<any>[]
  HTMLAttributes?: Record<string, string>
  onSelect?: (item: LcMentionItem) => void
  onError?: (error: Error) => void
}

function readField(item: unknown, key: string) {
  if (!item || typeof item !== 'object') return undefined
  return key.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[part]
  }, item)
}

function normalizeItem(item: unknown, source: LcMentionSource<any>): MentionMenuItem | null {
  const id = readField(item, String(source.idKey ?? 'id'))
  const label = readField(item, String(source.labelKey ?? 'label'))
  if (id == null || label == null) return null
  const value = readField(item, String(source.valueKey ?? 'value'))
  const metadata = readField(item, 'metadata')
  return {
    id: String(id),
    label: String(label),
    value: value == null ? undefined : String(value),
    sourceId: source.id,
    trigger: source.trigger ?? '@',
    icon: readField(item, 'icon') == null ? undefined : String(readField(item, 'icon')),
    description: readField(item, 'description') == null ? undefined : String(readField(item, 'description')),
    metadata:
      metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : undefined,
    status: 'ready',
  }
}

function encodeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined
  try {
    return encodeURIComponent(JSON.stringify(metadata))
  } catch {
    return undefined
  }
}

function decodeMetadata(value: string | null) {
  if (!value) return undefined
  try {
    const decoded = JSON.parse(decodeURIComponent(value))
    return decoded && typeof decoded === 'object' ? decoded : undefined
  } catch {
    return undefined
  }
}

export const Mention = Node.create<MentionOptions>({
  name: 'mention',
  priority: 201,
  inline: true,
  group: 'inline',
  atom: true,
  selectable: false,

  addOptions() {
    return { sources: [], HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      id: { default: '', rendered: false, parseHTML: element => element.getAttribute('data-mention-id') ?? '' },
      label: { default: '', rendered: false, parseHTML: element => element.getAttribute('data-mention-label') ?? '' },
      value: { default: null, rendered: false, parseHTML: element => element.getAttribute('data-mention-value') },
      sourceId: {
        default: '',
        rendered: false,
        parseHTML: element => element.getAttribute('data-mention-source') ?? '',
      },
      trigger: {
        default: '@',
        rendered: false,
        parseHTML: element => element.getAttribute('data-mention-trigger') ?? '@',
      },
      metadata: {
        default: null,
        rendered: false,
        parseHTML: element => decodeMetadata(element.getAttribute('data-mention-metadata')),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="mention"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const metadata = encodeMetadata(node.attrs.metadata)
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'mention',
        'data-mention-id': node.attrs.id,
        'data-mention-label': node.attrs.label,
        'data-mention-value': node.attrs.value || undefined,
        'data-mention-source': node.attrs.sourceId,
        'data-mention-trigger': node.attrs.trigger,
        'data-mention-metadata': metadata,
        'class': 'lc-mention',
      }),
      `${node.attrs.trigger}${node.attrs.label}`,
    ]
  },

  renderText({ node }) {
    return `${node.attrs.trigger}${node.attrs.label}`
  },

  addStorage() {
    return { popups: new Set<Instance>() }
  },

  onDestroy() {
    for (const popup of this.storage.popups as Set<Instance>) popup.destroy()
    ;(this.storage.popups as Set<Instance>).clear()
  },

  addProseMirrorPlugins() {
    let requestId = 0
    const sources = this.options.sources.filter(source => (source.trigger ?? '@') === '@')
    if (!sources.length) return []

    return [
      Suggestion<MentionMenuItem>({
        editor: this.editor,
        char: '@',
        allowSpaces: false,
        pluginKey: new PluginKey('mention'),
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: MentionMenuItem }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: this.name,
                attrs: {
                  id: props.id,
                  label: props.label,
                  value: props.value,
                  sourceId: props.sourceId,
                  trigger: props.trigger,
                  metadata: props.metadata ? { ...props.metadata } : undefined,
                },
              },
              { type: 'text', text: ' ' },
            ])
            .run()
          this.options.onSelect?.({ ...props, metadata: props.metadata ? { ...props.metadata } : undefined })
        },
        items: async ({ query }) => {
          const currentRequest = ++requestId
          try {
            const groups = await Promise.all(
              sources.map(async source => {
                const rawItems =
                  typeof source.items === 'function' ? await source.items(query) : source.items
                const normalized = rawItems
                  .map(item => normalizeItem(item, source))
                  .filter((item): item is MentionMenuItem => Boolean(item))
                  .filter(item => {
                    if (typeof source.items === 'function') return true
                    const needle = query.toLocaleLowerCase()
                    return `${item.label} ${item.value ?? ''}`.toLocaleLowerCase().includes(needle)
                  })
                return normalized.slice(0, source.maxItems ?? 8)
              })
            )
            return currentRequest === requestId ? groups.flat() : []
          } catch (error) {
            if (currentRequest !== requestId) return []
            const value = error instanceof Error ? error : new Error(String(error))
            this.options.onError?.(value)
            return [
              {
                id: '__mention_error',
                label: '',
                sourceId: '__error',
                trigger: '@',
                status: 'error',
                disabled: true,
              },
            ]
          }
        },
        render: () => {
          let component: VueRenderer | undefined
          let popup: Instance | undefined
          const popups = this.storage.popups as Set<Instance>
          return {
            onStart: (props: SuggestionProps<MentionMenuItem>) => {
              component = new VueRenderer(MentionMenu, { props, editor: props.editor })
              if (!props.clientRect) return
              const portalHost =
                props.editor.view.dom.closest<HTMLElement>('[data-langeditor]') ?? document.body
              popup = tippy(
                portalHost,
                getLangEditorTippyOptions({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => portalHost,
                  content: component.element,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                  maxWidth: 'none',
                  offset: [0, 6],
                  showOnCreate: true,
                }),
              )
              popups.add(popup)
            },
            onUpdate: (props: SuggestionProps<MentionMenuItem>) => {
              component?.updateProps(props)
              if (props.clientRect) popup?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect })
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                popup?.hide()
                return true
              }
              return component?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => {
              if (popup) {
                popups.delete(popup)
                popup.destroy()
              }
              component?.destroy()
            },
          }
        },
      }),
    ]
  },
})
