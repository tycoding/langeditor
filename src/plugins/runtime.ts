import type { AnyExtension, Editor as CoreEditor } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import type { Component } from 'vue'
import type { icons } from '@/components/icons'
import type { Group } from '@/extensions/SlashCommand/types'
import type {
  LcDocumentPluginContext,
  LcDocumentPluginInstance,
  LcDocumentPluginUiContext,
  LcDocumentSession,
  LcDocumentSurfaceDefinition,
  LcEditorMode,
  LcResolvedDocumentPluginRuntime,
  LcResolvedDocumentPluginUiContribution,
  LcResolvedDocumentSurface,
} from './document'
import { isBuiltinEditorMode } from './document'

export type LcLicenseInput = string | LcLicenseClaims

export interface LcLicenseClaims {
  subject?: string
  tenant?: string
  features: string[]
  expiresAt?: string
  allowedDomains?: string[]
  versionRange?: string
  [key: string]: unknown
}

export interface LcLicenseState {
  status: 'inactive' | 'active' | 'invalid' | 'expired'
  token?: string
  claims?: LcLicenseClaims
  error?: string
}

export interface LcLicenseProvider {
  id: string
  verify: (token: string) => LcLicenseClaims | null
}

export interface LcPluginContext {
  license: LcLicenseState
  hasFeature: (feature: string) => boolean
  options: Record<string, unknown>
}

export interface LcPluginToolbarItem {
  /** Optional stable id for diagnostics and host customization. */
  id: string
  /** Existing toolbar rendering uses the same button shape as extensions. */
  extension: AnyExtension
}

export interface LcPluginMenuItem {
  title?: string
  action?: (event?: any) => void
  icon?: keyof typeof icons
  disabled?: boolean | (() => boolean)
  checked?: boolean | (() => boolean)
  shortcut?: string[]
  separator?: boolean
  requiredExtensions?: string[]
  key?: string
  visible?: boolean | (() => boolean)
  commercial?: boolean
}

export interface LcPluginMenuGroup {
  /** Locale key or visible label. The host resolves locale keys as usual. */
  title: string
  children: LcPluginMenuItem[]
  commercial?: boolean
}

/** Stable host locations where a plugin can render Vue UI. */
export type LcPluginUiPlacement =
  | 'toolbar'
  | 'menubar'
  | 'bubble'
  | 'sidebar-left'
  | 'sidebar-right'
  | 'statusbar-left'
  | 'statusbar-right'
  | 'floating'

export type LcPluginSidebarPlacement = Extract<LcPluginUiPlacement, 'sidebar-left' | 'sidebar-right'>

export interface LcPluginSidebarTarget {
  pluginId: string
  id: string
}

export interface LcPluginUiContext {
  editor: CoreEditor
  placement: LcPluginUiPlacement
  pluginId: string
  license: LcLicenseState
  options: Record<string, unknown>
}

export interface LcPluginUiContribution {
  /** Stable ID within the plugin. */
  id: string
  /** Host slot where this component is rendered. */
  placement: LcPluginUiPlacement
  /** Vue component definition rendered for this editor instance. */
  component: Component
  /** Props are evaluated per editor instance and per contribution. */
  props?: Record<string, unknown> | ((context: LcPluginUiContext) => Record<string, unknown>)
  /** Lower values render first. */
  order?: number
  /** Preferred width for sidebar contributions in pixels. */
  width?: number
  /** Minimum width while resizing a sidebar contribution. */
  minWidth?: number
  /** Maximum width while resizing a sidebar contribution. */
  maxWidth?: number
  /** Whether the host should render a resize handle for this sidebar. */
  resizable?: boolean
  /** Override the plugin-level commercial marker for this contribution. */
  commercial?: boolean
  /** Dynamic visibility for mode, selection, permissions, etc. */
  visible?: boolean | ((context: LcPluginUiContext) => boolean)
  /** Called when another contribution takes over the same sidebar placement. */
  onDeactivate?: (context: LcPluginUiContext) => void
}

/** Declares which document concerns are owned by a plugin for this editor. */
export interface LcPluginDocumentContribution {
  /** A plugin-owned document must not be overwritten by the host modelValue watcher. */
  contentAuthority?: 'host' | 'plugin'
  /** A plugin-owned history implementation replaces the core History extension. */
  history?: 'host' | 'plugin'
}

