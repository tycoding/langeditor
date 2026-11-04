import type { Editor, Range } from '@tiptap/core'
import type { LcMentionConfig, LcMentionItem, LcMentionSource } from '@/type'

export type { LcMentionConfig, LcMentionItem, LcMentionSource }

export interface MentionMenuItem extends LcMentionItem {
  sourceId: string
  trigger: string
  status?: 'ready' | 'error'
  disabled?: boolean
}

export interface MentionMenuProps {
  editor: Editor
  range: Range
  items: MentionMenuItem[]
  command: (item: MentionMenuItem) => void
}
