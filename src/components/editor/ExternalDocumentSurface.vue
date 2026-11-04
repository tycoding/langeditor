<script setup lang="ts">
import { computed, defineAsyncComponent, markRaw, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { Component } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import DocumentTitlebar from './DocumentTitlebar.vue'
import DocumentStatusbar from './DocumentStatusbar.vue'
import DocumentPluginUiSlot from '@/components/plugins/DocumentPluginUiSlot.vue'
import PluginSidebarResizeHandle from '@/components/plugins/PluginSidebarResizeHandle.vue'
import DocumentPageChrome from '@/components/document/DocumentPageChrome.vue'
import { DEFAULT_THEME, THEMES } from '@/constants'
import { useTheme } from '@/hooks/useTheme'
import { useLocale } from '@/locales'
import {
  getDocumentPluginUi,
  resolveEditorDocumentPluginRuntime,
  type LcDocumentSession,
  type LcDocumentPageLayout,
  type LcDocumentSource,
  type LcDocumentSurfaceChangeDetail,
  type LcDocumentSurfaceModule,
  type LcDocumentSurfaceReadyDetail,
  type LcDocumentValue,
  type LcEditorMode,
  type LcLicenseState,
  type LcResolvedDocumentPluginRuntime,
  type LcResolvedDocumentSurface,
} from '@/plugins'
import type { BorderRadius, Theme } from '@/constants'
import type { LcEditorOnChange } from '@/type'

const props = defineProps<{
  mode: LcEditorMode
  resolved?: LcResolvedDocumentSurface
  modelValue?: LcDocumentValue
  documentSource?: LcDocumentSource
  pluginOptions?: Record<string, unknown>
  disabled?: boolean
  dark?: boolean
  theme?: Theme
  radius?: BorderRadius
  editorClass?: string | string[] | Record<string, unknown>
  minHeight?: string | number
  registryRevision?: number
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: LcDocumentValue): void
  (event: 'change', value: LcEditorOnChange): void
  (event: 'session-ready', value: LcDocumentSurfaceReadyDetail): void
  (event: 'error', value: { error: Error; source: 'surface' | 'document-plugin' }): void
}>()

const { t } = useLocale()
const { theme: inheritedTheme, borderRadius, isDark } = useTheme()
const surfaceComponent = shallowRef<Component>()
const session = shallowRef<LcDocumentSession>()
const documentRuntime = shallowRef<LcResolvedDocumentPluginRuntime>()
const pageLayout = ref<LcDocumentPageLayout>({
  paper: 'A4',
  orientation: 'portrait',
  header: { enabled: false, firstPage: true },
  footer: { enabled: false, firstPage: true, showPageNumber: true },
})
const headerFooterOpen = ref(false)
const headerFooterSection = ref<'header' | 'footer'>('header')
const sessionRevision = ref(0)
const loading = ref(false)
const loadError = shallowRef<Error>()
const isFullscreen = ref(false)
let loadRevision = 0
let sessionUnsubscribe: (() => void) | undefined

const DocumentHeaderFooterEditor = defineAsyncComponent(
  () => import('@/components/document/DocumentHeaderFooterEditor.vue')
)

