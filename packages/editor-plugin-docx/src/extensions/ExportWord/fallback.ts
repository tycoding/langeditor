import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export interface WordExportFallbackContent {
  title: string
  description?: string
  href?: string
  actionLabel?: string
}

export interface WordExportFallbackDefinition {
  /** Stable globally unique registration ID. */
  id: string
  /** Tiptap node type handled by this fallback. */
  nodeType: string
  /** Resolves a portable, non-interactive representation for DOCX output. */
  resolve: (node: ProseMirrorNode) => WordExportFallbackContent | null
}

const WORD_EXPORT_FALLBACKS_KEY = '__LANGEDITOR_WORD_EXPORT_FALLBACKS__'

function registry() {
  const root = globalThis as typeof globalThis & {
    [WORD_EXPORT_FALLBACKS_KEY]?: Map<string, WordExportFallbackDefinition>
  }
  root[WORD_EXPORT_FALLBACKS_KEY] ??= new Map()
  return root[WORD_EXPORT_FALLBACKS_KEY]
}

/**
 * Registers a portable DOCX fallback for one plugin-owned Tiptap node.
 *
 * The fallback is intentionally data-only. It keeps commercial and optional
 * packages independent from the DOCX runtime while ensuring unsupported nodes
 * never disappear or fail export without a useful representation.
 */
export function registerWordExportFallback(definition: WordExportFallbackDefinition) {
  if (!definition.id || !definition.nodeType || typeof definition.resolve !== 'function') {
    throw new Error('Invalid LangEditor Word export fallback definition')
  }
  const fallbacks = registry()
  fallbacks.set(definition.id, definition)
  return () => {
    if (fallbacks.get(definition.id) === definition) fallbacks.delete(definition.id)
  }
}

export function getWordExportFallbacks() {
  return Array.from(registry().values())
}