export interface LcResolvedPluginUiContribution extends LcPluginUiContribution {
  pluginId: string
  commercial: boolean
  resolvedProps: Record<string, unknown>
}

export interface LcPluginInstance {
  /** Tiptap extensions created for this editor instance. */
  extensions?: AnyExtension[]
  /** Toolbar items can normally be implemented by extension options.button. */
  toolbar?: LcPluginToolbarItem[]
  /** Additional top-level menubar groups for this editor instance. */
  menubar?: (editor: CoreEditor) => LcPluginMenuGroup[]
  /** Additional slash-command groups for this editor instance. */
  slashCommands?: (editor: CoreEditor, lang: string) => Group[]
  /** Vue UI contributions rendered into the editor's documented host slots. */
  ui?: (editor: CoreEditor) => LcPluginUiContribution[]
  /** Optional document ownership contract used by the host editing lifecycle. */
  document?: LcPluginDocumentContribution
}

export interface LcEditorPluginDefinition {
  id: string
  version: string
  /** Commercial plugins receive a consistent Enterprise marker in every host UI slot. */
  commercial?: boolean
  coreRange?: string
  requires?: string[]
  conflicts?: string[]
  /** Capability IDs exposed by this plugin. */
  provides?: string[]
  /** Capability IDs this plugin enhances instead of replacing. */
  enhances?: string[]
  /** When present, the plugin is only enabled after this feature is licensed. */
  licenseFeature?: string
  /** Non-Tiptap document surfaces owned by this separately distributed package. */
  surfaces?: LcDocumentSurfaceDefinition[]
  /** Per-session lifecycle for AI, collaboration, review, and other document-agnostic capabilities. */
  createDocument?: (context: LcDocumentPluginContext) => LcDocumentPluginInstance
  create: (context: LcPluginContext) => LcPluginInstance
}

interface RegistryState {
  plugins: Map<string, LcEditorPluginDefinition>
  providers: Map<string, LcLicenseProvider>
  license: LcLicenseState
  listeners: Set<() => void>
}

const REGISTRY_KEY = '__LANGEDITOR_PLUGIN_RUNTIME__'

function createRegistry(): RegistryState {
  return {
    plugins: new Map(),
    providers: new Map(),
    license: { status: 'inactive' },
    listeners: new Set(),
  }
}

function getRegistry(): RegistryState {
  const root = globalThis as typeof globalThis & { [REGISTRY_KEY]?: RegistryState }
  if (!root[REGISTRY_KEY]) root[REGISTRY_KEY] = createRegistry()
  return root[REGISTRY_KEY]
}

function notify() {
  getRegistry().listeners.forEach(listener => listener())
}

function licenseIsExpired(claims?: LcLicenseClaims) {
  if (!claims?.expiresAt) return false
  const timestamp = Date.parse(claims.expiresAt)
  return Number.isFinite(timestamp) && timestamp <= Date.now()
}

export function registerEditorPlugin(plugin: LcEditorPluginDefinition) {
  if (!plugin.id || typeof plugin.create !== 'function') throw new Error('Invalid LangEditor plugin definition')
  const surfaceModes = new Set<string>()
  for (const surface of plugin.surfaces ?? []) {
    if (!surface.mode || typeof surface.load !== 'function' || isBuiltinEditorMode(surface.mode)) {
      throw new Error(`Invalid document surface in LangEditor plugin ${plugin.id}`)
    }
    if (surfaceModes.has(surface.mode)) {
      throw new Error(`LangEditor plugin ${plugin.id} registered document mode ${surface.mode} more than once`)
    }
    surfaceModes.add(surface.mode)
  }
  const registry = getRegistry()
  const previous = registry.plugins.get(plugin.id)
  if (previous && previous.version !== plugin.version) {
    console.warn(`[LangEditor] Plugin ${plugin.id} was registered more than once; keeping the latest version.`)
  }
  registry.plugins.set(plugin.id, plugin)
  notify()
  return () => {
    if (registry.plugins.get(plugin.id) === plugin) {
      registry.plugins.delete(plugin.id)
      notify()
    }
  }
}

export function getRegisteredEditorPlugins() {
  return Array.from(getRegistry().plugins.values())
}

export function registerLicenseProvider(provider: LcLicenseProvider) {
  if (!provider.id || typeof provider.verify !== 'function') throw new Error('Invalid LangEditor license provider')
  const registry = getRegistry()
  registry.providers.set(provider.id, provider)
  return () => {
    if (registry.providers.get(provider.id) === provider) registry.providers.delete(provider.id)
  }
}