const resolvedTheme = computed(() => props.theme ?? inheritedTheme.value ?? DEFAULT_THEME)
const resolvedRadius = computed(() => props.radius ?? borderRadius.value)
const pageLayoutSupported = computed(() => {
  sessionRevision.value
  return Boolean(session.value?.getPageLayout)
})
const pageChromeSupported = computed(
  () => pageLayoutSupported.value && Boolean(props.resolved?.definition.capabilities?.includes('page-chrome'))
)
const pageLayoutEditable = computed(
  () =>
    pageChromeSupported.value &&
    !props.disabled &&
    session.value?.editable !== false &&
    Boolean(session.value?.setPageLayout)
)
const documentTitle = computed(() => {
  const value = props.modelValue
  if (value && typeof value === 'object' && !Array.isArray(value) && 'name' in value) {
    const name = (value as Record<string, unknown>).name
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return t.value('editor.document.untitled')
})
const documentIcon = computed(() => (props.mode === 'spreadsheet' ? 'X' : props.mode.charAt(0).toUpperCase()))
const documentMeta = computed(() => `${props.mode === 'spreadsheet' ? 'XLSX' : props.mode.toUpperCase()} · 100%`)
const editorThemeStyles = computed<Record<string, string>>(() => {
  const themeOption = THEMES.find(option => option.name === resolvedTheme.value) ?? THEMES[0]
  const colorScheme = isDark.value ? themeOption.cssVars.dark : themeOption.cssVars.light
  const styles: Record<string, string> = {
    '--lc-editor-default-radius': `${resolvedRadius.value}rem`,
    '--radius': 'var(--lc-editor-radius, var(--lc-editor-default-radius))',
    minHeight: cssSize(props.minHeight ?? props.resolved?.definition.minHeight ?? 480),
  }
  for (const [key, value] of Object.entries(colorScheme)) {
    const defaultValue = String(value)
    styles[`--${key}`] = `var(--lc-editor-${key}, ${defaultValue})`
    styles[`--color-${key}`] = `hsl(var(--lc-editor-${key}, ${defaultValue}))`
  }
  return styles
})

const leftUi = computed(() => {
  sessionRevision.value
  return getDocumentPluginUi(documentRuntime.value, 'sidebar-left')
})
const rightUi = computed(() => {
  sessionRevision.value
  return getDocumentPluginUi(documentRuntime.value, 'sidebar-right')
})
const hasUi = (placement: Parameters<typeof getDocumentPluginUi>[1]) => {
  sessionRevision.value
  return getDocumentPluginUi(documentRuntime.value, placement).length > 0
}
const leftSidebar = computed(() => leftUi.value[0])
const rightSidebar = computed(() => rightUi.value[0])
const leftWidth = ref(260)
const rightWidth = ref(340)
let leftSidebarKey = ''
let rightSidebarKey = ''

watch(
  leftSidebar,
  contribution => {
    if (!contribution) return
    const key = `${contribution.pluginId}:${contribution.id}`
    if (key === leftSidebarKey) return
    leftSidebarKey = key
    leftWidth.value = contribution.width ?? 260
  },
  { immediate: true }
)

watch(
  rightSidebar,
  contribution => {
    if (!contribution) return
    const key = `${contribution.pluginId}:${contribution.id}`
    if (key === rightSidebarKey) return
    rightSidebarKey = key
    rightWidth.value = contribution.width ?? 340
  },
  { immediate: true }
)

function cssSize(value: string | number) {
  return typeof value === 'number' ? `${value}px` : value
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

function handleFullscreenKeydown(event: KeyboardEvent) {
  if (event.key !== 'F11') return
  event.preventDefault()
  toggleFullscreen()
}

function normalizeSurfaceModule(module: LcDocumentSurfaceModule): Component {
  return markRaw('default' in module ? module.default : module)
}

async function loadSurface() {
  const revision = ++loadRevision
  destroySession()
  surfaceComponent.value = undefined
  loadError.value = undefined
  if (!props.resolved) {
    emit('error', {
      error: new Error(`No LangEditor document surface is registered for mode ${props.mode}.`),
      source: 'surface',
    })
    return
  }
  loading.value = true
  try {
    const loaded = normalizeSurfaceModule(await props.resolved.definition.load())
    if (revision === loadRevision) surfaceComponent.value = loaded
  } catch (error) {
    if (revision !== loadRevision) return
    const resolvedError = error instanceof Error ? error : new Error(String(error))
    loadError.value = resolvedError
    emit('error', { error: resolvedError, source: 'surface' })
  } finally {
    if (revision === loadRevision) loading.value = false
  }
}

function destroyDocumentRuntime() {
  documentRuntime.value?.destroy()
  documentRuntime.value = undefined
}

function destroySession() {
  sessionUnsubscribe?.()
  sessionUnsubscribe = undefined
  destroyDocumentRuntime()
  session.value?.destroy?.()
  session.value = undefined
  headerFooterOpen.value = false
}

function syncPageLayout() {
  const value = session.value?.getPageLayout?.()
  if (value) pageLayout.value = value
}

function editPageRegion(section: 'header' | 'footer') {
  if (!pageLayoutEditable.value) return
  headerFooterSection.value = section
  headerFooterOpen.value = true
}

async function applyPageLayout(value: LcDocumentPageLayout) {
  if (!session.value?.setPageLayout) return
  try {
    await session.value.setPageLayout(value, { origin: 'user' })
    pageLayout.value = value
    headerFooterOpen.value = false
  } catch (error) {
    emit('error', {
      error: error instanceof Error ? error : new Error(String(error)),
      source: 'surface',
    })
  }
}

function initializeDocumentRuntime() {
  destroyDocumentRuntime()
  if (!session.value || !props.resolved) return
  try {
    documentRuntime.value = resolveEditorDocumentPluginRuntime(
      session.value,
      props.pluginOptions,
      props.resolved.license,
      props.resolved.definition.capabilities
    )
    documentRuntime.value.errors.forEach(({ pluginId, error }) => {
      emit('error', {
        error: new Error(`Document plugin ${pluginId} failed to initialize: ${error.message}`),
        source: 'document-plugin',
      })
    })
  } catch (error) {
    const resolvedError = error instanceof Error ? error : new Error(String(error))
    emit('error', { error: resolvedError, source: 'document-plugin' })
  }
}

function handleReady(detail: LcDocumentSurfaceReadyDetail | LcDocumentSession) {
  const nextSession = 'session' in detail ? detail.session : detail
  if (!nextSession || typeof nextSession.getValue !== 'function') {
    emit('error', {
      error: new Error(`Document surface ${props.mode} returned an invalid session.`),
      source: 'surface',
    })
    return
  }
  if (session.value && session.value !== nextSession) session.value.destroy?.()
  session.value = nextSession
  sessionUnsubscribe?.()
  sessionUnsubscribe = nextSession.subscribe?.(() => {
    sessionRevision.value += 1
    syncPageLayout()
  })
  sessionRevision.value += 1
  syncPageLayout()
  initializeDocumentRuntime()
  emit('session-ready', { session: nextSession })
}

function handleUpdate(value: LcDocumentValue) {
  emit('update:modelValue', value)
}

function handleChange(detail: LcDocumentSurfaceChangeDetail | LcDocumentValue) {
  if (!session.value) return
  const value = typeof detail === 'object' && detail !== null && 'value' in detail ? detail.value : detail
  emit('change', { output: value, session: session.value })
}

watch(
  () => props.dark,
  value => {
    if (value !== undefined) isDark.value = value
  },
  { immediate: true }
)

watch(
  [() => props.mode, () => props.resolved?.pluginId, () => props.resolved?.definition],
  () => {
    isFullscreen.value = false
    void loadSurface()
  },
  { immediate: true }
)
watch(() => props.registryRevision, initializeDocumentRuntime)

onUnmounted(() => {
  loadRevision += 1
  destroySession()
})

defineExpose({
  session,
  focus: () => session.value?.focus(),
  getValue: () => session.value?.getValue() ?? props.modelValue,
  setValue: (value: LcDocumentValue) => session.value?.setValue(value),
})
</script>

<template>
  <div
    :class="[
      editorClass,
      `theme-${resolvedTheme}`,
      'lc-editor-document-root relative flex min-h-0 w-full flex-col overflow-hidden rounded-[var(--radius)] bg-background text-foreground outline outline-1 outline-border',
      { dark: isDark },
    ]"
    :data-editor-mode="mode"
    :style="editorThemeStyles"
    data-editor-layout="document"
    data-langeditor
    @keydown="handleFullscreenKeydown"
  >
    <div
      :class="isFullscreen && '!fixed !inset-0 !z-[9999] m-0 !h-dvh !min-h-0 !w-full !rounded-none'"
      class="lc-editor-shell relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
      data-editor-shell
    >
      <DocumentTitlebar
        :has-floating-ui="hasUi('floating')"
        :icon="documentIcon"
        :meta="documentMeta"
        :status="t('editor.document.saved')"
        :title="documentTitle"
      />
      <div v-if="hasUi('menubar')" class="flex flex-none items-center border-b border-border bg-background">
        <DocumentPluginUiSlot :runtime="documentRuntime" placement="menubar" />
      </div>
      <div v-if="hasUi('toolbar')" class="flex flex-none items-center border-b border-border bg-background">
        <DocumentPluginUiSlot :runtime="documentRuntime" placement="toolbar" />
      </div>

      <div class="lc-editor-content-area flex min-h-0 flex-1 overflow-hidden">
        <aside
          v-if="leftUi.length"
          data-document-sidebar
          class="min-h-0 flex-none overflow-auto border-r border-border bg-background"
          :style="{ width: `${leftWidth}px` }"
        >
          <DocumentPluginUiSlot :runtime="documentRuntime" placement="sidebar-left" />
        </aside>
        <PluginSidebarResizeHandle
          v-if="leftUi.length && leftSidebar?.resizable !== false"
          placement="sidebar-left"
          :width="leftWidth"
          :min-width="leftSidebar?.minWidth ?? 220"
          :max-width="leftSidebar?.maxWidth ?? 560"
          @resize="leftWidth = $event"
        />

        <div class="lc-editor-content-host relative min-h-0 min-w-0 flex-1 overflow-hidden" data-document-surface>
          <div
            v-if="surfaceComponent && resolved"
            :class="pageChromeSupported ? 'h-full min-h-0 bg-muted/30 p-3 sm:p-4' : 'h-full min-h-0'"
          >
            <div
              :class="
                pageChromeSupported
                  ? 'relative h-full min-h-0 overflow-hidden border border-border bg-background pt-[76px] pb-[76px] shadow-sm [container-type:inline-size]'
                  : 'h-full min-h-0'
              "
            >
              <DocumentPageChrome
                v-if="pageChromeSupported"
                :active-section="headerFooterOpen ? headerFooterSection : null"
                :disabled="!pageLayoutEditable"
                :layout="pageLayout"
                :page="1"
                :total="1"
                @edit="editPageRegion"
              />
              <component
                :is="surfaceComponent"
                class="h-full min-h-0 w-full"
                :dark="isDark"
                :disabled="disabled"
                :license="resolved.license"
                :mode="mode"
                :model-value="modelValue"
                :options="pluginOptions ?? {}"
                :source="documentSource"
                :theme="resolvedTheme"
                @change="handleChange"
                @error="
                  emit('error', {
                    error: $event instanceof Error ? $event : new Error(String($event)),
                    source: 'surface',
                  })
                "
                @ready="handleReady"
                @update:model-value="handleUpdate"
              />
            </div>
          </div>

          <div
            v-else-if="loading"
            class="flex h-full min-h-[240px] items-center justify-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <Icon class="motion-reduce:animate-none h-4 w-4 animate-spin" name="LoaderCircle" />
            <span>{{ t('editor.documentSurface.loading') }}</span>
          </div>

          <div
            v-else
            class="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center"
            role="alert"
          >
            <div>
              <p class="text-sm font-medium text-foreground">
                {{ loadError ? t('editor.documentSurface.loadFailed') : t('editor.documentSurface.unavailable') }}
              </p>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ loadError?.message || t('editor.documentSurface.importPlugin').replace('{mode}', mode) }}
              </p>
            </div>
            <button
              v-if="loadError"
              class="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              :disabled="loading"
              @click="loadSurface"
            >
              <Icon name="Refresh" class="h-3.5 w-3.5" />
              {{ t('editor.documentSurface.retry') }}
            </button>
          </div>
        </div>

        <PluginSidebarResizeHandle
          v-if="rightUi.length && rightSidebar?.resizable !== false"
          placement="sidebar-right"
          :width="rightWidth"
          :min-width="rightSidebar?.minWidth ?? 220"
          :max-width="rightSidebar?.maxWidth ?? 560"
          @resize="rightWidth = $event"
        />
        <aside
          v-if="rightUi.length"
          data-document-sidebar
          class="min-h-0 flex-none overflow-auto border-l border-border bg-background"
          :style="{ width: `${rightWidth}px` }"
        >
          <DocumentPluginUiSlot :runtime="documentRuntime" placement="sidebar-right" />
        </aside>
      </div>

      <DocumentStatusbar :fullscreen="isFullscreen" :runtime="documentRuntime" @toggle-fullscreen="toggleFullscreen" />

      <div v-if="hasUi('floating')" class="pointer-events-none absolute inset-0 z-30">
        <DocumentPluginUiSlot :runtime="documentRuntime" placement="floating" />
      </div>
      <div v-if="hasUi('bubble')" class="pointer-events-none absolute inset-0 z-40">
        <DocumentPluginUiSlot :runtime="documentRuntime" placement="bubble" />
      </div>

      <DocumentHeaderFooterEditor
        v-if="pageChromeSupported"
        v-model:section="headerFooterSection"
        :model-value="pageLayout"
        :open="headerFooterOpen"
        @apply="applyPageLayout"
        @close="headerFooterOpen = false"
      />
    </div>
  </div>
</template>
