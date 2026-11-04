import type { JSONContent } from '@tiptap/core'
import type { Component } from 'vue'
import type { LcLicenseState, LcPluginUiPlacement } from './runtime'

export type LcBuiltinEditorMode = 'default' | 'mini' | 'word'
export type LcKnownExternalEditorMode = 'spreadsheet' | 'pdf' | 'presentation'
export type LcEditorMode = LcBuiltinEditorMode | LcKnownExternalEditorMode | (string & {})

export type LcDocumentSourceData = string | URL | Blob | File | ArrayBuffer | Uint8Array

export interface LcDocumentSourceDescriptor {
  data: LcDocumentSourceData
  name?: string
  mimeType?: string
  metadata?: Record<string, unknown>
}

export type LcDocumentSource = LcDocumentSourceData | LcDocumentSourceDescriptor
export type LcDocumentValue = string | JSONContent | Record<string, unknown> | unknown[]

export interface LcDocumentSelection {
  kind: string
  [key: string]: unknown
}

export interface LcDocumentOperation {
  id?: string
  type: string
  origin?: 'user' | 'ai' | 'remote' | 'import' | 'host' | (string & {})
  payload?: unknown
  [key: string]: unknown
}

export interface LcDocumentAIContext {
  kind: string
  text?: string
  data?: unknown
  metadata?: Record<string, unknown>
}

export interface LcDocumentPageRegion {
  enabled: boolean
  left?: string
  center?: string
  right?: string
  alignment?: 'left' | 'center' | 'right'
  firstPage?: boolean
  showPageNumber?: boolean
  metadata?: Record<string, unknown>
}

export interface LcDocumentPageLayout {
  paper?: string
  orientation?: 'portrait' | 'landscape'
  margins?: { top: number; right: number; bottom: number; left: number }
  header?: LcDocumentPageRegion
  footer?: LcDocumentPageRegion
  metadata?: Record<string, unknown>
}

export interface LcDocumentSession<TValue extends LcDocumentValue = LcDocumentValue> {
  /** Stable ID for one mounted document session. */
  id: string
  /** Registered editor mode, for example spreadsheet, pdf, or presentation. */
  mode: LcEditorMode
  /** Framework-neutral document family used by AI and collaboration plugins. */
  kind: string
  /** Whether the active surface currently accepts mutations. */
  readonly editable: boolean
  getValue: () => TValue
  setValue: (value: TValue, options?: { emitUpdate?: boolean; origin?: string }) => void | Promise<void>
  getSelection: () => LcDocumentSelection | null
  getAIContext: (options?: Record<string, unknown>) => LcDocumentAIContext | Promise<LcDocumentAIContext>
  /** Validate a complete operation batch without mutating the document. */
  validateOperations?: (operations: LcDocumentOperation[], options?: { origin?: string }) => void | Promise<void>
  applyOperations: (operations: LcDocumentOperation[], options?: { origin?: string }) => void | Promise<void>
  getPageLayout?: () => LcDocumentPageLayout
  setPageLayout?: (layout: LcDocumentPageLayout, options?: { origin?: string }) => void | Promise<void>
  focus: () => void
  destroy?: () => void
  subscribe?: (listener: () => void) => () => void
}

export type LcDocumentSurfaceModule = Component | { default: Component }

/**
 * A separately distributed editor package registers one surface definition.
 * Heavy engines belong behind load(), so importing the registration entry does
 * not add the runtime to Tiptap, Mini, or unrelated document modes.
 */
export interface LcDocumentSurfaceDefinition {
  mode: Exclude<LcEditorMode, LcBuiltinEditorMode>
  load: () => Promise<LcDocumentSurfaceModule>
  /** Capability IDs exposed to generic document plugins. */
  capabilities?: string[]
  /** Initial host height before the surface provides its own responsive layout. */
  minHeight?: string | number
}

export interface LcResolvedDocumentSurface {
  pluginId: string
  commercial: boolean
  definition: LcDocumentSurfaceDefinition
  license: LcLicenseState
  options: Record<string, unknown>
}

export interface LcDocumentSurfaceReadyDetail {
  session: LcDocumentSession
}

export interface LcDocumentSurfaceChangeDetail {
  value: LcDocumentValue
  session: LcDocumentSession
}

export interface LcDocumentPluginContext {
  session: LcDocumentSession
  capabilities: readonly string[]
  hasCapability: (capability: string) => boolean
  license: LcLicenseState
  hasFeature: (feature: string) => boolean
  options: Record<string, unknown>
}

export interface LcDocumentPluginUiContext extends LcDocumentPluginContext {
  placement: LcPluginUiPlacement
  pluginId: string
}

export interface LcDocumentPluginUiContribution {
  id: string
  placement: LcPluginUiPlacement
  component: Component
  props?: Record<string, unknown> | ((context: LcDocumentPluginUiContext) => Record<string, unknown>)
  order?: number
  width?: number
  minWidth?: number
  maxWidth?: number
  resizable?: boolean
  commercial?: boolean
  visible?: boolean | ((context: LcDocumentPluginUiContext) => boolean)
}

export interface LcDocumentPluginInstance {
  ui?: LcDocumentPluginUiContribution[]
  destroy?: () => void
}

export interface LcResolvedDocumentPluginUiContribution extends LcDocumentPluginUiContribution {
  pluginId: string
  commercial: boolean
  resolvedProps: Record<string, unknown>
}

export interface LcResolvedDocumentPluginRuntime {
  session: LcDocumentSession
  capabilities: readonly string[]
  instances: Array<{ pluginId: string; commercial: boolean; instance: LcDocumentPluginInstance }>
  errors: Array<{ pluginId: string; error: Error }>
  license: LcLicenseState
  options: Record<string, unknown>
  destroy: () => void
}

export function isBuiltinEditorMode(mode: LcEditorMode): mode is LcBuiltinEditorMode {
  return mode === 'default' || mode === 'mini' || mode === 'word'
}