export function resolveLicense(input: LcLicenseInput): LcLicenseState {
  const registry = getRegistry()
  const claims =
    typeof input === 'string'
      ? Array.from(registry.providers.values())
          .map(provider => {
            try {
              return provider.verify(input)
            } catch {
              return null
            }
          })
          .find(Boolean)
      : input

  if (!claims) {
    return {
      status: 'invalid',
      token: typeof input === 'string' ? input : undefined,
      error: 'No registered license provider accepted this token',
    }
  }
  if (licenseIsExpired(claims)) {
    return { status: 'expired', claims, token: typeof input === 'string' ? input : undefined }
  }
  return { status: 'active', claims, token: typeof input === 'string' ? input : undefined }
}

export function activateLicense(input: LcLicenseInput): LcLicenseState {
  const registry = getRegistry()
  registry.license = resolveLicense(input)
  notify()
  return registry.license
}

export function clearLicense() {
  getRegistry().license = { status: 'inactive' }
  notify()
}

export function getLicenseState() {
  return getRegistry().license
}

export function subscribeEditorPluginRuntime(listener: () => void) {
  const registry = getRegistry()
  registry.listeners.add(listener)
  return () => registry.listeners.delete(listener)
}

export function hasLicenseFeatureInState(state: LcLicenseState, feature: string) {
  return (
    state.status === 'active' &&
    Boolean(state.claims?.features.includes(feature) || state.claims?.features.includes('*'))
  )
}

export function hasLicenseFeature(feature: string) {
  return hasLicenseFeatureInState(getRegistry().license, feature)
}

function hasPluginConflict(plugin: LcEditorPluginDefinition, enabled: LcEditorPluginDefinition[]) {
  return enabled.some(item => plugin.conflicts?.includes(item.id) || item.conflicts?.includes(plugin.id))
}

function resolveEnabledPluginDefinitions(license: LcLicenseState) {
  const enabled: LcEditorPluginDefinition[] = []

  for (const plugin of getRegisteredEditorPlugins()) {
    if (plugin.licenseFeature && !hasLicenseFeatureInState(license, plugin.licenseFeature)) continue
    if (plugin.requires?.some(required => !enabled.some(item => item.id === required))) {
      console.warn(`[LangEditor] Skipping plugin ${plugin.id}; a required plugin is not enabled.`)
      continue
    }
    if (hasPluginConflict(plugin, enabled)) {
      console.warn(`[LangEditor] Skipping conflicting plugin ${plugin.id}`)
      continue
    }
    enabled.push(plugin)
  }

  return enabled
}

export interface LcResolvedPluginRuntime {
  extensions: AnyExtension[]
  instances: LcPluginInstance[]
  pluginIds: string[]
  license: LcLicenseState
  options: Record<string, unknown>
}

export interface LcResolvedPluginDocumentPolicy {
  contentAuthority: 'host' | 'plugin'
  history: 'host' | 'plugin'
}

export function resolveEditorPluginDocumentPolicy(
  runtime: Pick<LcResolvedPluginRuntime, 'instances'>
): LcResolvedPluginDocumentPolicy {
  return {
    contentAuthority: runtime.instances.some(instance => instance.document?.contentAuthority === 'plugin')
      ? 'plugin'
      : 'host',
    history: runtime.instances.some(instance => instance.document?.history === 'plugin') ? 'plugin' : 'host',
  }
}

export function resolveEditorPluginRuntime(
  options: Record<string, unknown> = {},
  licenseOverride?: LcLicenseState
): LcResolvedPluginRuntime {
  const instances: LcPluginInstance[] = []
  const extensions: AnyExtension[] = []
  const license = licenseOverride ?? getLicenseState()
  const enabled = resolveEnabledPluginDefinitions(license)

  for (const plugin of enabled) {
    try {
      const instance = plugin.create({
        license,
        hasFeature: feature => hasLicenseFeatureInState(license, feature),
        options,
      })
      instances.push(instance)
      if (instance.extensions)
        extensions.push(...instance.extensions.map(extension => markPluginExtension(extension, plugin)))
      if (instance.toolbar) {
        extensions.push(...instance.toolbar.map(item => markPluginExtension(item.extension, plugin)))
      }
    } catch (error) {
      console.error(`[LangEditor] Failed to initialize plugin ${plugin.id}`, error)
    }
  }

  return { extensions, instances, pluginIds: enabled.map(plugin => plugin.id), license, options }
}

