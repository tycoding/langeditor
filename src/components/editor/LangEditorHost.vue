<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useAttrs, useSlots } from 'vue'
import TiptapLangEditor from './LangEditor.vue'
import ExternalDocumentSurface from './ExternalDocumentSurface.vue'
import type { LcEditorProps } from '@/type'
import {
  getLicenseState,
  isBuiltinEditorMode,
  resolveEditorDocumentSurface,
  resolveLicense,
  subscribeEditorPluginRuntime,
  type LcDocumentValue,
  type LcLicenseState,
} from '@/plugins'

defineOptions({ inheritAttrs: false })

const props = defineProps<LcEditorProps>()
const attrs = useAttrs()
const slots = useSlots()
const tiptapRef = ref<InstanceType<typeof TiptapLangEditor>>()
const documentRef = ref<InstanceType<typeof ExternalDocumentSurface>>()
const registryRevision = ref(0)
let unsubscribeRuntime: (() => void) | undefined

const mode = computed(() => props.mode ?? 'default')
const builtinMode = computed(() => isBuiltinEditorMode(mode.value))
const pluginLicense = computed<LcLicenseState>(() =>
  props.license ? resolveLicense(props.license) : getLicenseState()
)
const resolvedSurface = computed(() => {
  registryRevision.value
  if (builtinMode.value || props.autoPlugins === false) return undefined
  return resolveEditorDocumentSurface(mode.value, props.pluginOptions, pluginLicense.value)
})

onMounted(() => {
  unsubscribeRuntime = subscribeEditorPluginRuntime(() => {
    registryRevision.value += 1
  })
})

onUnmounted(() => unsubscribeRuntime?.())

defineExpose({
  get editor() {
    return tiptapRef.value?.editor
  },
  get session() {
    return documentRef.value?.session
  },
  submit: () => tiptapRef.value?.submit?.(),
  stop: () => tiptapRef.value?.stop?.(),
  startVoice: () => tiptapRef.value?.startVoice?.(),
  cancelVoice: () => tiptapRef.value?.cancelVoice?.(),
  confirmVoice: () => tiptapRef.value?.confirmVoice?.(),
  focus: () =>
    builtinMode.value
      ? tiptapRef.value?.editor?.commands.focus()
      : documentRef.value?.focus(),
  getValue: () =>
    builtinMode.value ? props.modelValue : documentRef.value?.getValue(),
  setValue: (value: LcDocumentValue) => documentRef.value?.setValue(value),
})
</script>

<template>
  <TiptapLangEditor
    v-if="builtinMode"
    ref="tiptapRef"
    v-bind="{ ...props, ...attrs }"
  >
    <template v-for="(_, name) in slots" :key="name" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </TiptapLangEditor>
  <ExternalDocumentSurface
    v-else
    ref="documentRef"
    v-bind="attrs"
    :dark="props.dark"
    :disabled="props.disabled"
    :document-source="props.documentSource"
    :editor-class="props.editorClass"
    :min-height="props.minHeight"
    :mode="mode"
    :model-value="props.modelValue"
    :plugin-options="props.pluginOptions"
    :radius="props.radius"
    :registry-revision="registryRevision"
    :resolved="resolvedSurface"
    :theme="props.theme"
  />
</template>