/** Resolves one external document surface without creating a Tiptap editor or plugin instances. */
export function resolveEditorDocumentSurface(
  mode: LcEditorMode,
  options: Record<string, unknown> = {},
  licenseOverride?: LcLicenseState
): LcResolvedDocumentSurface | undefined {
  const license = licenseOverride ?? getLicenseState()
  const matches = resolveEnabledPluginDefinitions(license).flatMap(plugin =>
    (plugin.surfaces ?? [])
      .filter(surface => surface.mode === mode)
      .map(definition => ({
        pluginId: plugin.id,
        commercial: plugin.commercial === true,
        definition,
        license,
        options,
      }))
  )

  if (matches.length > 1) {
    console.warn(
      `[LangEditor] Multiple plugins registered document mode ${mode}; using ${matches[0].pluginId}.`
    )
  }
  return matches[0]
}

/** Creates document-agnostic plugin lifecycles after an external surface exposes its session. */
export function resolveEditorDocumentPluginRuntime(
  session: LcDocumentSession,
  options: Record<string, unknown> = {},
  licenseOverride?: LcLicenseState,
  capabilities: readonly string[] = []
): LcResolvedDocumentPluginRuntime {
  const license = licenseOverride ?? getLicenseState()
  const instances: LcResolvedDocumentPluginRuntime['instances'] = []
  const errors: LcResolvedDocumentPluginRuntime['errors'] = []

  for (const plugin of resolveEnabledPluginDefinitions(license)) {
    if (!plugin.createDocument) continue
    try {
      const instance = plugin.createDocument({
        session,
        capabilities,
        hasCapability: capability => capabilities.includes(capability),
        license,
        hasFeature: feature => hasLicenseFeatureInState(license, feature),
        options,
      })
      instances.push({ pluginId: plugin.id, commercial: plugin.commercial === true, instance })
    } catch (error) {
      const resolvedError = error instanceof Error ? error : new Error(String(error))
      errors.push({ pluginId: plugin.id, error: resolvedError })
      console.error(`[LangEditor] Failed to initialize document plugin ${plugin.id}`, resolvedError)
    }
  }

  let destroyed = false
  return {
    session,
    capabilities,
    instances,
    errors,
    license,
    options,
    destroy() {
      if (destroyed) return
      destroyed = true
      for (const item of [...instances].reverse()) {
        try {
          item.instance.destroy?.()
        } catch (error) {
          console.error(`[LangEditor] Failed to destroy document plugin ${item.pluginId}`, error)
        }
      }
    },
  }
}

export function getDocumentPluginUi(
  runtime: LcResolvedDocumentPluginRuntime | undefined,
  placement: LcPluginUiPlacement
): LcResolvedDocumentPluginUiContribution[] {
  if (!runtime) return []
  const result: LcResolvedDocumentPluginUiContribution[] = []

  for (const item of runtime.instances) {
    for (const contribution of item.instance.ui ?? []) {
      if (contribution.placement !== placement) continue
      const context: LcDocumentPluginUiContext = {
        session: runtime.session,
        capabilities: runtime.capabilities,
        hasCapability: capability => runtime.capabilities.includes(capability),
        placement,
        pluginId: item.pluginId,
        license: runtime.license,
        hasFeature: feature => hasLicenseFeatureInState(runtime.license, feature),
        options: runtime.options,
      }
      try {
        const visible =
          typeof contribution.visible === 'function'
            ? contribution.visible(context)
            : contribution.visible !== false
        if (!visible) continue
        result.push({
          ...contribution,
          pluginId: item.pluginId,
          commercial: contribution.commercial === true || item.commercial,
          resolvedProps:
            typeof contribution.props === 'function'
              ? contribution.props(context)
              : contribution.props ?? {},
        })
      } catch (error) {
        console.error(
          `[LangEditor] Failed to resolve document UI ${item.pluginId}:${contribution.id}`,
          error
        )
      }
    }
  }

  return result.sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
}

const PLUGIN_RUNTIME_EXTENSION = 'pluginRuntime'
const PLUGIN_EXTENSION_META = '__langchatPlugin'

// Tiptap 3 exposes `extension.options` through a getter. Keep plugin metadata
// outside the extension instance so commercial plugins can be source-loaded
// without mutating a runtime-owned object.
const pluginExtensionMetadata = new WeakMap<object, LcPluginExtensionMeta>()

export interface LcPluginExtensionMeta {
  pluginId: string
  commercial: boolean
}

function markPluginExtension(extension: AnyExtension, plugin: LcEditorPluginDefinition) {
  pluginExtensionMetadata.set(extension, {
    pluginId: plugin.id,
    commercial: plugin.commercial === true,
  })
  return extension
}

export function getEditorPluginExtensionMeta(extension: AnyExtension): LcPluginExtensionMeta | undefined {
  return (
    pluginExtensionMetadata.get(extension) ??
    ((extension as any).options?.[PLUGIN_EXTENSION_META] as LcPluginExtensionMeta | undefined)
  )
}

export function copyEditorPluginExtensionMeta(source: AnyExtension, target: AnyExtension) {
  const metadata = getEditorPluginExtensionMeta(source)
  if (metadata) pluginExtensionMetadata.set(target, metadata)
  return target
}

export function createPluginRuntimeExtension(runtime: LcResolvedPluginRuntime) {
  return Extension.create({
    name: PLUGIN_RUNTIME_EXTENSION,
    addStorage() {
      return { runtime }
    },
  })
}

export function getEditorPluginRuntime(editor: CoreEditor): LcResolvedPluginRuntime | undefined {
  const extension = editor.extensionManager.extensions.find(item => item.name === PLUGIN_RUNTIME_EXTENSION)
  return extension?.storage?.runtime as LcResolvedPluginRuntime | undefined
}

export const LC_PLUGIN_SIDEBAR_CHANGE_EVENT = 'lc-plugin-sidebar-change'

export interface LcPluginSidebarChangeDetail {
  placement: LcPluginSidebarPlacement
  active: LcPluginSidebarTarget | null
}

type LcPluginSidebarState = Partial<Record<LcPluginSidebarPlacement, LcPluginSidebarTarget | null>>

const pluginSidebarState = new WeakMap<CoreEditor, LcPluginSidebarState>()

function getPluginSidebarState(editor: CoreEditor) {
  let state = pluginSidebarState.get(editor)
  if (!state) {
    state = {}
    pluginSidebarState.set(editor, state)
  }
  return state
}

function isSameSidebarTarget(
  left: LcPluginSidebarTarget | null | undefined,
  right: LcPluginSidebarTarget | null | undefined
) {
  return left?.pluginId === right?.pluginId && left?.id === right?.id
}

function isSidebarPlacement(placement: LcPluginUiPlacement): placement is LcPluginSidebarPlacement {
  return placement === 'sidebar-left' || placement === 'sidebar-right'
}

function emitPluginSidebarChange(
  editor: CoreEditor,
  placement: LcPluginSidebarPlacement,
  active: LcPluginSidebarTarget | null
) {
  const EventConstructor = editor.view.dom.ownerDocument.defaultView?.CustomEvent
  if (!EventConstructor) return
  editor.view.dom.dispatchEvent(
    new EventConstructor<LcPluginSidebarChangeDetail>(LC_PLUGIN_SIDEBAR_CHANGE_EVENT, {
      detail: { placement, active },
    })
  )
}

export function getEditorPluginMenubarGroups(editor: CoreEditor) {
  const runtime = getEditorPluginRuntime(editor)
  if (!runtime) return []
  return runtime.instances.flatMap((instance, index) => {
    const plugin = getRegisteredEditorPlugins().find(item => item.id === runtime.pluginIds[index])
    return (instance.menubar?.(editor) ?? []).map(group => ({
      ...group,
      commercial: group.commercial === true || plugin?.commercial === true,
      children: group.children.map(item => ({
        ...item,
        commercial: item.commercial === true || plugin?.commercial === true,
      })),
    }))
  })
}

export function getEditorPluginSlashCommandGroups(editor: CoreEditor, lang: string) {
  return (
    getEditorPluginRuntime(editor)?.instances.flatMap(instance => instance.slashCommands?.(editor, lang) ?? []) ?? []
  )
}

function resolveEditorPluginUi(editor: CoreEditor, placement: LcPluginUiPlacement) {
  const runtime = getEditorPluginRuntime(editor)
  if (!runtime) return []

  const result: LcResolvedPluginUiContribution[] = []
  runtime.instances.forEach((instance, index) => {
    const pluginId = runtime.pluginIds[index] ?? 'unknown-plugin'
    const plugin = getRegisteredEditorPlugins().find(item => item.id === pluginId)
    const context: LcPluginUiContext = {
      editor,
      placement,
      pluginId,
      license: runtime.license,
      options: runtime.options,
    }
    try {
      const contributions = instance.ui?.(editor) ?? []
      contributions
        .filter(item => item.placement === placement && item.component)
        .forEach(item => {
          const itemContext = { ...context, placement: item.placement }
          try {
            const visible = typeof item.visible === 'function' ? item.visible(itemContext) : (item.visible ?? true)
            if (!visible) return
            const resolvedProps = typeof item.props === 'function' ? item.props(itemContext) : (item.props ?? {})
            result.push({
              ...item,
              pluginId,
              commercial: item.commercial === true || plugin.commercial === true,
              resolvedProps,
            })
          } catch (error) {
            console.error(`[LangEditor] Failed to resolve UI item ${pluginId}:${item.id}`, error)
          }
        })
    } catch (error) {
      console.error(`[LangEditor] Failed to resolve UI contributions for plugin ${pluginId}`, error)
    }
  })
  return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

function resolveActivePluginSidebar(
  editor: CoreEditor,
  placement: LcPluginSidebarPlacement,
  contributions: LcResolvedPluginUiContribution[]
) {
  const state = getPluginSidebarState(editor)
  if (!Object.prototype.hasOwnProperty.call(state, placement)) {
    const first = contributions[0]
    if (!first) return null
    state[placement] = { pluginId: first.pluginId, id: first.id }
  }

  const active = state[placement] ?? null
  if (!active) return null
  if (contributions.some(item => isSameSidebarTarget(active, item))) return active

  state[placement] = null
  return null
}

/** Returns only the active contribution for each sidebar; other UI placements keep their ordered list. */
export function getEditorPluginUi(editor: CoreEditor, placement: LcPluginUiPlacement) {
  const contributions = resolveEditorPluginUi(editor, placement)
  if (!isSidebarPlacement(placement)) return contributions
  const active = resolveActivePluginSidebar(editor, placement, contributions)
  return active ? contributions.filter(item => isSameSidebarTarget(active, item)) : []
}

export function getEditorPluginSidebarActive(
  editor: CoreEditor,
  placement: LcPluginSidebarPlacement
): LcPluginSidebarTarget | null {
  return resolveActivePluginSidebar(editor, placement, resolveEditorPluginUi(editor, placement))
}

export function isEditorPluginSidebarActive(
  editor: CoreEditor,
  placement: LcPluginSidebarPlacement,
  target: LcPluginSidebarTarget
) {
  return isSameSidebarTarget(getEditorPluginSidebarActive(editor, placement), target)
}

/**
 * Activates one plugin sidebar contribution and deactivates every sibling in the same slot.
 * Passing null closes the slot without falling back to another previously open panel.
 */
export function setEditorPluginSidebarActive(
  editor: CoreEditor,
  placement: LcPluginSidebarPlacement,
  active: LcPluginSidebarTarget | null
) {
  const contributions = resolveEditorPluginUi(editor, placement)
  const state = getPluginSidebarState(editor)
  const previous = resolveActivePluginSidebar(editor, placement, contributions)
  if (isSameSidebarTarget(previous, active)) return

  state[placement] = active
  const runtime = getEditorPluginRuntime(editor)
  contributions.forEach(item => {
    if (!item.onDeactivate || isSameSidebarTarget(item, active)) return
    try {
      item.onDeactivate({
        editor,
        placement,
        pluginId: item.pluginId,
        license: runtime?.license ?? { status: 'inactive' },
        options: runtime?.options ?? {},
      })
    } catch (error) {
      console.error(`[LangEditor] Failed to deactivate sidebar item ${item.pluginId}:${item.id}`, error)
    }
  })
  emitPluginSidebarChange(editor, placement, active)
}

export interface LcPluginSidebarConfig {
  width: number
  minWidth: number
  maxWidth: number
  resizable: boolean
}

export function getEditorPluginSidebarConfig(
  editor: CoreEditor,
  placement: 'sidebar-left' | 'sidebar-right'
): LcPluginSidebarConfig {
  const contribution = getEditorPluginUi(editor, placement)[0]
  const width = contribution?.width ?? (placement === 'sidebar-left' ? 228 : 280)
  return {
    width,
    minWidth: contribution?.minWidth ?? 220,
    maxWidth: contribution?.maxWidth ?? 560,
    resizable: contribution?.resizable ?? true,
  }
}
